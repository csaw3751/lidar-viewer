(function () {
  "use strict";

  const ABSOLUTE_PLANARITY_TOLERANCE_METRES = 0.02;
  const RELATIVE_PLANARITY_TOLERANCE = 0.01;
  const AREA_EPSILON_FACTOR = 64 * Number.EPSILON;
  const enhancedMeasurements = new WeakMap();

  const ENGLISH_FALLBACKS = Object.freeze({
    "area.label3d": "3D {{area}}",
    "area.labelProjectedXY": "XY {{area}}",
    "area.nonPlanarWarning": "⚠ approx.",
    "area.invalidWarning": "3D area unavailable",
  });

  function interpolate(template, values) {
    return String(template).replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key) => (
      Object.hasOwn(values, key) ? String(values[key]) : match
    ));
  }

  function positiveFinite(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function nonNegativeFinite(value, fallback) {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function invalidAnalysis(reason, pointCount) {
    return Object.freeze({
      valid: false,
      reason,
      pointCount,
      area3d: 0,
      areaXY: 0,
      span: 0,
      normal: null,
      maximumDeviation: 0,
      planeThickness: 0,
      planarityTolerance: 0,
      nonPlanar: false,
      approximate: false,
    });
  }

  function coordinates(point) {
    const candidate = point && point.position ? point.position : point;
    if (Array.isArray(candidate)) {
      if (candidate.length < 3 || !candidate.slice(0, 3).every(Number.isFinite)) return null;
      return { x: candidate[0], y: candidate[1], z: candidate[2] };
    }
    if (!candidate || !Number.isFinite(candidate.x)
      || !Number.isFinite(candidate.y) || !Number.isFinite(candidate.z)) {
      return null;
    }
    return { x: candidate.x, y: candidate.y, z: candidate.z };
  }

  /**
   * Calculates the vector area of an ordered 3D polygon and its XY projection.
   * The 3D result is exact for a simple planar polygon, including concave ones.
   */
  function analyse(points, options = {}) {
    if (!Array.isArray(points) || points.length < 3) {
      return invalidAnalysis("too_few_points", Array.isArray(points) ? points.length : 0);
    }

    const positions = points.map(coordinates);
    if (positions.some((point) => point === null)) {
      return invalidAnalysis("non_finite_point", points.length);
    }

    // Average offsets from the first vertex to retain precision for large coordinates.
    const origin = positions[0];
    let offsetX = 0;
    let offsetY = 0;
    let offsetZ = 0;
    positions.forEach((point) => {
      offsetX += point.x - origin.x;
      offsetY += point.y - origin.y;
      offsetZ += point.z - origin.z;
    });
    const centroid = {
      x: origin.x + offsetX / positions.length,
      y: origin.y + offsetY / positions.length,
      z: origin.z + offsetZ / positions.length,
    };
    const centred = positions.map((point) => ({
      x: point.x - centroid.x,
      y: point.y - centroid.y,
      z: point.z - centroid.z,
    }));

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    centred.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      minZ = Math.min(minZ, point.z);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      maxZ = Math.max(maxZ, point.z);
    });
    const span = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);

    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    for (let index = 0; index < centred.length; index += 1) {
      const current = centred[index];
      const next = centred[(index + 1) % centred.length];
      sumX += current.y * next.z - current.z * next.y;
      sumY += current.z * next.x - current.x * next.z;
      sumZ += current.x * next.y - current.y * next.x;
    }

    const twiceArea = Math.hypot(sumX, sumY, sumZ);
    const area3d = 0.5 * twiceArea;
    const areaXY = 0.5 * Math.abs(sumZ);
    const areaEpsilon = AREA_EPSILON_FACTOR * Math.max(1, span * span);
    if (!Number.isFinite(area3d) || !Number.isFinite(areaXY) || area3d <= areaEpsilon) {
      return invalidAnalysis("degenerate_polygon", points.length);
    }

    const normal = Object.freeze({
      x: sumX / twiceArea,
      y: sumY / twiceArea,
      z: sumZ / twiceArea,
    });
    let minimumDistance = Infinity;
    let maximumDistance = -Infinity;
    let maximumDeviation = 0;
    centred.forEach((point) => {
      const distance = point.x * normal.x + point.y * normal.y + point.z * normal.z;
      minimumDistance = Math.min(minimumDistance, distance);
      maximumDistance = Math.max(maximumDistance, distance);
      maximumDeviation = Math.max(maximumDeviation, Math.abs(distance));
    });

    const unitsPerMeter = positiveFinite(options.unitsPerMeter, 1);
    const absoluteToleranceMetres = nonNegativeFinite(
      options.absoluteToleranceMetres,
      ABSOLUTE_PLANARITY_TOLERANCE_METRES,
    );
    const relativeTolerance = nonNegativeFinite(
      options.relativeTolerance,
      RELATIVE_PLANARITY_TOLERANCE,
    );
    const planeThickness = maximumDistance - minimumDistance;
    const planarityTolerance = Math.max(
      absoluteToleranceMetres * unitsPerMeter,
      relativeTolerance * span,
    );
    const nonPlanar = planeThickness > planarityTolerance;

    return Object.freeze({
      valid: true,
      reason: null,
      pointCount: points.length,
      area3d,
      areaXY,
      span,
      normal,
      maximumDeviation,
      planeThickness,
      planarityTolerance,
      nonPlanar,
      approximate: nonPlanar,
    });
  }

  function fallbackTranslation(key, values) {
    return interpolate(ENGLISH_FALLBACKS[key] || key, values);
  }

  function localisedNumber(value, locale, minimumFractionDigits = 2, maximumFractionDigits = 2) {
    try {
      return new Intl.NumberFormat(locale || "en-GB", {
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(value);
    } catch (_error) {
      return value.toFixed(maximumFractionDigits);
    }
  }

  /** Formats an analysis without changing either the analysis or a measurement. */
  function format(analysis, options = {}) {
    const translate = typeof options.translate === "function"
      ? options.translate : fallbackTranslation;
    const translateWithFallback = (key, values = {}) => {
      const translated = translate(key, values);
      return translated && translated !== key
        ? translated : fallbackTranslation(key, values);
    };
    if (!analysis || !analysis.valid) return translateWithFallback("area.invalidWarning");

    const sourceUnitsPerMeter = positiveFinite(options.sourceUnitsPerMeter, 1);
    const displayUnitsPerMeter = positiveFinite(options.displayUnitsPerMeter, 1);
    const areaScale = Math.pow(displayUnitsPerMeter / sourceUnitsPerMeter, 2);
    const unitCode = typeof options.unitCode === "string" && options.unitCode.trim()
      ? options.unitCode.trim() : "m";
    const suffix = ` ${unitCode}\u00B2`;
    const area3d = `${localisedNumber(analysis.area3d * areaScale, options.locale)}${suffix}`;
    const projected = `${localisedNumber(analysis.areaXY * areaScale, options.locale)}${suffix}`;
    const parts = [
      translateWithFallback("area.label3d", { area: area3d }),
      translateWithFallback("area.labelProjectedXY", { area: projected }),
    ];
    if (analysis.nonPlanar) parts.push(translateWithFallback("area.nonPlanarWarning"));
    return parts.join(" · ");
  }

  function measurementUnits(measurement) {
    const source = measurement && measurement.lengthUnit;
    const display = measurement && measurement.lengthUnitDisplay;
    return {
      sourceUnitsPerMeter: positiveFinite(source && source.unitspermeter, 1),
      displayUnitsPerMeter: positiveFinite(display && display.unitspermeter, 1),
      unitCode: (display && display.code) || (source && source.code) || "m",
    };
  }

  /** Formats a source-coordinate length in the measurement's displayed unit. */
  function formatLength(value, measurement, options = {}) {
    if (!Number.isFinite(value)) return "–";
    const units = measurementUnits(measurement);
    const sourceUnitsPerMeter = positiveFinite(
      options.sourceUnitsPerMeter,
      units.sourceUnitsPerMeter,
    );
    const displayUnitsPerMeter = positiveFinite(
      options.displayUnitsPerMeter,
      units.displayUnitsPerMeter,
    );
    const unitCode = typeof options.unitCode === "string" && options.unitCode.trim()
      ? options.unitCode.trim() : units.unitCode;
    const i18n = window.LidarViewerI18n;
    const locale = options.locale || (i18n && i18n.locale) || "en-GB";
    const minimumFractionDigits = Number.isInteger(options.minimumFractionDigits)
      ? options.minimumFractionDigits : 3;
    const maximumFractionDigits = Number.isInteger(options.maximumFractionDigits)
      ? options.maximumFractionDigits : 3;
    const converted = value * displayUnitsPerMeter / sourceUnitsPerMeter;
    return `${localisedNumber(
      converted,
      locale,
      minimumFractionDigits,
      maximumFractionDigits,
    )} ${unitCode}`;
  }

  function runtimeTranslation(key, values) {
    const i18n = window.LidarViewerI18n;
    if (!i18n || typeof i18n.t !== "function") return fallbackTranslation(key, values);
    const translated = i18n.t(key, values);
    return translated && translated !== key ? translated : fallbackTranslation(key, values);
  }

  function analyseMeasurement(measurement, options = {}) {
    const units = measurementUnits(measurement);
    return analyse(measurement && measurement.points, {
      unitsPerMeter: units.sourceUnitsPerMeter,
      absoluteToleranceMetres: options.absoluteToleranceMetres,
      relativeTolerance: options.relativeTolerance,
    });
  }

  function renderMeasurement(measurement, record) {
    const analysis = analyseMeasurement(measurement, record.options);
    if (!measurement.areaLabel || typeof measurement.areaLabel.setText !== "function") {
      return analysis;
    }
    const i18n = window.LidarViewerI18n;
    const units = measurementUnits(measurement);
    measurement.areaLabel.setText(format(analysis, {
      ...units,
      locale: record.options.locale || (i18n && i18n.locale) || "en-GB",
      translate: record.options.translate || runtimeTranslation,
    }));
    return analysis;
  }

  /**
   * Adds an instance-level 3D getArea implementation while preserving Potree's
   * own update work. Calling enhance repeatedly never installs another wrapper.
   */
  function enhance(measurement, options = {}) {
    if (!measurement || !Array.isArray(measurement.points)
      || typeof measurement.update !== "function") {
      throw new TypeError("A Potree-compatible area measurement is required.");
    }

    const existing = enhancedMeasurements.get(measurement);
    if (existing) {
      existing.options = { ...existing.options, ...options };
      refresh(measurement);
      return measurement;
    }

    const record = {
      nativeUpdate: measurement.update,
      options: { ...options },
    };
    enhancedMeasurements.set(measurement, record);

    Object.defineProperty(measurement, "getArea", {
      configurable: true,
      enumerable: false,
      writable: true,
      value() {
        const current = enhancedMeasurements.get(this);
        const analysis = analyseMeasurement(this, current ? current.options : {});
        return analysis.valid ? analysis.area3d : 0;
      },
    });
    Object.defineProperty(measurement, "update", {
      configurable: true,
      enumerable: false,
      writable: true,
      value(...args) {
        const current = enhancedMeasurements.get(this);
        const label = this.areaLabel;
        const nativeSetText = label && typeof label.setText === "function"
          ? label.setText : null;
        if (nativeSetText) label.setText = () => {};
        let result;
        try {
          // Potree otherwise replaces the enhanced label immediately before us
          // on every frame, needlessly recreating two canvas textures each time.
          result = current.nativeUpdate.apply(this, args);
        } finally {
          if (nativeSetText) label.setText = nativeSetText;
        }
        renderMeasurement(this, current);
        return result;
      },
    });

    measurement.update();
    return measurement;
  }

  /** Refreshes the composite label and returns the current analysis. */
  function refresh(measurement) {
    const record = enhancedMeasurements.get(measurement);
    return record ? renderMeasurement(measurement, record) : null;
  }

  window.LidarViewerAreaMeasurement = Object.freeze({
    analyse,
    analyseMeasurement,
    enhance,
    format,
    formatLength,
    refresh,
  });
})();
