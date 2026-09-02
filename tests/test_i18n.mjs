import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../viewer/i18n.js", import.meta.url), "utf8");
const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
const STORAGE_KEY = "lidar-viewer.language.v1";
const ACCESS_KEY = "lidar-viewer.zenodo-access.v1";

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  const calls = { get: [], set: [], remove: [] };
  return {
    getItem(key) {
      calls.get.push(key);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.set.push([key, String(value)]);
      values.set(key, String(value));
    },
    removeItem(key) {
      calls.remove.push(key);
      values.delete(key);
    },
    values,
    calls,
  };
}

class FakeElement {
  constructor(attributes = {}, textContent = "") {
    this.attributes = new Map(Object.entries(attributes));
    this.textContent = textContent;
    this.value = "";
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

function makeDocument(elements = []) {
  const documentElement = { lang: "" };
  return {
    documentElement,
    querySelectorAll(selector) {
      const match = /^\[([a-z0-9-]+)\]$/i.exec(selector);
      if (!match) throw new Error("Unexpected selector: " + selector);
      return elements.filter((element) => element.hasAttribute(match[1]));
    },
  };
}

function loadI18n({
  languages = ["en-US"],
  navigatorLanguage = languages[0] || "",
  storedLanguage = null,
  elements = [],
} = {}) {
  const localStorage = makeStorage(
    storedLanguage === null ? {} : { [STORAGE_KEY]: storedLanguage },
  );
  const sessionStorage = makeStorage({
    [ACCESS_KEY]: JSON.stringify({
      recordId: "12345",
      token: "test-token-that-must-remain-tab-local-0123456789",
      scanId: "scan-one",
    }),
  });
  const document = makeDocument(elements);
  const events = [];
  const replacements = [];
  const location = {
    hash: "#record=12345&token=secret-fragment-value",
    pathname: "/viewer/index.html",
    search: "",
    href: "https://viewer.example/viewer/index.html#record=12345&token=secret-fragment-value",
  };
  const navigator = { languages, language: navigatorLanguage };

  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  const window = {
    document,
    navigator,
    localStorage,
    sessionStorage,
    location,
    history: {
      replaceState(_state, _title, url) {
        replacements.push(url);
      },
    },
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
    CustomEvent,
  };
  window.window = window;

  const context = vm.createContext({
    window,
    document,
    navigator,
    localStorage,
    sessionStorage,
    CustomEvent,
    Intl,
    Object,
    Array,
    String,
    Number,
    RegExp,
    JSON,
    Error,
  });
  vm.runInContext(source, context, { filename: "i18n.js" });

  return {
    i18n: window.LidarI18n,
    window,
    document,
    localStorage,
    sessionStorage,
    events,
    replacements,
  };
}

function flattened(object, prefix = "", result = {}) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? prefix + "." + key : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattened(value, path, result);
    } else {
      result[path] = value;
    }
  }
  return result;
}

function placeholders(value) {
  return Array.from(String(value).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g), (match) => match[1])
    .sort();
}

test("English and German catalogs have complete parity", () => {
  const { i18n } = loadI18n();
  assert.ok(i18n);
  assert.equal(i18n.STORAGE_KEY, STORAGE_KEY);
  assert.deepEqual(Array.from(i18n.supportedLanguages), ["en", "de"]);
  assert.ok(Object.isFrozen(i18n.catalog));
  assert.ok(Object.isFrozen(i18n.catalog.en));
  assert.ok(Object.isFrozen(i18n.catalog.de));
  assert.ok(Object.isFrozen(i18n.potreeGermanSupplement));
  assert.equal(Object.keys(i18n.potreeGermanSupplement).length, 54);
  for (const [key, value] of Object.entries(i18n.potreeGermanSupplement)) {
    assert.ok(key.includes("."), "Potree supplement keys must be namespaced");
    assert.equal(typeof value, "string");
    assert.ok(value.trim(), key + " must not have an empty German value");
  }

  const english = flattened(i18n.catalog.en);
  const german = flattened(i18n.catalog.de);
  const englishKeys = Object.keys(english).sort();
  const germanKeys = Object.keys(german).sort();

  assert.deepEqual(germanKeys, englishKeys);
  assert.ok(englishKeys.length >= 50, "The catalog should cover the complete viewer interface");

  for (const key of englishKeys) {
    assert.equal(typeof english[key], "string", key + " must be an English string");
    assert.equal(typeof german[key], "string", key + " must be a German string");
    assert.ok(english[key].trim(), key + " must not have an empty English value");
    assert.ok(german[key].trim(), key + " must not have an empty German value");
    assert.deepEqual(
      placeholders(german[key]),
      placeholders(english[key]),
      key + " must use identical interpolation placeholders in both languages",
    );
  }
});

test("every translation binding in the HTML exists in both catalogs", () => {
  const { i18n } = loadI18n();
  const english = flattened(i18n.catalog.en);
  const german = flattened(i18n.catalog.de);
  const bindingPattern = /\bdata-lidar-i18n(?:-title|-aria-label|-content)?="([^"]+)"/g;
  const keys = Array.from(html.matchAll(bindingPattern), (match) => match[1]);
  const uniqueKeys = Array.from(new Set(keys)).sort();

  assert.ok(uniqueKeys.length >= 50, "Expected translation bindings across the complete interface");
  for (const key of uniqueKeys) {
    assert.ok(Object.hasOwn(english, key), "Missing English catalog key: " + key);
    assert.ok(Object.hasOwn(german, key), "Missing German catalog key: " + key);
  }
  assert.equal((html.match(/\bdata-language-selector\b/g) || []).length, 2);
});

test("de-AT is detected as German", () => {
  const { i18n } = loadI18n({
    languages: ["de-AT", "en-US"],
    navigatorLanguage: "de-AT",
  });

  assert.equal(i18n.normaliseLanguage("de-AT"), "de");
  assert.equal(i18n.detectLanguage(), "de");
  assert.equal(i18n.language, "de");
  assert.match(i18n.locale(), /^de(?:-|$)/i);
});

test("unsupported browser languages fall back to English", () => {
  const { i18n } = loadI18n({
    languages: ["fr-FR", "it-IT"],
    navigatorLanguage: "fr-FR",
  });

  assert.equal(i18n.detectLanguage(), "en");
  assert.equal(i18n.language, "en");
  assert.match(i18n.locale(), /^en(?:-|$)/i);
});

test("a valid saved preference takes precedence and invalid preferences are ignored", () => {
  const preferred = loadI18n({
    languages: ["en-US"],
    navigatorLanguage: "en-US",
    storedLanguage: "de",
  });
  assert.equal(preferred.i18n.language, "de");

  const invalid = loadI18n({
    languages: ["de-AT"],
    navigatorLanguage: "de-AT",
    storedLanguage: "fr",
  });
  assert.equal(invalid.i18n.language, "de");

  const regionalStoredValue = loadI18n({
    languages: ["en-US"],
    navigatorLanguage: "en-US",
    storedLanguage: "de-DE",
  });
  assert.equal(regionalStoredValue.i18n.language, "en");
});

test("apply and live switching update text, title, ARIA, content and selectors", () => {
  const probe = loadI18n();
  const key = Object.keys(probe.i18n.catalog.en)
    .find((candidate) => probe.i18n.catalog.en[candidate] !== probe.i18n.catalog.de[candidate]);
  assert.ok(key, "At least one catalog entry must differ between English and German");

  const textElement = new FakeElement({ "data-lidar-i18n": key }, "fallback");
  const titleElement = new FakeElement({ "data-lidar-i18n-title": key, title: "fallback" });
  const ariaElement = new FakeElement({ "data-lidar-i18n-aria-label": key, "aria-label": "fallback" });
  const contentElement = new FakeElement({ "data-lidar-i18n-content": key, content: "fallback" });
  const headerSelector = new FakeElement({ "data-language-selector": "" });
  const loadingSelector = new FakeElement({ "data-language-selector": "" });
  const elements = [
    textElement,
    titleElement,
    ariaElement,
    contentElement,
    headerSelector,
    loadingSelector,
  ];

  const loaded = loadI18n({ languages: ["en-US"], elements });
  const { i18n, document, localStorage, events } = loaded;

  i18n.apply(document);
  assert.equal(document.documentElement.lang, "en");
  assert.equal(textElement.textContent, i18n.catalog.en[key]);
  assert.equal(titleElement.getAttribute("title"), i18n.catalog.en[key]);
  assert.equal(ariaElement.getAttribute("aria-label"), i18n.catalog.en[key]);
  assert.equal(contentElement.getAttribute("content"), i18n.catalog.en[key]);
  assert.equal(headerSelector.value, "en");
  assert.equal(loadingSelector.value, "en");

  assert.equal(i18n.setLanguage("de"), "de");
  assert.equal(i18n.language, "de");
  assert.equal(document.documentElement.lang, "de");
  assert.equal(textElement.textContent, i18n.catalog.de[key]);
  assert.equal(titleElement.getAttribute("title"), i18n.catalog.de[key]);
  assert.equal(ariaElement.getAttribute("aria-label"), i18n.catalog.de[key]);
  assert.equal(contentElement.getAttribute("content"), i18n.catalog.de[key]);
  assert.equal(headerSelector.value, "de");
  assert.equal(loadingSelector.value, "de");
  assert.equal(localStorage.getItem(STORAGE_KEY), "de");
  assert.equal(events.at(-1).type, "lidar-language-changed");
  assert.equal(events.at(-1).detail.language, "de");

  i18n.setLanguage("en", { persist: false });
  assert.equal(i18n.language, "en");
  assert.equal(localStorage.getItem(STORAGE_KEY), "de");
});

test("language storage remains separate from protected Zenodo access", () => {
  const loaded = loadI18n({ languages: ["en-US"] });
  const accessBefore = loaded.sessionStorage.values.get(ACCESS_KEY);
  const hashBefore = loaded.window.location.hash;
  const hrefBefore = loaded.window.location.href;

  loaded.i18n.apply(loaded.document);
  loaded.i18n.setLanguage("de");

  assert.deepEqual(Array.from(loaded.localStorage.values.keys()), [STORAGE_KEY]);
  assert.equal(loaded.sessionStorage.values.get(ACCESS_KEY), accessBefore);
  assert.deepEqual(loaded.sessionStorage.calls, { get: [], set: [], remove: [] });
  assert.equal(loaded.window.location.hash, hashBefore);
  assert.equal(loaded.window.location.href, hrefBefore);
  assert.deepEqual(loaded.replacements, []);
});

test("the renderer uses no unsafe HTML or code-execution sink", () => {
  assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/);
  assert.doesNotMatch(source, /\bdocument\.write(?:ln)?\s*\(/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\bnew\s+Function\b/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
