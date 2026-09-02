(function () {
  "use strict";

  const i18n = window.LidarI18n;
  const t = (key, values) => i18n ? i18n.t(key, values) : key;
  const QUALITY_STORAGE_KEY = "lidar-viewer.render-quality.v1";
  const DEFAULT_QUALITY_PROFILES = Object.freeze({
    auto: Object.freeze({
      labelKey: "quality.auto",
      desktopPointBudget: 3_500_000,
      compactPointBudget: 1_200_000,
      minNodeSize: 20,
      pointSize: 0.85,
      shape: "CIRCLE",
    }),
    high: Object.freeze({
      labelKey: "quality.high",
      desktopPointBudget: 5_500_000,
      compactPointBudget: 2_000_000,
      minNodeSize: 10,
      pointSize: 0.72,
      shape: "CIRCLE",
    }),
    maximum: Object.freeze({
      labelKey: "quality.maximum",
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
      labelKey: defaults.labelKey,
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

  const state = {
    viewer: null,
    metadata: null,
    pointcloud: null,
    source: null,
    catalog: null,
    dataset: null,
    ready: false,
    activeTool: null,
    compactDevice: false,
    qualityMode: CONFIG.defaultQuality,
    qualityProfile: QUALITY_PROFILES[CONFIG.defaultQuality],
    statusView: Object.freeze({ key: "status.loading", tone: "ready", values: {} }),
    loadingView: Object.freeze({
      titleKey: "loading.prepareTitle",
      messageKey: "loading.prepareMessage",
      values: {},
    }),
  };

  const byId = (id) => document.getElementById(id);
  const toolButtons = () => Array.from(document.querySelectorAll("[data-tool]"));
  const actionButtons = () => Array.from(document.querySelectorAll("[data-action]"));

  function currentLocale() {
    return i18n ? i18n.locale() : "en-GB";
  }

  function viewerName() {
    return CONFIG.name || t("app.name");
  }

  function qualityLabel(mode, profile = QUALITY_PROFILES[mode]) {
    return profile.customLabel || t(profile.labelKey);
  }

  function localisedValues(values = {}) {
    const rendered = { ...values };
    if (Number.isFinite(values.countNumber)) rendered.count = formatInteger(values.countNumber);
    if (values.qualityMode) rendered.quality = qualityLabel(values.qualityMode);
    if (values.labelMode) rendered.label = qualityLabel(values.labelMode);
    return rendered;
  }

  function formatInteger(value) {
    return new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 0 }).format(value);
  }

  function formatMeters(value) {
    return new Intl.NumberFormat(currentLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + " m";
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
      // The viewer still works when persistent browser storage is unavailable.
    }
  }

  function activePointBudget(profile) {
    return state.compactDevice ? profile.compactPointBudget : profile.desktopPointBudget;
  }

  function updateQualityInfo(mode, profile, pointBudget) {
    const info = byId("info-quality");
    if (!info) return;
    info.textContent = t("quality.info", {
      label: qualityLabel(mode, profile),
      count: formatInteger(pointBudget),
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

    updateQualityInfo(selectedMode, profile, pointBudget);
    if (persist) saveQualityPreference(selectedMode);
    if (announce && state.ready) {
      setStatus("status.qualityChanged", "ready", {
        labelMode: selectedMode,
        countNumber: pointBudget,
      });
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
    document.title = t("document.datasetTitle", { name });
    const brandName = document.querySelector(".brand-copy strong");
    if (brandName) brandName.textContent = name;
    const brandSubtitle = document.querySelector(".brand-copy span");
    if (brandSubtitle) {
      brandSubtitle.textContent = sourceLabel
        ? t("brand.pointCloudWithSource", { source: sourceLabel })
        : t("brand.pointCloud");
    }
    const infoTitle = byId("info-title");
    if (infoTitle) infoTitle.textContent = name;
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
    if (!status) return;
    byId("viewer-status-text").textContent = t(
      state.statusView.key,
      localisedValues(state.statusView.values),
    );
    status.classList.remove("ready", "action", "error");
    status.classList.add(state.statusView.tone);
  }

  function setStatus(key, tone = "ready", values = {}) {
    state.statusView = Object.freeze({ key, tone, values: Object.freeze({ ...values }) });
    renderStatus();
  }

  function renderLoading() {
    if (!byId("loading-title")) return;
    const values = localisedValues(state.loadingView.values);
    byId("loading-title").textContent = t(state.loadingView.titleKey, values);
    byId("loading-message").textContent = t(state.loadingView.messageKey, values);
  }

  function setLoading(titleKey, messageKey, values = {}) {
    state.loadingView = Object.freeze({
      titleKey,
      messageKey,
      values: Object.freeze({ ...values }),
    });
    renderLoading();
  }

  function labelSceneObject(object, translationKey) {
    if (!object) return object;
    object.__lidarViewerTranslationKey = translationKey;
    object.name = t(translationKey);
    return object;
  }

  function translateSceneObjects() {
    if (!state.viewer || !state.viewer.scene) return;
    const collections = [
      state.viewer.scene.measurements,
      state.viewer.scene.profiles,
      state.viewer.scene.volumes,
    ];
    collections.forEach((collection) => {
      (collection || []).forEach((object) => {
        if (object.__lidarViewerTranslationKey) {
          object.name = t(object.__lidarViewerTranslationKey);
        }
      });
    });
  }

  function refreshLanguage() {
    const name = state.dataset ? state.dataset.label : viewerName();
    const sourceLabel = state.dataset ? state.dataset.source : null;
    applyDatasetName(name, sourceLabel);
    if (state.viewer) {
      state.viewer.setLanguage(i18n.language);
      state.viewer.setDescription(t("viewer.description"));
    }
    if (state.pointcloud && state.dataset && state.source) {
      populateDatasetInfo(null, {
        mode: state.source.mode,
        scan: state.dataset,
      }, state.pointcloud);
    }
    applyQuality(state.qualityMode);
    translateSceneObjects();
    renderStatus();
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

  function startMeasurement(toolName) {
    if (!state.ready) return;

    const viewer = state.viewer;
    let object;
    let instructionKey;

    switch (toolName) {
      case "point":
        object = labelSceneObject(viewer.measuringTool.startInsertion({
          showDistances: false,
          showAngles: false,
          showCoordinates: true,
          showArea: false,
          closed: true,
          maxMarkers: 1,
          name: t("tool.point"),
        }), "tool.point");
        instructionKey = "measurement.pointInstruction";
        break;

      case "distance":
        object = labelSceneObject(viewer.measuringTool.startInsertion({
          showDistances: true,
          showArea: false,
          closed: false,
          name: t("tool.distance"),
        }), "tool.distance");
        instructionKey = "measurement.distanceInstruction";
        break;

      case "height":
        object = labelSceneObject(viewer.measuringTool.startInsertion({
          showDistances: false,
          showHeight: true,
          showArea: false,
          closed: false,
          maxMarkers: 2,
          name: t("tool.height"),
        }), "tool.height");
        instructionKey = "measurement.heightInstruction";
        break;

      case "area":
        object = labelSceneObject(viewer.measuringTool.startInsertion({
          showDistances: true,
          showArea: true,
          closed: true,
          name: t("tool.area"),
        }), "tool.area");
        instructionKey = "measurement.areaInstruction";
        break;

      case "angle":
        object = labelSceneObject(viewer.measuringTool.startInsertion({
          showDistances: false,
          showAngles: true,
          showArea: false,
          closed: true,
          maxMarkers: 3,
          name: t("tool.angle"),
        }), "tool.angle");
        instructionKey = "measurement.angleInstruction";
        break;

      case "profile": {
        const profile = labelSceneObject(
          viewer.profileTool.startInsertion({ name: t("tool.profile") }),
          "tool.profile",
        );
        object = profile;
        instructionKey = "measurement.profileInstruction";

        const openFinishedProfile = (event) => {
          if (event.button !== 2) return;
          window.setTimeout(() => {
            if (profile.points.length >= 2 && viewer.profileWindow && viewer.profileWindowController) {
              viewer.profileWindow.show();
              viewer.profileWindowController.setProfile(profile);
              setStatus("measurement.profileOpened", "ready");
            }
          }, 0);
          viewer.renderer.domElement.removeEventListener("mouseup", openFinishedProfile);
        };
        viewer.renderer.domElement.addEventListener("mouseup", openFinishedProfile);
        break;
      }

      case "clip":
        viewer.setClipTask(Potree.ClipTask.SHOW_INSIDE);
        viewer.setClipMethod(Potree.ClipMethod.INSIDE_ANY);
        object = labelSceneObject(
          viewer.volumeTool.startInsertion({ clip: true, name: t("measurement.clipName") }),
          "measurement.clipName",
        );
        instructionKey = "measurement.clipInstruction";
        break;

      default:
        return;
    }

    markActiveTool(toolName);
    setStatus(instructionKey, "action");
    return object;
  }

  function fitView() {
    if (!state.ready) return;
    state.viewer.dispatchEvent({ type: "cancel_insertions" });
    clearActiveTool();
    state.viewer.fitToScreen(0.85, 350);
    setStatus("status.fit", "ready");
  }

  function topView() {
    if (!state.ready) return;
    state.viewer.dispatchEvent({ type: "cancel_insertions" });
    clearActiveTool();
    state.viewer.setTopView();
    setStatus("status.top", "ready");
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
    clearActiveTool();
    viewer.fitToScreen(0.85, 350);
    closeDialog(byId("reset-dialog"));
    setStatus("status.reset", "ready");
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
    const attributes = rawAttributes.map((name) => name === "rgb" ? t("attribute.rgb") : name);
    byId("info-attributes").textContent = attributes.join(", ") || "–";
    byId("info-format").textContent = configured.webFormat || "COPC 1.0 · LAZ";
    byId("info-source").textContent = configured.source || t("dataset.sourceFallback");
    byId("info-access").textContent = source.mode === "draft"
      ? t("dataset.accessDraft")
      : t("dataset.accessPublished");
    const coordinates = byId("info-coordinates");
    if (coordinates) {
      coordinates.textContent = t("dataset.coordinates", { units: configured.units || "m" });
    }
  }

  function showFatal(titleKey, messageKey, retry = true, values = {}) {
    const overlay = byId("loading-overlay");
    overlay.classList.remove("dismissed");
    byId("loading-spinner").classList.add("hidden");
    setLoading(titleKey, messageKey, values);
    byId("loading-retry").classList.toggle("hidden", !retry);
    setStatus(titleKey, "error", values);
  }

  function describeFailure(error) {
    const code = error && error.code;
    if (code === "missing_access" || code === "invalid_access") {
      return {
        titleKey: "error.missingAccessTitle",
        messageKey: "error.missingAccessMessage",
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
      titleKey: "error.genericTitle",
      messageKey: "error.genericMessage",
      retry: true,
    };
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
    document.querySelectorAll("[data-language-selector]").forEach((selector) => {
      selector.addEventListener("change", (event) => {
        i18n.setLanguage(event.target.value);
      });
    });
    window.addEventListener("lidar-language-changed", refreshLanguage);
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
      if (state.ready) setStatus("status.cancelled", "ready");
    });
  }

  async function initialise() {
    if (!i18n) {
      byId("loading-spinner").classList.add("hidden");
      byId("loading-title").textContent = "Viewer could not start";
      byId("loading-message").textContent = "The local interface-language component is missing.";
      return;
    }

    i18n.apply();
    applyDatasetName(viewerName());
    setStatus("status.loading", "ready");
    setLoading("loading.prepareTitle", "loading.prepareMessage");
    wireInterface();
    state.compactDevice = window.matchMedia("(max-width: 760px)").matches;
    state.qualityMode = readQualityPreference();
    applyQuality(state.qualityMode);

    if (window.location.protocol === "file:") {
      showFatal("error.localServerTitle", "error.localServerMessage");
      return;
    }

    if (!window.Potree || !window.$ || !window.ZenodoViewerAccess) {
      showFatal("error.startTitle", "error.startMessage");
      return;
    }

    try {
      setLoading("loading.prepareTitle", "loading.fileList");
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
      setLoading("loading.prepareTitle", "loading.byteRanges");

      const viewer = new Potree.Viewer(byId("potree_render_area"));
      state.viewer = viewer;

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
          viewer.setLanguage(i18n.language);
          resolve();
        });
      });

      const metadataReady = Promise.resolve(null);
      const pointCloudReady = window.ZenodoViewerAccess.loadPointCloud();

      const [metadata, , loaded] = await withTimeout(
        Promise.all([metadataReady, guiReady, pointCloudReady]),
        CONFIG.loadTimeoutMs,
        "Point-cloud loading timed out.",
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
        get language() { return i18n.language; },
        startTool: startMeasurement,
        setLanguage: (language) => i18n.setLanguage(language),
        setQuality: (mode) => applyQuality(mode, { persist: true, announce: true }),
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
      setStatus(
        Number.isFinite(pointCount) ? "status.readyWithPoints" : "status.ready",
        "ready",
        {
          countNumber: pointCount,
          qualityMode: state.qualityMode,
        },
      );
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
