import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../viewer/i18n.js", import.meta.url), "utf8");
const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

class FakeTextNode {
  constructor(value, parent) {
    this.nodeType = 3;
    this.nodeValue = value;
    this.parentElement = parent;
  }
}

class FakeElement {
  constructor(tagName = "DIV", attributes = {}, text = "") {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.id = attributes.id || "";
    this.attributes = new Map(Object.entries(attributes));
    this.attributeWrites = [];
    this.childNodes = [];
    if (text) this.childNodes.push(new FakeTextNode(text, this));
  }

  get textContent() {
    return this.childNodes.map((node) => node.nodeValue || "").join("");
  }

  set textContent(value) {
    this.childNodes = [new FakeTextNode(String(value), this)];
  }

  get value() {
    return this.attributes.has("value")
      ? this.attributes.get("value")
      : this.textContent;
  }

  set value(value) {
    this.setAttribute("value", value);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributeWrites.push({
      name,
      previousValue: this.getAttribute(name),
      value: stringValue,
    });
    this.attributes.set(name, stringValue);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  matches(selector) {
    if (selector === 'input[type="button"], input[type="submit"]') {
      return this.tagName === "INPUT"
        && ["button", "submit"].includes(this.getAttribute("type"));
    }
    return false;
  }

  closest() {
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

function makeDocument(elements = []) {
  const documentElement = new FakeElement("HTML");
  documentElement.lang = "en";
  const body = new FakeElement("BODY");
  return {
    body,
    documentElement,
    readyState: "complete",
    addEventListener: () => {},
    getElementById: (id) => elements.find((element) => element.id === id) || null,
    querySelectorAll: (selector) => {
      const match = /^\[([^\]]+)\]$/.exec(selector);
      return match ? elements.filter((element) => element.hasAttribute(match[1])) : [];
    },
  };
}

function loadI18n({
  languages = ["en-GB"],
  language = languages[0] || "",
  storedLanguage = null,
  elements = [],
  observeMutations = false,
} = {}) {
  const storage = makeStorage(storedLanguage
    ? { "lidar-viewer.language.v1": storedLanguage }
    : {});
  const document = makeDocument(elements);
  const window = {
    document,
    localStorage: storage,
    navigator: { languages, language },
  };
  const mutationObservers = [];
  if (observeMutations) {
    window.MutationObserver = class FakeMutationObserver {
      constructor(callback) {
        this.callback = callback;
        this.observations = [];
        mutationObservers.push(this);
      }

      observe(target, options) {
        this.observations.push({ target, options });
      }

      trigger(mutations) {
        this.callback(mutations);
      }
    };
  }
  const context = vm.createContext({
    window,
    document,
    console,
    Object,
    Array,
    String,
    Map,
    Set,
    RegExp,
  });
  vm.runInContext(source, context, { filename: "i18n.js" });
  return { i18n: window.LidarViewerI18n, storage, document, mutationObservers };
}

test("selects the first supported browser language and otherwise falls back to English", () => {
  assert.equal(loadI18n({ languages: ["fr-FR", "de-AT", "en-US"] }).i18n.language, "de");
  assert.equal(loadI18n({ languages: ["fr-FR", "it-IT"] }).i18n.language, "en");
  assert.equal(loadI18n({ languages: ["en-US", "de-AT"] }).i18n.language, "en");
  assert.equal(loadI18n({ languages: [], language: "de-CH" }).i18n.language, "de");
});

test("a valid stored preference wins and an unsupported value is ignored", () => {
  assert.equal(loadI18n({ languages: ["en-US"], storedLanguage: "de" }).i18n.language, "de");
  assert.equal(loadI18n({ languages: ["de-AT"], storedLanguage: "fr" }).i18n.language, "de");
});

test("normalises regional tags, persists only supported values and uses English fallback", () => {
  const { i18n, storage } = loadI18n({ languages: ["de-AT"] });
  assert.equal(i18n.normaliseLanguage("de-DE"), "de");
  assert.equal(i18n.normaliseLanguage("en-US"), "en");
  assert.equal(i18n.normaliseLanguage("pl-PL"), "en");
  assert.equal(i18n.t("app.name", {}, "fr-FR"), "Protected LiDAR Viewer");

  i18n.setLanguage("unsupported");
  assert.equal(i18n.language, "en");
  assert.equal(storage.getItem(i18n.languageStorageKey), "en");
});

test("English and German catalogs have complete, non-empty key parity", () => {
  const { i18n } = loadI18n();
  const englishKeys = Object.keys(i18n.catalogs.en).sort();
  const germanKeys = Object.keys(i18n.catalogs.de).sort();
  assert.deepEqual(germanKeys, englishKeys);
  for (const key of englishKeys) {
    assert.ok(i18n.catalogs.en[key], `empty English translation: ${key}`);
    assert.ok(i18n.catalogs.de[key], `empty German translation: ${key}`);
  }
});

test("every first-party HTML translation binding resolves in both catalogs", () => {
  const { i18n } = loadI18n();
  const keys = [...html.matchAll(/data-lidar-i18n(?:-[a-z-]+)?="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.ok(keys.length > 50);
  for (const key of keys) {
    assert.ok(Object.hasOwn(i18n.catalogs.en, key), `missing English key: ${key}`);
    assert.ok(Object.hasOwn(i18n.catalogs.de, key), `missing German key: ${key}`);
  }
});

test("updates text and safe attributes without translated HTML injection", () => {
  const text = new FakeElement("SPAN", { "data-lidar-i18n": "quality.high" }, "High");
  const button = new FakeElement("BUTTON", {
    "data-lidar-i18n-title": "language.switchToGerman",
    "data-lidar-i18n-aria-label": "language.switchToGerman",
  });
  const { i18n, document } = loadI18n({ languages: ["en"], elements: [text, button] });

  i18n.setLanguage("de", { persist: false });
  assert.equal(text.textContent, "Hoch");
  assert.equal(button.getAttribute("title"), "Zu Deutsch wechseln");
  assert.equal(button.getAttribute("aria-label"), "Zu Deutsch wechseln");
  assert.equal(document.documentElement.lang, "de");
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test("Potree option translation preserves semantic values and unknown labels", () => {
  const { i18n } = loadI18n();
  const known = new FakeElement("OPTION", {}, "ADAPTIVE");
  const unknown = new FakeElement("OPTION", {}, "custom_attribute_17");

  i18n.setLanguage("de", { persist: false });
  i18n.translatePotree(known);
  i18n.translatePotree(unknown);
  assert.equal(known.textContent, "Adaptiv");
  assert.equal(known.value, "ADAPTIVE");
  assert.equal(unknown.textContent, "custom_attribute_17");
  assert.equal(unknown.hasAttribute("value"), false);

  i18n.setLanguage("en", { persist: false });
  i18n.translatePotree(known);
  assert.equal(known.textContent, "ADAPTIVE");
  assert.equal(known.value, "ADAPTIVE");
});

test("translates real Potree punctuation, generated messages, and image tooltips", () => {
  const cases = [
    { element: new FakeElement("SPAN", {}, "Intensity:"), german: "Intensität:", english: "Intensity:" },
    { element: new FakeElement("SPAN", {}, "Classification:"), german: "Klassifizierung:", english: "Classification:" },
    { element: new FakeElement("SPAN", {}, "transition:"), german: "Übergang:", english: "transition:" },
    { element: new FakeElement("SPAN", {}, "status: 404"), german: "Status: 404", english: "status: 404" },
    { element: new FakeElement("SPAN", {}, "message: unavailable"), german: "Meldung: unavailable", english: "message: unavailable" },
  ];
  const copy = new FakeElement("IMG", { title: "copy" });
  const { i18n } = loadI18n({ languages: ["en-GB"] });

  i18n.setLanguage("de", { persist: false });
  cases.forEach(({ element }) => i18n.translatePotree(element));
  i18n.translatePotree(copy);
  cases.forEach(({ element, german }) => assert.equal(element.textContent, german));
  assert.equal(copy.getAttribute("title"), "Kopieren");
  assert.equal(copy.getAttribute("aria-label"), "Kopieren");
  assert.equal(copy.getAttribute("alt"), "Kopieren");

  i18n.setLanguage("en", { persist: false });
  cases.forEach(({ element }) => i18n.translatePotree(element));
  i18n.translatePotree(copy);
  cases.forEach(({ element, english }) => assert.equal(element.textContent, english));
  assert.equal(copy.getAttribute("title"), "copy");
});

test("Potree MutationObserver callbacks do not repeat same-value attribute writes", () => {
  const titled = new FakeElement("IMG", {
    id: "closeProfileContainer",
    title: "Close profile",
    "aria-label": "Close profile",
  });
  const action = new FakeElement("INPUT", {
    type: "button",
    value: "Show",
  });
  const { i18n, mutationObservers } = loadI18n({
    languages: ["de-AT"],
    observeMutations: true,
  });

  i18n.observePotree(titled);
  i18n.observePotree(action);
  assert.equal(titled.getAttribute("title"), "Profil schließen");
  assert.equal(titled.getAttribute("aria-label"), "Profil schließen");
  assert.equal(action.value, "Anzeigen");

  const attributeObserver = mutationObservers.find((observer) => (
    observer.observations.some(({ options }) => Array.isArray(options.attributeFilter))
  ));
  assert.ok(attributeObserver, "Potree attribute observer was not installed");
  const writesBefore = {
    title: titled.attributeWrites.filter(({ name }) => name === "title").length,
    ariaLabel: titled.attributeWrites.filter(({ name }) => name === "aria-label").length,
    value: action.attributeWrites.filter(({ name }) => name === "value").length,
  };

  attributeObserver.trigger([
    { type: "attributes", attributeName: "title", target: titled },
    { type: "attributes", attributeName: "aria-label", target: titled },
    { type: "attributes", attributeName: "value", target: action },
  ]);

  assert.equal(
    titled.attributeWrites.filter(({ name }) => name === "title").length,
    writesBefore.title,
  );
  assert.equal(
    titled.attributeWrites.filter(({ name }) => name === "aria-label").length,
    writesBefore.ariaLabel,
  );
  assert.equal(
    action.attributeWrites.filter(({ name }) => name === "value").length,
    writesBefore.value,
  );
});

test("colliding Potree option labels round-trip losslessly without changing semantic values", () => {
  const cases = [
    { english: "Skybox", german: "Himmel" },
    { english: "elevation", german: "Höhe" },
    { english: "default", german: "Standard" },
  ];
  const options = cases.map(({ english }) => new FakeElement("OPTION", {}, english));
  const { i18n } = loadI18n({ languages: ["en-GB"] });

  i18n.setLanguage("de", { persist: false });
  options.forEach((option) => i18n.translatePotree(option));
  options.forEach((option, index) => {
    assert.equal(option.textContent, cases[index].german);
    assert.equal(option.value, cases[index].english);
  });

  i18n.setLanguage("en", { persist: false });
  options.forEach((option) => i18n.translatePotree(option));
  options.forEach((option, index) => {
    assert.equal(option.textContent, cases[index].english);
    assert.equal(option.value, cases[index].english);
  });
});
