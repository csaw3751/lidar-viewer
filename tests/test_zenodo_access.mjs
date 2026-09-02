import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../viewer/zenodo-access.js", import.meta.url), "utf8");
const TEST_TOKEN = "test-token-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

function makeResponse({ url, status = 200, json, bytes, headers = {}, type = "cors" }) {
  let bodyRead = false;
  let bodyCancelled = false;
  const normalisedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );
  return {
    url,
    status,
    ok: status >= 200 && status < 300,
    type,
    headers: { get: (name) => normalisedHeaders.get(name.toLowerCase()) || null },
    body: {
      cancel: async () => { bodyCancelled = true; },
    },
    json: async () => {
      bodyRead = true;
      return json;
    },
    arrayBuffer: async () => {
      bodyRead = true;
      const data = bytes || new Uint8Array();
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    },
    get bodyRead() { return bodyRead; },
    get bodyCancelled() { return bodyCancelled; },
  };
}

function manifest(file = "scan.copc.laz") {
  return {
    schemaVersion: 1,
    title: "Test catalog",
    scans: [{
      id: "scan-one",
      label: "Scan One",
      source: "Test source",
      type: "pointcloud",
      format: "copc",
      file,
      units: "m",
    }],
  };
}

function multiScanManifest() {
  return {
    schemaVersion: 1,
    title: "Test catalog",
    scans: [
      {
        id: "scan-one",
        label: "Scan One",
        source: "Test source",
        type: "pointcloud",
        format: "copc",
        file: "scan-one.copc.laz",
        units: "m",
      },
      {
        id: "scan-two",
        label: "Scan Two",
        source: "Test source",
        type: "pointcloud",
        format: "copc",
        file: "scan-two.copc.laz",
        units: "m",
      },
    ],
  };
}

function loadAccess({
  hash = "",
  pathname = "/viewer/index.html",
  search = "",
  fetchImpl,
  stored = null,
} = {}) {
  const sessionStorage = makeStorage();
  if (stored) {
    sessionStorage.setItem("lidar-viewer.zenodo-access.v1", JSON.stringify(stored));
  }
  const replacements = [];
  const window = {
    location: {
      hash,
      pathname,
      search,
      href: `https://viewer.example${pathname}${search}${hash}`,
    },
    history: {
      replaceState: (_state, _title, url) => replacements.push(url),
    },
    sessionStorage,
    fetch: fetchImpl || (async () => { throw new Error("Unexpected fetch"); }),
    setTimeout: (callback) => { callback(); return 1; },
  };
  const context = vm.createContext({
    window,
    document: { title: "Viewer" },
    URL,
    URLSearchParams,
    Uint8Array,
    Promise,
    Date,
    Object,
    JSON,
    Number,
    String,
    Set,
    Map,
    RegExp,
    Error,
  });
  vm.runInContext(source, context, { filename: "zenodo-access.js" });
  return { access: window.ZenodoViewerAccess, window, replacements, sessionStorage };
}

async function prepareProtectedGetter(fetchImpl) {
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => {
      pointCloudUrl = url;
      return { pointcloud: {} };
    },
  };
  await loaded.access.resolveDataset();
  await loaded.access.loadPointCloud();
  return {
    ...loaded,
    get pointCloudUrl() { return pointCloudUrl; },
    get getter() { return loaded.window.Copc.Getter.http(pointCloudUrl); },
  };
}

test("captures a fragment, scrubs it immediately and keeps access tab-local", () => {
  const { access, replacements, sessionStorage } = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}&scan=scan-one`,
  });

  assert.equal(access.hasAccess, true);
  assert.deepEqual(replacements, ["/viewer/index.html"]);
  const stored = JSON.parse(sessionStorage.getItem("lidar-viewer.zenodo-access.v1"));
  assert.equal(stored.recordId, "12345");
  assert.equal(stored.scanId, "scan-one");
  assert.equal(stored.token, TEST_TOKEN);
});

test("scrubs malformed fragments, preserves the path and query, and ignores query credentials", () => {
  const malformed = loadAccess({
    hash: "#record=not-a-record&token=too-short",
    pathname: "/lidar-viewer/index.html",
    search: "?view=compact",
  });

  assert.equal(malformed.access.hasAccess, false);
  assert.deepEqual(malformed.replacements, ["/lidar-viewer/index.html?view=compact"]);
  assert.equal(malformed.sessionStorage.getItem("lidar-viewer.zenodo-access.v1"), null);

  const queryOnly = loadAccess({
    pathname: "/lidar-viewer/index.html",
    search: `?record=12345&token=${TEST_TOKEN}`,
  });

  assert.equal(queryOnly.access.hasAccess, false);
  assert.deepEqual(queryOnly.replacements, []);
  assert.equal(queryOnly.sessionStorage.getItem("lidar-viewer.zenodo-access.v1"), null);
});

test("rejects a page opened without a personal access fragment", async () => {
  const { access } = loadAccess();
  await assert.rejects(access.resolveDataset(), (error) => error.code === "missing_access");
});

test("loads and validates a protected draft manifest", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return makeResponse({ url, status: 200, json: manifest() });
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  const result = await loaded.access.resolveDataset();
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.loadPointCloud();

  assert.equal(result.mode, "draft");
  assert.equal(result.scan.id, "scan-one");
  assert.equal(Object.hasOwn(result, "dataUrl"), false);
  assert.match(pointCloudUrl, /^https:\/\/zenodo\.org\/api\/records\/12345\/draft\/files\/scan\.copc\.laz\/content\?/);
  assert.equal(new URL(pointCloudUrl).searchParams.get("token"), TEST_TOKEN);
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(calls[0].init.referrerPolicy, "no-referrer");
  assert.equal(calls[0].init.redirect, "manual");
});

test("rejects opaque and off-origin manifest redirects before reading their bodies", async () => {
  const redirects = [
    { name: "opaque", type: "opaqueredirect", responseUrl: null },
    { name: "off-origin", type: "cors", responseUrl: "https://attacker.example/manifest.json" },
  ];

  for (const redirect of redirects) {
    let response = null;
    const fetchImpl = async (url) => {
      response = makeResponse({
        url: redirect.responseUrl || url,
        status: 200,
        json: manifest(),
        type: redirect.type,
      });
      return response;
    };
    const { access } = loadAccess({
      hash: `#record=12345&token=${TEST_TOKEN}`,
      fetchImpl,
    });

    await assert.rejects(
      access.resolveDataset(),
      (error) => error.code === "unsafe_redirect",
      redirect.name,
    );
    assert.equal(response.bodyRead, false, redirect.name);
    assert.equal(response.bodyCancelled, true, redirect.name);
  }
});

test("selects only a declared scan from a multi-scan manifest", async () => {
  const fetchImpl = async (url) => makeResponse({
    url,
    status: 200,
    json: multiScanManifest(),
  });
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}&scan=scan-two`,
    fetchImpl,
  });

  const first = await loaded.access.resolveDataset();
  assert.equal(first.scan.id, "scan-two");
  assert.equal(first.scan.file, "scan-two.copc.laz");

  assert.equal(loaded.access.selectScan("scan-one"), true);
  const second = await loaded.access.resolveDataset();
  assert.equal(second.scan.id, "scan-one");

  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.loadPointCloud();
  assert.match(pointCloudUrl, /\/scan-one\.copc\.laz\/content\?/);
  assert.doesNotMatch(pointCloudUrl, /scan-two\.copc\.laz/);
});

test("falls back from an absent draft to the published record", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("/draft/files/")) return makeResponse({ url, status: 404 });
    return makeResponse({ url, status: 200, json: manifest() });
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  const result = await loaded.access.resolveDataset();
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.loadPointCloud();

  assert.equal(result.mode, "published");
  assert.equal(calls.length, 2);
  assert.match(pointCloudUrl, /\/records\/12345\/files\/scan\.copc\.laz\/content/);
  assert.doesNotMatch(pointCloudUrl, /\/draft\//);
});

test("rejects manifest traversal before constructing a data URL", async () => {
  const fetchImpl = async (url) => makeResponse({
    url,
    status: 200,
    json: manifest("../scan.copc.laz"),
  });
  const { access } = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  await assert.rejects(access.resolveDataset(), (error) => error.code === "invalid_manifest");
});

test("rejects opaque and off-origin Range redirects before reading their bodies", async () => {
  const redirects = [
    { name: "opaque", type: "opaqueredirect", responseUrl: null },
    { name: "off-origin", type: "cors", responseUrl: "https://attacker.example/scan.copc.laz" },
  ];

  for (const redirect of redirects) {
    let response = null;
    const fetchImpl = async (url, init) => {
      if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
      response = makeResponse({
        url: redirect.responseUrl || url,
        status: 206,
        bytes: Uint8Array.from([76, 65, 83, 70]),
        headers: { "content-length": "4" },
        type: redirect.type,
      });
      return response;
    };
    const loaded = await prepareProtectedGetter(fetchImpl);

    await assert.rejects(
      loaded.getter(0, 4),
      (error) => error.code === "unsafe_redirect",
      redirect.name,
    );
    assert.equal(response.bodyRead, false, redirect.name);
    assert.equal(response.bodyCancelled, true, redirect.name);
  }
});

test("protected COPC getter requires an exact 206 Content-Range and deduplicates", async () => {
  const rangeCalls = [];
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    rangeCalls.push({ url, init });
    const bytes = Uint8Array.from([76, 65, 83, 70]);
    return makeResponse({
      url,
      status: 206,
      bytes,
      headers: {
        "content-length": "4",
        "content-range": "bytes 0-3/99941088",
      },
    });
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  let originalCalls = 0;
  let pointCloudUrl = null;
  loaded.window.Copc = {
    Getter: {
      http: () => {
        originalCalls += 1;
        return async () => new Uint8Array();
      },
    },
  };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.resolveDataset();
  await loaded.access.loadPointCloud();
  const getter = loaded.window.Copc.Getter.http(pointCloudUrl);
  const first = await getter(0, 4);
  const firstValues = Array.from(first);
  structuredClone(first.buffer, { transfer: [first.buffer] });
  const second = await getter(0, 4);

  assert.deepEqual(firstValues, [76, 65, 83, 70]);
  assert.equal(first.byteLength, 0);
  assert.deepEqual(Array.from(second), [76, 65, 83, 70]);
  assert.equal(rangeCalls.length, 1);
  assert.equal(rangeCalls[0].init.headers.Range, "bytes=0-3");
  assert.equal(originalCalls, 0);
});

test("rejects invalid Range bounds without making a Range request", async () => {
  let rangeCalls = 0;
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    rangeCalls += 1;
    throw new Error("Invalid bounds must be rejected before fetch");
  };
  const loaded = await prepareProtectedGetter(fetchImpl);
  const invalidRanges = [
    [-1, 1],
    [0, 0],
    [2, 1],
    [0.5, 2],
    [0, Number.MAX_SAFE_INTEGER + 1],
    [0, Number.POSITIVE_INFINITY],
  ];

  for (const [begin, end] of invalidRanges) {
    await assert.rejects(
      loaded.getter(begin, end),
      (error) => error.code === "invalid_range",
      `[${begin}, ${end})`,
    );
  }
  assert.equal(rangeCalls, 0);
});

test("deduplicates simultaneous protected Range requests and returns defensive copies", async () => {
  let rangeCalls = 0;
  let releaseRange;
  const rangeReleased = new Promise((resolve) => { releaseRange = resolve; });
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    rangeCalls += 1;
    await rangeReleased;
    return makeResponse({
      url,
      status: 206,
      bytes: Uint8Array.from([76, 65, 83, 70]),
      headers: {
        "content-length": "4",
        "content-range": "bytes 0-3/99941088",
      },
    });
  };
  const loaded = await prepareProtectedGetter(fetchImpl);

  const firstPending = loaded.getter(0, 4);
  const secondPending = loaded.getter(0, 4);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rangeCalls, 1);
  releaseRange();

  const [first, second] = await Promise.all([firstPending, secondPending]);
  assert.deepEqual(Array.from(first), [76, 65, 83, 70]);
  assert.deepEqual(Array.from(second), [76, 65, 83, 70]);
  assert.notEqual(first.buffer, second.buffer);
});

test("keeps privacy controls on protected Range requests", async () => {
  let rangeCall = null;
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    rangeCall = { url, init };
    return makeResponse({
      url,
      status: 206,
      bytes: Uint8Array.from([76, 65, 83, 70]),
      headers: { "content-length": "4" },
    });
  };
  const loaded = await prepareProtectedGetter(fetchImpl);

  await loaded.getter(4, 8);

  assert.equal(new URL(rangeCall.url).origin, "https://zenodo.org");
  assert.equal(new URL(rangeCall.url).searchParams.get("token"), TEST_TOKEN);
  assert.equal(rangeCall.init.headers.Range, "bytes=4-7");
  assert.equal(rangeCall.init.credentials, "omit");
  assert.equal(rangeCall.init.referrerPolicy, "no-referrer");
  assert.equal(rangeCall.init.cache, "no-store");
  assert.equal(rangeCall.init.redirect, "manual");
});

test("accepts exact Zenodo 206 when CORS hides Content-Range", async () => {
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    return makeResponse({
      url,
      status: 206,
      bytes: Uint8Array.from([76, 65, 83, 70]),
      headers: { "content-length": "4" },
    });
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.resolveDataset();
  await loaded.access.loadPointCloud();

  const bytes = await loaded.window.Copc.Getter.http(pointCloudUrl)(0, 4);
  assert.deepEqual(Array.from(bytes), [76, 65, 83, 70]);
});

test("rejects a mismatched CORS-visible Content-Length before reading the body", async () => {
  let badResponse;
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    badResponse = makeResponse({
      url,
      status: 206,
      bytes: new Uint8Array(1024 * 1024),
      headers: { "content-length": String(1024 * 1024) },
    });
    return badResponse;
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.resolveDataset();
  await loaded.access.loadPointCloud();

  await assert.rejects(
    loaded.window.Copc.Getter.http(pointCloudUrl)(0, 4),
    (error) => error.code === "range_length",
  );
  assert.equal(badResponse.bodyRead, false);
  assert.equal(badResponse.bodyCancelled, true);
});

test("still rejects an incorrect Content-Range when that header is visible", async () => {
  let badResponse;
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    badResponse = makeResponse({
      url,
      status: 206,
      bytes: Uint8Array.from([76, 65, 83, 70]),
      headers: {
        "content-length": "4",
        "content-range": "bytes 4-7/99941088",
      },
    });
    return badResponse;
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.resolveDataset();
  await loaded.access.loadPointCloud();

  await assert.rejects(
    loaded.window.Copc.Getter.http(pointCloudUrl)(0, 4),
    (error) => error.code === "range_header",
  );
  assert.equal(badResponse.bodyRead, false);
  assert.equal(badResponse.bodyCancelled, true);
});

test("rejects Range 200 before reading the full response body", async () => {
  let badResponse;
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    badResponse = makeResponse({ url, status: 200, bytes: new Uint8Array(1024 * 1024) });
    return badResponse;
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.resolveDataset();
  await loaded.access.loadPointCloud();

  await assert.rejects(
    loaded.window.Copc.Getter.http(pointCloudUrl)(4, 8),
    (error) => error.code === "range_failed",
  );
  assert.equal(badResponse.bodyRead, false);
  assert.equal(badResponse.bodyCancelled, true);
});

test("clears tab access when a protected Range becomes unauthorized", async () => {
  const fetchImpl = async (url, init) => {
    if (!init.headers.Range) return makeResponse({ url, status: 200, json: manifest() });
    return makeResponse({ url, status: 403 });
  };
  const loaded = loadAccess({
    hash: `#record=12345&token=${TEST_TOKEN}`,
    fetchImpl,
  });
  let pointCloudUrl = null;
  loaded.window.Copc = { Getter: { http: () => async () => new Uint8Array() } };
  loaded.window.Potree = {
    loadPointCloud: async (url) => { pointCloudUrl = url; return { pointcloud: {} }; },
  };
  await loaded.access.resolveDataset();
  await loaded.access.loadPointCloud();

  await assert.rejects(
    loaded.window.Copc.Getter.http(pointCloudUrl)(8, 12),
    (error) => error.code === "access_denied",
  );
  assert.equal(loaded.access.hasAccess, false);
  assert.equal(loaded.sessionStorage.getItem("lidar-viewer.zenodo-access.v1"), null);
});

test("leaves non-Zenodo getters untouched", async () => {
  const loaded = loadAccess();
  let originalCalls = 0;
  loaded.window.Copc = {
    Getter: {
      http: (url) => {
        originalCalls += 1;
        return async () => Uint8Array.from([url.length]);
      },
    },
  };
  loaded.access.installCopcGetter();
  const bytes = await loaded.window.Copc.Getter.http("https://example.org/public.copc.laz")(0, 1);
  assert.equal(originalCalls, 1);
  assert.equal(bytes.length, 1);
});

test("delegates external and tokenless Zenodo URLs and installs the protected getter once", async () => {
  const loaded = loadAccess();
  const originalUrls = [];
  loaded.window.Copc = {
    Getter: {
      http: (url) => {
        originalUrls.push(url);
        return async () => Uint8Array.from([originalUrls.length]);
      },
    },
  };

  loaded.access.installCopcGetter();
  const installedGetter = loaded.window.Copc.Getter.http;
  loaded.access.installCopcGetter();

  assert.equal(loaded.window.Copc.Getter.http, installedGetter);
  assert.equal(loaded.window.Copc.Getter.__zenodoProtectedViewer, true);

  const externalUrl = `https://example.org/public.copc.laz?token=${TEST_TOKEN}`;
  const tokenlessZenodoUrl = "https://zenodo.org/api/records/12345/files/public.copc.laz/content";
  const external = await loaded.window.Copc.Getter.http(externalUrl)(0, 1);
  const tokenless = await loaded.window.Copc.Getter.http(tokenlessZenodoUrl)(0, 1);

  assert.deepEqual(originalUrls, [externalUrl, tokenlessZenodoUrl]);
  assert.deepEqual(Array.from(external), [1]);
  assert.deepEqual(Array.from(tokenless), [2]);
});
