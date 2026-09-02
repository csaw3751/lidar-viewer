(function () {
  "use strict";

  const SESSION_KEY = "lidar-viewer.zenodo-access.v1";
  const ZENODO_ORIGIN = "https://zenodo.org";
  const DEFAULT_MANIFEST = "viewer-manifest.json";
  const RANGE_START_INTERVAL_MS = 1_500;
  const MAX_RETRIES = 2;
  const MAX_RANGE_CACHE_BYTES = 8 * 1024 * 1024;

  let activeAccess = null;
  let activeDataset = null;
  let lastRangeStart = 0;
  let rangeStartGate = Promise.resolve();
  let rangeCacheBytes = 0;
  const pendingRanges = new Map();
  const rangeCache = new Map();
  const knownFileSizes = new Map();

  class AccessError extends Error {
    constructor(code, message, status) {
      super(message);
      this.name = "AccessError";
      this.code = code;
      this.status = status || null;
    }
  }

  function isRecordId(value) {
    return typeof value === "string" && /^[0-9]{1,20}$/.test(value);
  }

  function isShareToken(value) {
    return typeof value === "string"
      && value.length >= 32
      && value.length <= 2_048
      && /^[A-Za-z0-9._~-]+$/.test(value);
  }

  function isScanId(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  }

  function safeSessionRead() {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!isRecordId(parsed.recordId) || !isShareToken(parsed.token)) return null;
      return {
        recordId: parsed.recordId,
        token: parsed.token,
        scanId: isScanId(parsed.scanId) ? parsed.scanId : null,
      };
    } catch (_) {
      return null;
    }
  }

  function safeSessionWrite(access) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(access));
    } catch (_) {
      // The current tab still works when session storage is unavailable.
    }
  }

  function stripFragment() {
    if (!window.location.hash) return;
    try {
      window.history.replaceState(
        null,
        document.title,
        `${window.location.pathname}${window.location.search}`,
      );
    } catch (_) {
      // Failure to clean the address bar must not prevent access.
    }
  }

  function captureFragmentAccess() {
    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (!fragment) return null;

    const parameters = new URLSearchParams(fragment);
    const recordId = parameters.get("record") || parameters.get("r") || "";
    const token = parameters.get("token") || parameters.get("t") || "";
    const requestedScan = parameters.get("scan") || parameters.get("s") || "";

    stripFragment();

    if (!isRecordId(recordId) || !isShareToken(token)) return null;

    const access = {
      recordId,
      token,
      scanId: isScanId(requestedScan) ? requestedScan : null,
    };
    safeSessionWrite(access);
    return access;
  }

  function clearAccess() {
    activeAccess = null;
    activeDataset = null;
    rangeCache.clear();
    knownFileSizes.clear();
    rangeCacheBytes = 0;
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {
      // Nothing else to clear.
    }
  }

  function selectScan(scanId) {
    if (!activeAccess || !isScanId(scanId)) return false;
    activeAccess = { ...activeAccess, scanId };
    safeSessionWrite(activeAccess);
    return true;
  }

  function buildFileUrl(recordId, mode, filename, token) {
    if (!isRecordId(recordId) || !isShareToken(token)) {
      throw new AccessError("invalid_access", "The access link is invalid.");
    }

    if (typeof filename !== "string"
        || filename.length < 1
        || filename.length > 240
        || filename.includes("/")
        || filename.includes("\\")
        || filename.includes("..")
        || /[\u0000-\u001f\u007f]/.test(filename)) {
      throw new AccessError("invalid_manifest", "The manifest contains an invalid filename.");
    }

    const scope = mode === "draft" ? "draft/files" : "files";
    const url = new URL(
      `/api/records/${recordId}/${scope}/${encodeURIComponent(filename)}/content`,
      ZENODO_ORIGIN,
    );
    url.searchParams.set("token", token);
    return url.href;
  }

  function retryDelay(response, attempt) {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1_000, 60_000);
      }

      const date = Date.parse(retryAfter);
      if (Number.isFinite(date)) {
        return Math.max(0, Math.min(date - Date.now(), 60_000));
      }
    }
    return Math.min(1_500 * (2 ** attempt), 20_000);
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function fetchWithRetry(url, init) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await window.fetch(url, {
        ...init,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        redirect: "manual",
      });

      if (response.status !== 429 || attempt === MAX_RETRIES) return response;
      if (response.body) response.body.cancel().catch(() => {});
      await wait(retryDelay(response, attempt));
    }
    throw new AccessError("network", "Zenodo could not be reached.");
  }

  function discardResponse(response) {
    if (response && response.body) response.body.cancel().catch(() => {});
  }

  function assertZenodoResponse(response) {
    let responseOrigin = null;
    try {
      responseOrigin = new URL(response.url).origin;
    } catch (_) {
      // A manual cross-origin redirect is intentionally rejected below.
    }
    if (response.type === "opaqueredirect" || responseOrigin !== ZENODO_ORIGIN) {
      discardResponse(response);
      throw new AccessError("unsafe_redirect", "Zenodo redirected the request unexpectedly.");
    }
  }

  function normaliseManifest(payload) {
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.scans) || !payload.scans.length) {
      throw new AccessError("invalid_manifest", "The viewer manifest is invalid or empty.");
    }

    const ids = new Set();
    const scans = payload.scans.map((entry) => {
      const id = entry && entry.id;
      const label = entry && entry.label;
      const filename = entry && entry.file;
      const format = entry && entry.format;

      if (!isScanId(id) || ids.has(id)) {
        throw new AccessError("invalid_manifest", "The manifest contains an invalid or duplicate scan ID.");
      }
      if (typeof label !== "string" || !label.trim() || label.length > 160) {
        throw new AccessError("invalid_manifest", "The manifest contains an invalid scan label.");
      }
      if (typeof filename !== "string"
          || !filename.toLowerCase().endsWith(".copc.laz")
          || filename.includes("/")
          || filename.includes("\\")
          || filename.includes("..")
          || /[\u0000-\u001f\u007f]/.test(filename)) {
        throw new AccessError("invalid_manifest", "The manifest does not reference a valid COPC file.");
      }
      if (entry.type && entry.type !== "pointcloud") {
        throw new AccessError("invalid_manifest", "This viewer supports point clouds only.");
      }
      if (format && format.toLowerCase() !== "copc") {
        throw new AccessError("invalid_manifest", "The point cloud must use COPC format.");
      }

      ids.add(id);
      return Object.freeze({
        id,
        label: label.trim(),
        file: filename,
        source: typeof entry.source === "string" ? entry.source.trim() : "",
        units: typeof entry.units === "string" ? entry.units.trim() : "m",
        points: Number.isFinite(entry.points) ? entry.points : null,
        extent: Array.isArray(entry.extent) ? entry.extent.slice(0, 3) : null,
        attributes: Array.isArray(entry.attributes) ? entry.attributes.slice() : null,
        webFormat: typeof entry.webFormat === "string" ? entry.webFormat.trim() : "COPC 1.0 · LAZ",
      });
    });

    return Object.freeze({
      schemaVersion: 1,
      title: typeof payload.title === "string" ? payload.title.trim() : "LiDAR scans",
      scans: Object.freeze(scans),
    });
  }

  async function resolveDataset(manifestFilename) {
    if (!activeAccess) {
      throw new AccessError(
        "missing_access",
        "Open the complete viewer link you received personally.",
      );
    }

    const filename = manifestFilename || DEFAULT_MANIFEST;
    const modes = ["draft", "published"];
    let lastStatus = null;

    for (const mode of modes) {
      const manifestUrl = buildFileUrl(
        activeAccess.recordId,
        mode,
        filename,
        activeAccess.token,
      );
      const response = await fetchWithRetry(manifestUrl, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      assertZenodoResponse(response);

      if (response.ok) {
        let parsed;
        try {
          parsed = await response.json();
        } catch (_) {
          throw new AccessError("invalid_manifest", "The viewer manifest is not valid JSON.");
        }

        const manifest = normaliseManifest(parsed);
        const selected = manifest.scans.find((scan) => scan.id === activeAccess.scanId)
          || manifest.scans[0];
        activeAccess = { ...activeAccess, scanId: selected.id };
        safeSessionWrite(activeAccess);

        activeDataset = Object.freeze({ mode, manifest, scan: selected });
        return Object.freeze({
          mode,
          recordId: activeAccess.recordId,
          manifest,
          scan: selected,
        });
      }

      lastStatus = response.status;
      discardResponse(response);
      if (![401, 403, 404].includes(response.status)) {
        throw new AccessError(
          "zenodo_error",
          `Zenodo returned an unexpected response (HTTP ${response.status}).`,
          response.status,
        );
      }
    }

    clearAccess();
    throw new AccessError(
      "access_denied",
      "The access link is invalid, expired, or has been revoked.",
      lastStatus,
    );
  }

  function scheduleRangeStart() {
    const start = rangeStartGate.then(async () => {
      const elapsed = Date.now() - lastRangeStart;
      if (elapsed < RANGE_START_INTERVAL_MS) {
        await wait(RANGE_START_INTERVAL_MS - elapsed);
      }
      lastRangeStart = Date.now();
    });
    rangeStartGate = start.catch(() => {});
    return start;
  }

  function cacheRange(key, bytes) {
    if (bytes.byteLength > MAX_RANGE_CACHE_BYTES) return;
    while (rangeCache.size && rangeCacheBytes + bytes.byteLength > MAX_RANGE_CACHE_BYTES) {
      const oldestKey = rangeCache.keys().next().value;
      const oldest = rangeCache.get(oldestKey);
      rangeCache.delete(oldestKey);
      rangeCacheBytes -= oldest.byteLength;
    }
    const stored = bytes.slice();
    rangeCache.set(key, stored);
    rangeCacheBytes += stored.byteLength;
  }

  async function fetchRangeUncached(url, begin, end) {
    if (!Number.isSafeInteger(begin)
        || !Number.isSafeInteger(end)
        || begin < 0
        || end <= begin) {
      throw new AccessError("invalid_range", "Invalid COPC byte range.");
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      await scheduleRangeStart();
      const response = await window.fetch(url, {
        headers: { Range: `bytes=${begin}-${end - 1}` },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        redirect: "manual",
      });
      assertZenodoResponse(response);

      if (response.status === 429 && attempt < MAX_RETRIES) {
        discardResponse(response);
        await wait(retryDelay(response, attempt));
        continue;
      }

      if (response.status === 429) {
        discardResponse(response);
        throw new AccessError(
          "rate_limit",
          "Zenodo is currently limiting the number of data requests.",
          response.status,
        );
      }

      if (response.status === 401 || response.status === 403) {
        discardResponse(response);
        clearAccess();
        throw new AccessError(
          "access_denied",
          "The access link is invalid, expired, or has been revoked.",
          response.status,
        );
      }

      if (response.status !== 206) {
        discardResponse(response);
        throw new AccessError(
          "range_failed",
          `The COPC range could not be loaded (HTTP ${response.status}).`,
          response.status,
        );
      }

      const expectedLength = end - begin;
      // Zenodo exposes Content-Length cross-origin, but not Content-Range.
      // Check the visible length before reading so a full-file response is never buffered.
      const contentLengthHeader = response.headers.get("content-length");
      const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength !== expectedLength) {
        discardResponse(response);
        throw new AccessError(
          "range_length",
          "Zenodo reported an unexpected COPC byte count.",
        );
      }

      const contentRange = response.headers.get("content-range") || "";
      // Keep the stronger range/total-size validation for same-origin or future
      // Zenodo responses that explicitly expose Content-Range through CORS.
      if (contentRange) {
        const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange);
        if (!match
            || Number(match[1]) !== begin
            || Number(match[2]) !== end - 1
            || match[3] === "*"
            || Number(match[3]) < end) {
          discardResponse(response);
          throw new AccessError(
            "range_header",
            "Zenodo returned an unexpected COPC byte range.",
          );
        }

        const totalSize = Number(match[3]);
        const knownSize = knownFileSizes.get(url);
        if (knownSize && knownSize !== totalSize) {
          discardResponse(response);
          throw new AccessError(
            "range_header",
            "Zenodo reported an inconsistent COPC file size.",
          );
        }
        knownFileSizes.set(url, totalSize);
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== expectedLength) {
        throw new AccessError(
          "range_length",
          "Zenodo returned an incomplete COPC byte range.",
        );
      }
      return new Uint8Array(buffer);
    }

    throw new AccessError("rate_limit", "Zenodo is currently limiting the number of data requests.");
  }

  function fetchRange(url, begin, end) {
    const key = `${url}\n${begin}\n${end}`;
    const cached = rangeCache.get(key);
    if (cached) {
      rangeCache.delete(key);
      rangeCache.set(key, cached);
      return Promise.resolve(cached.slice());
    }
    if (pendingRanges.has(key)) return pendingRanges.get(key).then((bytes) => bytes.slice());

    const pending = fetchRangeUncached(url, begin, end)
      .then((bytes) => {
        cacheRange(key, bytes);
        return bytes;
      })
      .finally(() => pendingRanges.delete(key));
    pendingRanges.set(key, pending);
    return pending.then((bytes) => bytes.slice());
  }

  function installCopcGetter() {
    if (!window.Copc || !window.Copc.Getter || typeof window.Copc.Getter.http !== "function") {
      throw new AccessError("missing_copc", "The local COPC library is missing.");
    }
    if (window.Copc.Getter.__zenodoProtectedViewer) return;

    const originalHttp = window.Copc.Getter.http.bind(window.Copc.Getter);
    window.Copc.Getter.http = function protectedHttp(url) {
      const parsed = new URL(url, window.location.href);
      const protectedZenodoFile = parsed.origin === ZENODO_ORIGIN
        && parsed.pathname.startsWith("/api/records/")
        && parsed.searchParams.has("token");
      return protectedZenodoFile
        ? (begin, end) => fetchRange(parsed.href, begin, end)
        : originalHttp(url);
    };
    Object.defineProperty(window.Copc.Getter, "__zenodoProtectedViewer", {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }

  function loadPointCloud() {
    if (!activeAccess || !activeDataset) {
      throw new AccessError("missing_access", "The protected dataset has not been resolved yet.");
    }
    if (!window.Potree || typeof window.Potree.loadPointCloud !== "function") {
      throw new AccessError("missing_potree", "The local Potree library is missing.");
    }

    installCopcGetter();
    const url = buildFileUrl(
      activeAccess.recordId,
      activeDataset.mode,
      activeDataset.scan.file,
      activeAccess.token,
    );
    return window.Potree.loadPointCloud(url, activeDataset.scan.label);
  }

  activeAccess = captureFragmentAccess() || safeSessionRead();

  window.ZenodoViewerAccess = Object.freeze({
    AccessError,
    clearAccess,
    installCopcGetter,
    loadPointCloud,
    resolveDataset,
    selectScan,
    get hasAccess() { return Boolean(activeAccess); },
  });
})();
