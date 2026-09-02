(function () {
  "use strict";

  const QUALITY_STORAGE_KEY = "lidar-viewer.render-quality.v1";
  const I18N = window.LidarViewerI18n;
  const AreaMeasurement = window.LidarViewerAreaMeasurement;
  const CORE_ENGLISH_FALLBACK = Object.freeze({
    "error.startTitle": "Viewer could not start",
    "error.startMessage": "A local viewer dependency is missing or could not be loaded.",
  });
  const DEFAULT_QUALITY_PROFILES = Object.freeze({
    auto: Object.freeze({
      desktopPointBudget: 3_500_000,
      compactPointBudget: 1_200_000,
      minNodeSize: 20,
      pointSize: 0.85,
      shape: "CIRCLE",
    }),
    high: Object.freeze({
      desktopPointBudget: 5_500_000,
      compactPointBudget: 2_000_000,
      minNodeSize: 10,
      pointSize: 0.72,
      shape: "CIRCLE",
    }),
    maximum: Object.freeze({
      desktopPointBudget: 9_000_000,
      compactPointBudget: 3_500_000,
      minNodeSize: 5,
      pointSize: 0.62,
      shape: "CIRCLE",
    }),
  });

  const runtimeConfig = window.LIDAR_VIEWER_CONFIG || {};
  const runtimeProfiles = runtimeConfig.qualityProfiles || {};
  const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const normaliseQualityProfile = (mode) => {
    const defaults = DEFAULT_QUALITY_PROFILES[mode];
    const configured = runtimeProfiles[mode] || {};
    const shape = ["SQUARE", "CIRCLE", "PARABOLOID"].includes(configured.shape)
      ? configured.shape : defaults.shape;
    return Object.freeze({
      customLabel: typeof configured.label === "string" && configured.label.trim()
        ? configured.label.trim() : null,
      desktopPointBudget: finiteOr(configured.desktopPointBudget, defaults.desktopPointBudget),
      compactPointBudget: finiteOr(configured.compactPointBudget, defaults.compactPointBudget),
      minNodeSize: finiteOr(configured.minNodeSize, defaults.minNodeSize),
      pointSize: finiteOr(configured.pointSize, defaults.pointSize),
      shape,
    });
  };
  const QUALITY_PROFILES = Object.freeze({
    auto: normaliseQualityProfile("auto"),
    high: normaliseQualityProfile("high"),
    maximum: normaliseQualityProfile("maximum"),
  });
  const CONFIG = Object.freeze({
    name: typeof runtimeConfig.name === "string" && runtimeConfig.name.trim()
      ? runtimeConfig.name.trim() : null,
    manifestFile: runtimeConfig.manifestFile || "viewer-manifest.json",
    loadTimeoutMs: Number.isFinite(runtimeConfig.loadTimeoutMs) ? runtimeConfig.loadTimeoutMs : 180_000,
    defaultQuality: Object.hasOwn(QUALITY_PROFILES, runtimeConfig.defaultQuality)
      ? runtimeConfig.defaultQuality : "auto",
  });
  const ATTRIBUTE_LABEL_KEYS = Object.freeze({
    position: "attribute.position",
    intensity: "attribute.intensity",
    classification: "attribute.classification",
    returnnumber: "attribute.returnNumber",
    numberofreturns: "attribute.numberOfReturns",
    sourceid: "attribute.sourceId",
    pointsourceid: "attribute.pointSourceId",
    gpstime: "attribute.gpsTime",
    rgb: "info.rgbColour",
    rgba: "info.rgbaColour",
  });

  const state = {
    viewer: null,
    metadata: null,
    pointcloud: null,
    source: null,
    catalog: null,
    dataset: null,
    ready: false,
    activeTool: null,
    activeInsertionCleanup: null,
    compactDevice: false,
    qualityMode: CONFIG.defaultQuality,
    qualityProfile: QUALITY_PROFILES[CONFIG.defaultQuality],
    status: Object.freeze({ key: "status.loading", values: {}, tone: "" }),
    loading: Object.freeze({
      titleKey: "loading.title",
      messageKey: "loading.initial",
      retry: false,
    }),
    guiReady: false,
    localisedObjects: new Map(),
    areaMeasurements: new Set(),
    completedAreaMeasurements: new WeakSet(),
    statusAreaMeasurement: null,
  };

  const byId = (id) => document.getElementById(id);
  const toolButtons = () => Array.from(document.querySelectorAll("[data-tool]"));
  const actionButtons = () => Array.from(document.querySelectorAll("[data-action]"));

  function t(key, values = {}) {
    if (I18N) return I18N.t(key, values);
    const template = CORE_ENGLISH_FALLBACK[key] || key;
    return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, name) => (
      Object.hasOwn(values, name) ? String(values[name]) : match
    ));
  }

  function englishText(key) {
    return I18N && I18N.catalogs.en[key] ? I18N.catalogs.en[key] : (CORE_ENGLISH_FALLBACK[key] || key);
  }

  function qualityLabel(mode = state.qualityMode, profile = state.qualityProfile) {
    return profile.customLabel || t(`quality.${mode}`);
  }

  function formatInteger(value) {
    return new Intl.NumberFormat(I18N ? I18N.locale : "en-GB", {
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatMeters(value) {
    return new Intl.NumberFormat(I18N ? I18N.locale : "en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + " m";
  }

  function formatArea(value, measurement) {
    const rawSourceUnits = measurement && measurement.lengthUnit
      && measurement.lengthUnit.unitspermeter;
    const rawDisplayUnits = measurement && measurement.lengthUnitDisplay
      && measurement.lengthUnitDisplay.unitspermeter;
    const sourceUnitsPerMeter = Number.isFinite(rawSourceUnits) && rawSourceUnits > 0
      ? rawSourceUnits : 1;
    const displayUnitsPerMeter = Number.isFinite(rawDisplayUnits) && rawDisplayUnits > 0
      ? rawDisplayUnits : 1;
    const unitCode = measurement && measurement.lengthUnitDisplay
      && measurement.lengthUnitDisplay.code
      ? measurement.lengthUnitDisplay.code : "m";
    const converted = value / Math.pow(sourceUnitsPerMeter, 2)
      * Math.pow(displayUnitsPerMeter, 2);
    return new Intl.NumberFormat(I18N ? I18N.locale : "en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted) + ` ${unitCode}\u00B2`;
  }

  function announceAreaMeasurement(measurement) {
    if (!AreaMeasurement) return;
    const analysis = AreaMeasurement.analyseMeasurement(measurement);
    if (!analysis.valid) {
      setStatus("status.areaInvalid", {}, "warning");
      state.statusAreaMeasurement = measurement;
      return;
    }

    const values = {
      area: formatArea(analysis.area3d, measurement),
      projected: formatArea(analysis.areaXY, measurement),
    };
    if (analysis.nonPlanar) {
      values.deviation = AreaMeasurement.formatLength(analysis.maximumDeviation, measurement, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setStatus("status.areaNonPlanar", values, "warning");
      state.statusAreaMeasurement = measurement;
      return;
    }
    setStatus("status.areaMeasured", values, "ready");
    state.statusAreaMeasurement = measurement;
  }

  function readQualityPreference() {
    try {
      const saved = window.localStorage.getItem(QUALITY_STORAGE_KEY);
      return Object.hasOwn(QUALITY_PROFILES, saved) ? saved : CONFIG.defaultQuality;
    } catch (_error) {
      return CONFIG.defaultQuality;
    }
  }

  function saveQualityPreference(mode) {
    try {
      window.localStorage.setItem(QUALITY_STORAGE_KEY, mode);
    } catch (_error) {
      // The viewer still works when persistent browser storage is blocked.
    }
  }

  function activePointBudget(profile) {
    return state.compactDevice ? profile.compactPointBudget : profile.desktopPointBudget;
  }

  function updateQualityInfo(profile, pointBudget) {
    const info = byId("info-quality");
    if (!info) return;
    info.textContent = t("quality.info", {
      quality: qualityLabel(state.qualityMode, profile),
      points: formatInteger(pointBudget),
    });
  }

  function applyQuality(mode, { persist = false, announce = false } = {}) {
    const selectedMode = Object.hasOwn(QUALITY_PROFILES, mode) ? mode : CONFIG.defaultQuality;
    const profile = QUALITY_PROFILES[selectedMode];
    const pointBudget = activePointBudget(profile);

    state.qualityMode = selectedMode;
    state.qualityProfile = profile;

    const selector = byId("quality-selector");
    if (selector) selector.value = selectedMode;

    if (state.viewer) {
      state.viewer.setPointBudget(pointBudget);
      state.viewer.setMinNodeSize(profile.minNodeSize);
    }

    if (state.pointcloud && window.Potree) {
      const material = state.pointcloud.material;
      material.size = profile.pointSize;
      material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
      material.shape = Potree.PointShape[profile.shape] ?? Potree.PointShape.CIRCLE;
      material.activeAttributeName = "rgba";
    }

    updateQualityInfo(profile, pointBudget);
    if (persist) saveQualityPreference(selectedMode);
    if (announce && state.ready) {
      setStatus("quality.status", {
        qualityMode: selectedMode,
        pointBudget,
      }, "ready");
    }

    return profile;
  }

  async function resolveDataSource() {
    if (!window.ZenodoViewerAccess) {
      throw new Error("The local Zenodo access component is missing.");
    }

    const resolved = await window.ZenodoViewerAccess.resolveDataset(CONFIG.manifestFile);
    return Object.freeze({
      kind: "copc",
      name: resolved.scan.label,
      mode: resolved.mode,
      recordId: resolved.recordId,
      manifest: resolved.manifest,
      scan: resolved.scan,
    });
  }

  function applyDatasetName(name, sourceLabel) {
    const displayName = name || t("app.name");
    document.title = t("app.documentTitle", { name: displayName });
    const brandName = document.querySelector(".brand-copy strong");
    if (brandName) brandName.textContent = displayName;
    const brandSubtitle = document.querySelector(".brand-copy span");
    if (brandSubtitle) {
      brandSubtitle.textContent = sourceLabel
        ? t("brand.subtitleSource", { source: sourceLabel })
        : t("brand.subtitle");
    }
    const infoTitle = byId("info-title");
    if (infoTitle) infoTitle.textContent = name || t("info.defaultTitle");
  }

  function populateScanSelector(manifest, selectedScan) {
    const picker = byId("scan-picker");
    const selector = byId("scan-selector");
    selector.replaceChildren();
    manifest.scans.forEach((scan) => {
      const option = document.createElement("option");
      option.value = scan.id;
      option.textContent = scan.label;
      option.selected = scan.id === selectedScan.id;
      selector.append(option);
    });
    selector.disabled = manifest.scans.length < 2;
    picker.classList.toggle("hidden", manifest.scans.length < 2);
  }

  function renderStatus() {
    const status = byId("viewer-status");
    const values = { ...state.status.values };
    if (Number.isFinite(values.pointBudget)) {
      const mode = Object.hasOwn(QUALITY_PROFILES, values.qualityMode)
        ? values.qualityMode : state.qualityMode;
      values.quality = qualityLabel(mode, QUALITY_PROFILES[mode]);
      values.points = formatInteger(values.pointBudget);
    }
    if (state.status.key === "status.ready") {
      values.count = Number.isFinite(values.pointCount)
        ? t("status.pointCount", { points: formatInteger(values.pointCount) })
        : "";
      values.quality = qualityLabel();
    }
    byId("viewer-status-text").textContent = t(state.status.key, values);
    status.classList.remove("ready", "action", "warning", "error");
    if (state.status.tone) status.classList.add(state.status.tone);
  }

  function setStatus(key, values = {}, tone = "ready") {
    if (!["status.areaMeasured", "status.areaNonPlanar", "status.areaInvalid"].includes(key)) {
      state.statusAreaMeasurement = null;
    }
    state.status = Object.freeze({ key, values: Object.freeze({ ...values }), tone });
    renderStatus();
  }

  function renderLoading() {
    byId("loading-title").textContent = t(state.loading.titleKey);
    byId("loading-message").textContent = t(state.loading.messageKey);
    byId("loading-retry").classList.toggle("hidden", !state.loading.retry);
  }

  function setLoading(titleKey, messageKey, retry = false) {
    state.loading = Object.freeze({ titleKey, messageKey, retry });
    renderLoading();
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function closeAllDialogs() {
    document.querySelectorAll("dialog[open]").forEach(closeDialog);
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }

  function enableControls() {
    [...toolButtons(), ...actionButtons(), byId("toggle-sidebar"), byId("quality-selector")].forEach((button) => {
      button.disabled = false;
    });
  }

  function disableControls() {
    [...toolButtons(), ...actionButtons(), byId("toggle-sidebar"), byId("quality-selector")].forEach((button) => {
      button.disabled = true;
    });
  }

  function clearActiveTool() {
    if (state.activeInsertionCleanup) {
      const cleanup = state.activeInsertionCleanup;
      state.activeInsertionCleanup = null;
      cleanup();
    }
    state.activeTool = null;
    toolButtons().forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    });
  }

  function markActiveTool(toolName) {
    clearActiveTool();
    state.activeTool = toolName;
    const selected = document.querySelector(`[data-tool="${toolName}"]`);
    if (selected) {
      selected.classList.add("active");
      selected.setAttribute("aria-pressed", "true");
    }
  }

  const DEFAULT_OBJECT_KEYS = Object.freeze([
    "measurement.point",
    "measurement.distance",
    "measurement.height",
    "measurement.area",
    "measurement.angle",
    "measurement.circle",
    "measurement.azimuth",
    "measurement.volume",
    "measurement.profile",
    "measurement.clipBox",
  ]);

  function keyForObjectName(name) {
    if (!I18N || typeof name !== "string") return null;
    if (name === "Area") return "measurement.area";
    return DEFAULT_OBJECT_KEYS.find((key) => (
      name === I18N.catalogs.en[key] || name === I18N.catalogs.de[key]
    )) || null;
  }

  function markLocalisedObject(object, key) {
    if (!object || !key) return object;
    state.localisedObjects.set(object, key);
    object.name = englishText(key);
    window.setTimeout(refreshLocalisedObjectNames, 0);
    return object;
  }

  function refreshLocalisedObjectNames() {
    if (!window.$ || !window.$.jstree || !byId("jstree_scene")) return;
    let tree;
    let nodes;
    try {
      tree = window.$("#jstree_scene").jstree(true);
      nodes = tree && tree.get_json("#", { flat: true });
    } catch (_error) {
      return;
    }
    if (!tree || !Array.isArray(nodes)) return;

    state.localisedObjects.forEach((key, object) => {
      if (object.name !== englishText(key)) {
        state.localisedObjects.delete(object);
        return;
      }
      const node = nodes.find((candidate) => candidate.data === object
        || (candidate.data && object.uuid && candidate.data.uuid === object.uuid));
      if (node && node.text !== t(key)) tree.rename_node(node, t(key));
    });
  }

  function wireObjectLocalisation(viewer) {
    const track = (property) => (event) => {
      const object = event[property];
      const key = object && keyForObjectName(object.name);
      if (key) markLocalisedObject(object, key);
      if (property === "measurement" && object && object.showArea && AreaMeasurement) {
        if (!state.areaMeasurements.has(object)) {
          AreaMeasurement.enhance(object);
          state.areaMeasurements.add(object);
          object.addEventListener("marker_dropped", () => {
            if (!state.completedAreaMeasurements.has(object)) return;
            window.setTimeout(() => announceAreaMeasurement(object), 0);
          });
        }
      }
    };
    viewer.scene.addEventListener("measurement_added", track("measurement"));
    viewer.scene.addEventListener("profile_added", track("profile"));
    viewer.scene.addEventListener("volume_added", track("volume"));
    viewer.scene.addEventListener("polygon_clip_volume_added", track("volume"));
    const untrack = (property) => (event) => state.localisedObjects.delete(event[property]);
    viewer.scene.addEventListener("measurement_removed", (event) => {
      state.localisedObjects.delete(event.measurement);
      state.areaMeasurements.delete(event.measurement);
      if (state.statusAreaMeasurement === event.measurement) {
        state.statusAreaMeasurement = null;
      }
    });
    viewer.scene.addEventListener("profile_removed", untrack("profile"));
    viewer.scene.addEventListener("volume_removed", untrack("volume"));
    viewer.scene.addEventListener("polygon_clip_volume_removed", untrack("volume"));

    viewer.scene.measurements.forEach((measurement) => {
      track("measurement")({ measurement });
    });
  }

  function startMeasurement(toolName) {
    if (!state.ready) return;

    const viewer = state.viewer;
    let object;
    let instruction;
    let insertionCleanup = null;

    switch (toolName) {
      case "point":
        object = viewer.measuringTool.startInsertion({
          showDistances: false,
          showAngles: false,
          showCoordinates: true,
          showArea: false,
          closed: true,
          maxMarkers: 1,
          name: englishText("measurement.point"),
        });
        markLocalisedObject(object, "measurement.point");
        instruction = "status.pointInstruction";
        break;

      case "distance":
        object = viewer.measuringTool.startInsertion({
          showDistances: true,
          showArea: false,
          closed: false,
          name: englishText("measurement.distance"),
        });
        markLocalisedObject(object, "measurement.distance");
        instruction = "status.distanceInstruction";
        break;

      case "height":
        object = viewer.measuringTool.startInsertion({
          showDistances: false,
          showHeight: true,
          showArea: false,
          closed: false,
          maxMarkers: 2,
          name: englishText("measurement.height"),
        });
        markLocalisedObject(object, "measurement.height");
        instruction = "status.heightInstruction";
        break;

      case "area":
        object = viewer.measuringTool.startInsertion({
          showDistances: true,
          showArea: true,
          closed: true,
          name: englishText("measurement.area"),
        });
        markLocalisedObject(object, "measurement.area");
        instruction = "status.areaInstruction";
        {
          const showFinishedArea = (event) => {
            if (event.button !== 2) return;
            insertionCleanup();
            state.completedAreaMeasurements.add(object);
            window.setTimeout(() => announceAreaMeasurement(object), 0);
          };
          insertionCleanup = () => {
            viewer.renderer.domElement.removeEventListener("mouseup", showFinishedArea);
            if (state.activeInsertionCleanup === insertionCleanup) {
              state.activeInsertionCleanup = null;
            }
          };
          viewer.renderer.domElement.addEventListener("mouseup", showFinishedArea);
        }
        break;

      case "angle":
        object = viewer.measuringTool.startInsertion({
          showDistances: false,
          showAngles: true,
          showArea: false,
          closed: true,
          maxMarkers: 3,
          name: englishText("measurement.angle"),
        });
        markLocalisedObject(object, "measurement.angle");
        instruction = "status.angleInstruction";
        break;

      case "profile": {
        const profile = viewer.profileTool.startInsertion({ name: englishText("measurement.profile") });
        object = profile;
        markLocalisedObject(object, "measurement.profile");
        instruction = "status.profileInstruction";

        const openFinishedProfile = (event) => {
          if (event.button !== 2) return;
          insertionCleanup();
          window.setTimeout(() => {
            if (profile.points.length >= 2 && viewer.profileWindow && viewer.profileWindowController) {
              viewer.profileWindow.show();
              viewer.profileWindowController.setProfile(profile);
              setStatus("status.profileOpened", {}, "ready");
            }
          }, 0);
        };
        insertionCleanup = () => {
          viewer.renderer.domElement.removeEventListener("mouseup", openFinishedProfile);
          if (state.activeInsertionCleanup === insertionCleanup) {
            state.activeInsertionCleanup = null;
          }
        };
        viewer.renderer.domElement.addEventListener("mouseup", openFinishedProfile);
        break;
      }

      case "clip":
        viewer.setClipTask(Potree.ClipTask.SHOW_INSIDE);
        viewer.setClipMethod(Potree.ClipMethod.INSIDE_ANY);
        object = viewer.volumeTool.startInsertion({ clip: true, name: englishText("measurement.clipBox") });
        markLocalisedObject(object, "measurement.clipBox");
        instruction = "status.clipInstruction";
        break;

      default:
        return;
    }

    markActiveTool(toolName);
    state.activeInsertionCleanup = insertionCleanup;
    setStatus(instruction, {}, "action");
    return object;
  }

  function fitView() {
    if (!state.ready) return;
    state.viewer.dispatchEvent({ type: "cancel_insertions" });
    clearActiveTool();
    state.viewer.fitToScreen(0.85, 350);
    setStatus("status.fit", {}, "ready");
  }

  function topView() {
    if (!state.ready) return;
    state.viewer.dispatchEvent({ type: "cancel_insertions" });
    clearActiveTool();
    state.viewer.setTopView();
    setStatus("status.top", {}, "ready");
  }

  function resetSession() {
    if (!state.ready) return;

    const viewer = state.viewer;
    viewer.dispatchEvent({ type: "cancel_insertions" });
    viewer.scene.removeAllMeasurements();
    viewer.scene.removeAllClipVolumes();
    viewer.setClipTask(Potree.ClipTask.HIGHLIGHT);
    viewer.setClipMethod(Potree.ClipMethod.INSIDE_ANY);
    if (viewer.profileWindow) viewer.profileWindow.hide();
    state.localisedObjects.clear();
    state.areaMeasurements.clear();
    clearActiveTool();
    viewer.fitToScreen(0.85, 350);
    closeDialog(byId("reset-dialog"));
    setStatus("status.reset", {}, "ready");
  }

  function toggleSidebar() {
    if (!state.ready) return;
    const renderArea = byId("potree_render_area");
    const opening = window.getComputedStyle(renderArea).left === "0px";
    state.viewer.toggleSidebar();
    document.body.classList.toggle("sidebar-open", opening);
    byId("toggle-sidebar").setAttribute("aria-expanded", String(opening));
  }

  function populateDatasetInfo(metadata, source, pointcloud) {
    const configured = source.scan || {};
    const geometry = pointcloud && pointcloud.pcoGeometry;
    const copcPointCount = geometry && geometry.copc && geometry.copc.header
      ? geometry.copc.header.pointCount : null;
    const pointCount = metadata && Number.isFinite(metadata.points)
      ? metadata.points
      : (Number.isFinite(configured.points) ? configured.points : copcPointCount);
    byId("info-points").textContent = Number.isFinite(pointCount) ? formatInteger(pointCount) : "–";

    const position = metadata && Array.isArray(metadata.attributes)
      ? metadata.attributes.find((attribute) => attribute.name === "position")
      : null;
    if (position && Array.isArray(position.min) && Array.isArray(position.max)) {
      const extents = position.max.map((maximum, index) => maximum - position.min[index]);
      byId("info-extent").textContent = extents.map(formatMeters).join(" × ");
    } else if (Array.isArray(configured.extent)) {
      byId("info-extent").textContent = configured.extent.map(formatMeters).join(" × ");
    } else if (geometry && geometry.tightBoundingBox) {
      const box = geometry.tightBoundingBox;
      const size = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
      byId("info-extent").textContent = size.map(formatMeters).join(" × ");
    }

    const rawAttributes = metadata && Array.isArray(metadata.attributes)
      ? metadata.attributes.map((attribute) => attribute.name)
      : (Array.isArray(configured.attributes) ? configured.attributes : []);
    const attributes = rawAttributes.map((name) => {
      const normalised = String(name).replace(/[\s_-]/g, "").toLowerCase();
      const key = ATTRIBUTE_LABEL_KEYS[normalised];
      return key ? t(key) : name;
    });
    byId("info-attributes").textContent = attributes.join(", ") || "–";
    byId("info-format").textContent = configured.webFormat || "COPC 1.0 · LAZ";
    byId("info-source").textContent = configured.source || t("info.defaultSource");
    byId("info-access").textContent = source.mode === "draft"
      ? t("info.draftAccess")
      : t("info.publishedAccess");
    const coordinates = byId("info-coordinates");
    if (coordinates) {
      coordinates.textContent = t("info.localCoordinates", { units: configured.units || "m" });
    }
  }

  function showFatal(titleKey, messageKey, retry = true) {
    const overlay = byId("loading-overlay");
    overlay.classList.remove("dismissed");
    byId("loading-spinner").classList.add("hidden");
    setLoading(titleKey, messageKey, retry);
    setStatus(titleKey, {}, "error");
  }

  function describeFailure(error) {
    const code = error && error.code;
    if (code === "missing_access" || code === "invalid_access") {
      return {
        titleKey: "error.accessRequiredTitle",
        messageKey: "error.accessRequiredMessage",
        retry: false,
      };
    }
    if (code === "access_denied") {
      return {
        titleKey: "error.accessDeniedTitle",
        messageKey: "error.accessDeniedMessage",
        retry: false,
      };
    }
    if (["range_failed", "range_header", "range_length"].includes(code)) {
      return {
        titleKey: "error.rangeTitle",
        messageKey: "error.rangeMessage",
        retry: true,
      };
    }
    if (code === "rate_limit") {
      return {
        titleKey: "error.rateLimitTitle",
        messageKey: "error.rateLimitMessage",
        retry: true,
      };
    }
    if (code === "invalid_manifest") {
      return {
        titleKey: "error.manifestTitle",
        messageKey: "error.manifestMessage",
        retry: false,
      };
    }
    return {
      titleKey: "error.loadTitle",
      messageKey: "error.loadMessage",
      retry: true,
    };
  }

  function syncLanguageButtons() {
    document.querySelectorAll("[data-language]").forEach((button) => {
      const active = I18N && button.dataset.language === I18N.language;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function translatePotreeInterface() {
    if (!I18N) return;
    [byId("potree_sidebar_container"), byId("profile_window"), byId("message_listing")]
      .filter(Boolean)
      .forEach(I18N.observePotree);
    refreshLocalisedObjectNames();
  }

  function renderLanguage(translateStaticDocument = true) {
    if (!I18N) return;
    if (translateStaticDocument) I18N.translateDocument(document);
    syncLanguageButtons();

    const configured = state.dataset || {};
    applyDatasetName(configured.label || CONFIG.name, configured.source || "");
    updateQualityInfo(state.qualityProfile, activePointBudget(state.qualityProfile));
    renderStatus();
    renderLoading();

    if (state.source && state.dataset) {
      populateDatasetInfo(
        state.metadata,
        { mode: state.source.mode, scan: state.dataset },
        state.pointcloud,
      );
    }

    if (state.viewer) state.viewer.setDescription(t("viewer.description"));
    if (AreaMeasurement) {
      state.areaMeasurements.forEach((measurement) => AreaMeasurement.refresh(measurement));
      if (state.statusAreaMeasurement) {
        announceAreaMeasurement(state.statusAreaMeasurement);
      }
    }
    if (state.viewer && state.guiReady) {
      state.viewer.setLanguage(I18N ? I18N.language : "en");
      window.setTimeout(translatePotreeInterface, 0);
    }
  }

  function wireInterface() {
    window.addEventListener("potree_pointcloud_error", (event) => {
      if (!state.ready) return;
      state.ready = false;
      disableControls();
      const detail = event.detail || {};
      console.error("Point-cloud streaming error", {
        name: detail.name || "Error",
        code: detail.code || "pointcloud_load",
        status: detail.status || null,
      });
      const failure = describeFailure(detail);
      showFatal(failure.titleKey, failure.messageKey, failure.retry);
    });

    toolButtons().forEach((button) => {
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => startMeasurement(button.dataset.tool));
    });

    document.querySelector('[data-action="fit"]').addEventListener("click", fitView);
    document.querySelector('[data-action="top"]').addEventListener("click", topView);
    document.querySelector('[data-action="reset"]').addEventListener("click", () => openDialog(byId("reset-dialog")));

    byId("toggle-sidebar").setAttribute("aria-expanded", "false");
    byId("toggle-sidebar").addEventListener("click", toggleSidebar);
    byId("open-help").addEventListener("click", () => openDialog(byId("help-dialog")));
    byId("open-info").addEventListener("click", () => openDialog(byId("info-dialog")));
    byId("confirm-reset").addEventListener("click", resetSession);
    byId("loading-retry").addEventListener("click", () => window.location.reload());
    byId("quality-selector").addEventListener("change", (event) => {
      applyQuality(event.target.value, { persist: true, announce: true });
    });
    document.querySelectorAll("[data-language]").forEach((button) => {
      button.addEventListener("click", () => {
        if (I18N) I18N.setLanguage(button.dataset.language);
      });
    });
    byId("scan-selector").addEventListener("change", (event) => {
      if (!window.ZenodoViewerAccess.selectScan(event.target.value)) return;
      byId("loading-overlay").classList.remove("dismissed");
      byId("loading-spinner").classList.remove("hidden");
      setLoading("loading.switchTitle", "loading.switchMessage");
      window.location.reload();
    });
    byId("clear-access").addEventListener("click", () => {
      window.ZenodoViewerAccess.clearAccess();
      window.location.replace(`${window.location.pathname}${window.location.search}`);
    });

    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => closeDialog(button.closest("dialog")));
    });

    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("dialog[open]")) {
        closeAllDialogs();
        return;
      }
      if (state.viewer) state.viewer.dispatchEvent({ type: "cancel_insertions" });
      clearActiveTool();
      if (state.ready) setStatus("status.cancelled", {}, "ready");
    });
  }

  async function initialise() {
    if (I18N) {
      I18N.onChange(() => renderLanguage(false));
      I18N.observePotree(byId("potree_sidebar_container"));
    }
    renderLanguage();
    wireInterface();
    state.compactDevice = window.matchMedia("(max-width: 760px)").matches;
    state.qualityMode = readQualityPreference();
    applyQuality(state.qualityMode);

    if (window.location.protocol === "file:") {
      showFatal(
        "error.localServerTitle",
        "error.localServerMessage",
      );
      return;
    }

    if (!window.Potree || !window.$ || !window.ZenodoViewerAccess || !I18N || !AreaMeasurement) {
      showFatal("error.startTitle", "error.startMessage");
      return;
    }

    try {
      setLoading("loading.title", "loading.manifest");
      const source = await resolveDataSource();

      state.catalog = source.manifest;
      state.dataset = source.scan;
      state.source = Object.freeze({
        kind: source.kind,
        mode: source.mode,
        recordId: source.recordId,
        scanId: source.scan.id,
        filename: source.scan.file,
        name: source.name,
      });
      applyDatasetName(source.name, source.scan.source);
      populateScanSelector(source.manifest, source.scan);
      setLoading("loading.title", "loading.points");

      const viewer = new Potree.Viewer(byId("potree_render_area"));
      state.viewer = viewer;
      wireObjectLocalisation(viewer);

      viewer.setEDLEnabled(true);
      viewer.setEDLRadius(1.25);
      viewer.setEDLStrength(0.45);
      viewer.setFOV(58);
      applyQuality(state.qualityMode);
      viewer.setBackground("gradient");
      viewer.setLengthUnit("m");
      viewer.setDescription(t("viewer.description"));

      const guiReady = new Promise((resolve) => {
        viewer.loadGUI(() => {
          state.guiReady = true;
          viewer.setLanguage(I18N.language);
          translatePotreeInterface();
          resolve();
        });
      });

      const metadataReady = Promise.resolve(null);
      const pointCloudReady = window.ZenodoViewerAccess.loadPointCloud();

      const [metadata, , loaded] = await withTimeout(
        Promise.all([metadataReady, guiReady, pointCloudReady]),
        CONFIG.loadTimeoutMs,
        t("error.timeout"),
      );

      state.metadata = metadata;
      state.pointcloud = loaded.pointcloud;
      state.pointcloud.name = source.name;
      populateDatasetInfo(metadata, source, state.pointcloud);

      applyQuality(state.qualityMode);

      viewer.scene.addPointCloud(state.pointcloud);
      viewer.fitToScreen(0.85);

      viewer.addEventListener("cancel_insertions", clearActiveTool);
      viewer.renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
      viewer.renderer.domElement.addEventListener("mouseup", (event) => {
        if (event.button === 2) window.setTimeout(clearActiveTool, 0);
      });

      state.ready = true;
      window.SiteScapeViewer = Object.freeze({
        get ready() { return state.ready; },
        get metadata() { return state.metadata || state.dataset; },
        get source() { return state.source; },
        get qualityMode() { return state.qualityMode; },
        get language() { return I18N.language; },
        startTool: startMeasurement,
        setQuality: (mode) => applyQuality(mode, { persist: true, announce: true }),
        setLanguage: (language) => I18N.setLanguage(language),
        fitView,
        topView,
        resetSession,
      });

      enableControls();
      const geometry = state.pointcloud.pcoGeometry;
      const pointCount = Number.isFinite(source.scan.points)
        ? source.scan.points
        : (geometry && geometry.copc && geometry.copc.header
          ? geometry.copc.header.pointCount : null);
      setStatus("status.ready", {
        pointCount,
      }, "ready");
      byId("loading-overlay").classList.add("dismissed");
    } catch (error) {
      console.error("Viewer error", {
        name: error && error.name ? error.name : "Error",
        code: error && error.code ? error.code : "unknown",
        status: error && error.status ? error.status : null,
      });
      const failure = describeFailure(error);
      showFatal(failure.titleKey, failure.messageKey, failure.retry);
    }
  }

  initialise();
})();
