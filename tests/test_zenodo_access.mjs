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
    title: "Testkatalog",
    scans: [{
      id: "scan-one",
      label: "Scan Eins",
      source: "Testquelle",
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
    title: "Testkatalog",
    scans: [
      {
        id: "scan-one",
        label: "Scan Eins",
        source: "Testquelle",
        type: "pointcloud",
        format: "copc",
        file: "scan-one.copc.laz",
        units: "m",
      },
      {
        id: "scan-two",
        label: "Scan Zwei",
        source: "Testquelle",
        type: "pointcloud",
        format: "copc",
        file: "scan-two.copc.laz",
        units: "m",
      },
    ],
  };
}

function loadAccess({ hash = "", fetchImpl, stored = null } = {}) {
  const sessionStorage = makeStorage();
  if (stored) {
    sessionStorage.setItem("lidar-viewer.zenodo-access.v1", JSON.stringify(stored));
  }
  const replacements = [];
  const window = {
    location: {
      hash,
      pathname: "/viewer/index.html",
      search: "",
      href: `https://viewer.example/viewer/index.html${hash}`,
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
