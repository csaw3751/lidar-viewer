import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../viewer/area-measurement.js", import.meta.url), "utf8");

const ENGLISH = {
  "area.label3d": "3D {{area}}",
  "area.labelProjectedXY": "XY {{area}}",
  "area.nonPlanarWarning": "⚠ approx.",
  "area.invalidWarning": "3D area unavailable",
};
const GERMAN = {
  "area.label3d": "3D {{area}}",
  "area.labelProjectedXY": "XY {{area}}",
  "area.nonPlanarWarning": "⚠ Näherung",
  "area.invalidWarning": "3D-Fläche nicht verfügbar",
};

function interpolate(template, values) {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

function loadAreaModule(initialLanguage = "en") {
  let language = initialLanguage;
  const window = {};
  Object.defineProperty(window, "LidarViewerI18n", {
    value: {
      get language() { return language; },
      get locale() { return language === "de" ? "de-AT" : "en-GB"; },
      t(key, values = {}) {
        const catalog = language === "de" ? GERMAN : ENGLISH;
        return interpolate(catalog[key] || key, values);
      },
    },
  });
  const context = vm.createContext({ window });
  vm.runInContext(source, context, { filename: "area-measurement.js" });
  return {
    area: window.LidarViewerAreaMeasurement,
    setLanguage(value) { language = value; },
  };
}

function point(x, y, z) {
  return { position: { x, y, z } };
}

function closeTo(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function nativeXYArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index].position;
    const next = points[(index + 1) % points.length].position;
    sum += current.x * next.y - current.y * next.x;
  }
  return Math.abs(sum) / 2;
}

class FakeMeasurement {
  constructor(points) {
    this.points = points;
    this.lengthUnit = { unitspermeter: 1, code: "m" };
    this.lengthUnitDisplay = { unitspermeter: 1, code: "m" };
    this.areaLabel = {
      text: "",
      writes: [],
      setText: (value) => {
        this.areaLabel.writes.push(value);
        this.areaLabel.text = value;
      },
    };
    this.nativeUpdates = 0;
    this.nativeAreaSeen = null;
  }

  getArea() {
    return nativeXYArea(this.points);
  }

  update(marker) {
    this.nativeUpdates += 1;
    this.lastMarker = marker;
    this.nativeAreaSeen = this.getArea();
    this.areaLabel.setText(`native ${this.nativeAreaSeen}`);
    return "native-result";
  }
}

test("calculates horizontal, vertical, and tilted planar areas", () => {
  const { area } = loadAreaModule();
  const horizontal = area.analyse([
    point(0, 0, 0), point(3, 0, 0), point(3, 2, 0), point(0, 2, 0),
  ]);
  assert.equal(horizontal.valid, true);
  closeTo(horizontal.area3d, 6);
  closeTo(horizontal.areaXY, 6);
  assert.equal(horizontal.nonPlanar, false);

  const vertical = area.analyse([
    point(0, 0, 0), point(3, 0, 0), point(3, 0, 2), point(0, 0, 2),
  ]);
  closeTo(vertical.area3d, 6);
  closeTo(vertical.areaXY, 0);
  assert.equal(vertical.nonPlanar, false);

  const cosine = 0.5;
  const sine = Math.sqrt(3) / 2;
  const tilted = area.analyse([
    point(0, 0, 0),
    point(3, 0, 0),
    point(3, 2 * cosine, 2 * sine),
    point(0, 2 * cosine, 2 * sine),
  ]);
  closeTo(tilted.area3d, 6);
  closeTo(tilted.areaXY, 3);
  assert.equal(tilted.nonPlanar, false);
});

test("handles concave polygons, reverse winding, duplicates, and large offsets", () => {
  const { area } = loadAreaModule();
  const concave = [
    point(0, 0, 0), point(3, 0, 0), point(3, 1, 0),
    point(1, 1, 0), point(1, 3, 0), point(0, 3, 0),
  ];
  closeTo(area.analyse(concave).area3d, 5);
  closeTo(area.analyse([...concave].reverse()).area3d, 5);

  const repeated = [...concave.slice(0, 2), concave[1], ...concave.slice(2)];
  closeTo(area.analyse(repeated).area3d, 5);

  const offset = 1_000_000_000;
  const shifted = [
    point(offset, offset, offset),
    point(offset + 3, offset, offset),
    point(offset + 3, offset + 2, offset),
    point(offset, offset + 2, offset),
  ];
  closeTo(area.analyse(shifted).area3d, 6);
});

test("flags clearly non-planar polygons but tolerates small LiDAR placement noise", () => {
  const { area } = loadAreaModule();
  const nearlyPlanar = area.analyse([
    point(0, 0, 0), point(2, 0, 0), point(2, 2, 0.01), point(0, 2, 0),
  ]);
  assert.equal(nearlyPlanar.valid, true);
  assert.equal(nearlyPlanar.nonPlanar, false);
  assert.ok(nearlyPlanar.planeThickness <= nearlyPlanar.planarityTolerance);

  const twisted = area.analyse([
    point(0, 0, 0), point(2, 0, 0), point(2, 2, 0.2), point(0, 2, 0),
  ]);
  assert.equal(twisted.valid, true);
  assert.equal(twisted.nonPlanar, true);
  assert.equal(twisted.approximate, true);
  assert.ok(twisted.planeThickness > twisted.planarityTolerance);
});

test("uses source units when applying the absolute planarity tolerance", () => {
  const { area } = loadAreaModule();
  const millimetres = [
    point(0, 0, 0), point(200, 0, 0), point(200, 200, 10), point(0, 200, 0),
  ];
  const analysis = area.analyse(millimetres, {
    unitsPerMeter: 1000,
    relativeTolerance: 0,
  });
  assert.equal(analysis.nonPlanar, false);
  closeTo(analysis.planarityTolerance, 20);
});

test("rejects incomplete, non-finite, and degenerate polygons", () => {
  const { area } = loadAreaModule();
  assert.equal(area.analyse([point(0, 0, 0), point(1, 0, 0)]).reason, "too_few_points");
  assert.equal(area.analyse([
    point(0, 0, 0), point(1, 0, 0), point(Number.NaN, 1, 0),
  ]).reason, "non_finite_point");
  const collinear = area.analyse([
    point(0, 0, 0), point(1, 1, 1), point(2, 2, 2),
  ]);
  assert.equal(collinear.valid, false);
  assert.equal(collinear.reason, "degenerate_polygon");
});

test("formats units, locale, warnings, and invalid results without mutating analysis", () => {
  const { area } = loadAreaModule();
  const analysis = area.analyse([
    point(0, 0, 0), point(3, 0, 0), point(3, 2, 0), point(0, 2, 0),
  ]);
  assert.equal(
    area.format(analysis),
    "3D 6.00 m² · XY 6.00 m²",
  );
  assert.equal(
    area.format(analysis, {
      locale: "de-AT",
      displayUnitsPerMeter: 100,
      unitCode: "cm",
      translate: (key, values) => interpolate(GERMAN[key], values),
    }).replace(/\s/g, " "),
    "3D 60 000,00 cm² · XY 60 000,00 cm²",
  );
  assert.equal(Object.isFrozen(analysis), true);

  const invalid = area.analyse([point(0, 0, 0)]);
  assert.equal(area.format(invalid), "3D area unavailable");
});

test("enhances only the instance, preserves native updates, and is idempotent", () => {
  const { area } = loadAreaModule();
  const measurement = new FakeMeasurement([
    point(0, 0, 0), point(3, 0, 0), point(3, 0, 2), point(0, 0, 2),
  ]);
  assert.equal(measurement.getArea(), 0);
  assert.equal(Object.hasOwn(measurement, "getArea"), false);

  const returned = area.enhance(measurement);
  assert.equal(returned, measurement);
  assert.equal(measurement.nativeUpdates, 1);
  closeTo(measurement.nativeAreaSeen, 6);
  closeTo(measurement.getArea(), 6);
  assert.equal(measurement.areaLabel.text, "3D 6.00 m² · XY 0.00 m²");
  assert.equal(Object.prototype.propertyIsEnumerable.call(measurement, "getArea"), false);
  assert.equal(Object.prototype.propertyIsEnumerable.call(measurement, "update"), false);

  const enhancedUpdate = measurement.update;
  area.enhance(measurement);
  assert.equal(measurement.update, enhancedUpdate);
  assert.equal(measurement.nativeUpdates, 1);
  assert.equal(measurement.update("marker"), "native-result");
  assert.equal(measurement.nativeUpdates, 2);
  assert.equal(measurement.lastMarker, "marker");
  assert.equal(measurement.areaLabel.text, "3D 6.00 m² · XY 0.00 m²");
  assert.equal(measurement.areaLabel.writes.length, 3);
  assert.equal(measurement.areaLabel.writes.some((value) => value.startsWith("native ")), false);
});

test("exposes measurement analysis and formats deviations in display units", () => {
  const { area } = loadAreaModule();
  const measurement = new FakeMeasurement([
    point(0, 0, 0), point(2, 0, 0), point(2, 2, 0.2), point(0, 2, 0),
  ]);
  measurement.lengthUnitDisplay = { unitspermeter: 100, code: "cm" };
  const analysis = area.analyseMeasurement(measurement);
  assert.equal(analysis.nonPlanar, true);
  assert.equal(area.formatLength(analysis.maximumDeviation, measurement), "4.988 cm");
  assert.equal(area.formatLength(Number.NaN, measurement), "–");
});

test("refresh switches the enhanced label live between English and German", () => {
  const { area, setLanguage } = loadAreaModule("en");
  const measurement = new FakeMeasurement([
    point(0, 0, 0), point(2, 0, 0), point(2, 2, 0.2), point(0, 2, 0),
  ]);
  area.enhance(measurement);
  assert.match(measurement.areaLabel.text, /⚠ approx\.$/);

  setLanguage("de");
  const analysis = area.refresh(measurement);
  assert.equal(analysis.nonPlanar, true);
  assert.match(measurement.areaLabel.text, /^3D /);
  assert.match(measurement.areaLabel.text, /⚠ Näherung$/);
  assert.match(measurement.areaLabel.text, /,/);
});

test("refresh ignores unenhanced objects and enhance validates its input", () => {
  const { area } = loadAreaModule();
  assert.equal(area.refresh(new FakeMeasurement([])), null);
  assert.throws(() => area.enhance(null), /Potree-compatible/);
  assert.throws(() => area.enhance({ points: [] }), /Potree-compatible/);
});
