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

  const POTREE_TREE_ROOT_KEYS = Object.freeze({
    pointclouds: "potree.tree.pointClouds",
    measurements: "potree.tree.measurements",
    annotations: "potree.tree.annotations",
    other: "potree.tree.other",
    vectors: "potree.tree.vectors",
    images: "potree.tree.images",
  });

  const POTREE_LITERAL_PREFIX = "potree.literal.";
  const POTREE_TEXT_NODE_KEYS = new WeakMap();
  const POTREE_RANGE_NODE_PARTS = new WeakMap();
  const POTREE_LITERAL_KEY_BY_TEXT = (() => {
    const index = new Map();
    if (!i18n || !i18n.catalog) return index;
    ["en", "de"].forEach((language) => {
      const catalog = i18n.catalog[language] || {};
      Object.entries(catalog).forEach(([key, value]) => {
        if (!key.startsWith(POTREE_LITERAL_PREFIX)) return;
        const normalised = normalisePotreeText(value);
        if (normalised && !index.has(normalised)) index.set(normalised, key);
      });
    });
    return index;
  })();

  const POTREE_FIXED_TEXT_BINDINGS = Object.freeze([
    ["#background_options label[for='background_options_skybox']", "potree.literal.skybox"],
    ["#background_options label[for='background_options_gradient']", "potree.literal.gradient"],
    ["#background_options label[for='background_options_black']", "potree.literal.black"],
    ["#background_options label[for='background_options_white']", "potree.literal.white"],
    ["#background_options label[for='background_options_none']", "potree.literal.none"],
    ["#splat_quality_options label[for='splat_quality_options_standard']", "potree.literal.standard"],
    ["#splat_quality_options label[for='splat_quality_options_hq']", "potree.literal.highQuality"],
    ["#splat_quality_options legend", "potree.literal.splatQuality"],
    ["#measurement_options_show label[for='measurement_options_show_yes']", "potree.literal.show"],
    ["#measurement_options_show label[for='measurement_options_show_no']", "potree.literal.hide"],
    ["#measurement_options_show legend", "potree.literal.showHideLabels"],
    ["#cliptask_options label[for='cliptask_options_none']", "potree.literal.none"],
    ["#cliptask_options label[for='cliptask_options_highlight']", "potree.literal.highlight"],
    ["#cliptask_options label[for='cliptask_options_show_inside']", "potree.literal.inside"],
    ["#cliptask_options label[for='cliptask_options_show_outside']", "potree.literal.outside"],
    ["#cliptask_options legend", "potree.literal.clipTask"],
    ["#clipmethod_options label[for='clipmethod_options_any']", "potree.literal.insideAny"],
    ["#clipmethod_options label[for='clipmethod_options_all']", "potree.literal.insideAll"],
    ["#clipmethod_options legend", "potree.literal.clipMethod"],
    ["#camera_projection_options label[for='camera_projection_options_perspective']", "potree.literal.perspective"],
    ["#camera_projection_options label[for='camera_projection_options_orthigraphic']", "potree.literal.orthographic"],
    ["#camera_projection_options legend", "potree.literal.cameraProjection"],
    ["#gpstime_multilevel_range_container li > span > span:first-child", "potree.literal.timeLabel"],
    ["#toggleClassificationFilters + span", "potree.literal.showHideAll"],
  ]);

  const POTREE_FIXED_TOOLTIPS = Object.freeze([
    ["#closeProfileContainer", "potree.tooltip.closeProfile"],
    ["#potree_profile_rotate_cw", "potree.tooltip.rotateClockwise"],
    ["#potree_profile_rotate_ccw", "potree.tooltip.rotateCounterClockwise"],
    ["#potree_profile_move_forward", "potree.tooltip.moveForward"],
    ["#potree_profile_move_backward", "potree.tooltip.moveBackward"],
    ["#potree_download_csv_icon", "potree.tooltip.downloadCsv"],
    ["#potree_download_las_icon", "potree.tooltip.downloadLas"],
    ["img[name='geojson_export_button']", "potree.tooltip.exportGeoJson"],
    ["img[name='dxf_export_button']", "potree.tooltip.exportDxf"],
    ["img[name='potree_export_button']", "potree.tooltip.exportPotree"],
    ["img[name='remove'], img[name='delete']", "potree.tooltip.remove"],
    ["#animation_keyframes img[name='assign']", "potree.tooltip.assignKeyframe"],
    ["#animation_keyframes img[name='move']", "potree.tooltip.moveToKeyframe"],
  ]);

  const POTREE_RANGE_SELECTORS = Object.freeze([
    "#lblReturnNumber",
    "#lblNumberOfReturns",
    "#lblHeightRange",
    "#lblExtraRange",
    "#lblIntensityRange",
  ]);

  let potreeInterfaceObserver = null;
  let potreeTranslationScheduled = false;

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

  function labelSceneObject(object, translationKey, values = {}) {
    if (!object) return object;
    object.__lidarViewerTranslationKey = translationKey;
    object.__lidarViewerTranslationValues = Object.freeze({ ...values });
    object.name = t(translationKey, values);
    return object;
  }

  function normalisePotreeText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  }

  function potreeTranslationKey(value) {
    return POTREE_LITERAL_KEY_BY_TEXT.get(normalisePotreeText(value)) || null;
  }

  function skipPotreeTextNode(node) {
    const parent = node && node.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest(
      "script, style, #jstree_scene, [contenteditable='true'], [name='download_message']",
    ));
  }

  function translatePotreeTextNode(node) {
    if (skipPotreeTextNode(node)) return;
    const raw = node.nodeValue || "";
    let key = POTREE_TEXT_NODE_KEYS.get(node);
    if (!key) {
      key = potreeTranslationKey(raw);
      if (!key) return;
      POTREE_TEXT_NODE_KEYS.set(node, key);

      const option = node.parentElement;
      if (option && option.tagName === "OPTION" && !option.hasAttribute("value")) {
        option.setAttribute("value", option.value);
      }
    }

    const leading = (raw.match(/^\s*/) || [""])[0];
    const trailing = (raw.match(/\s*$/) || [""])[0];
    const rendered = leading + t(key) + trailing;
    if (node.nodeValue !== rendered) node.nodeValue = rendered;
  }

  function translatePotreeAttributes(element) {
    if (!element || element.nodeType !== 1) return;

    ["title", "placeholder"].forEach((attribute) => {
      const keyAttribute = "data-lidar-potree-" + attribute + "-key";
      let key = element.getAttribute(keyAttribute);
      if (!key) {
        key = potreeTranslationKey(element.getAttribute(attribute));
        if (key) element.setAttribute(keyAttribute, key);
      }
      if (key) {
        const rendered = t(key);
        if (element.getAttribute(attribute) !== rendered) {
          element.setAttribute(attribute, rendered);
        }
      }
    });

    if (element.tagName === "INPUT" && ["button", "submit", "reset"].includes(element.type)) {
      const keyAttribute = "data-lidar-potree-value-key";
      let key = element.getAttribute(keyAttribute);
      if (!key) {
        key = potreeTranslationKey(element.value);
        if (key) element.setAttribute(keyAttribute, key);
      }
      if (key) {
        const rendered = t(key);
        if (element.value !== rendered) element.value = rendered;
        if (element.getAttribute("value") !== rendered) element.setAttribute("value", rendered);
      }
    }

    if (element.tagName === "IMG" && element.getAttribute("title")) {
      const title = element.getAttribute("title");
      if (element.getAttribute("aria-label") !== title) element.setAttribute("aria-label", title);
    }
  }

  function translatePotreeRange(element) {
    const raw = normalisePotreeText(element && element.textContent);
    if (!raw) return;

    const match = /^(.+?)\s+(?:to|bis)\s+(.+)$/.exec(raw);
    if (match) {
      POTREE_RANGE_NODE_PARTS.set(element, Object.freeze({
        start: match[1],
        end: match[2],
      }));
    }
    const parts = POTREE_RANGE_NODE_PARTS.get(element);
    if (!parts) return;

    const separator = i18n && i18n.language === "de" ? " bis " : " to ";
    const rendered = parts.start + separator + parts.end;
    if (element.textContent !== rendered) element.textContent = rendered;
  }

  function applyPotreeFixedTranslations(root) {
    POTREE_FIXED_TEXT_BINDINGS.forEach(([selector, key]) => {
      root.querySelectorAll(selector).forEach((element) => {
        const rendered = t(key);
        if (element.textContent !== rendered) element.textContent = rendered;
      });
    });

    POTREE_FIXED_TOOLTIPS.forEach(([selector, key]) => {
      root.querySelectorAll(selector).forEach((element) => {
        const rendered = t(key);
        if (element.getAttribute("title") !== rendered) element.setAttribute("title", rendered);
        if (element.getAttribute("aria-label") !== rendered) {
          element.setAttribute("aria-label", rendered);
        }
      });
    });

    POTREE_RANGE_SELECTORS.forEach((selector) => {
      root.querySelectorAll(selector).forEach(translatePotreeRange);
    });
  }

  function translatePotreeSubtree(root) {
    if (!root) return;
    applyPotreeFixedTranslations(root);

    if (root.nodeType === 1) translatePotreeAttributes(root);
    root.querySelectorAll("*").forEach(translatePotreeAttributes);

    const showText = window.NodeFilter ? window.NodeFilter.SHOW_TEXT : 4;
    const walker = document.createTreeWalker(root, showText);
    let node = walker.nextNode();
    while (node) {
      translatePotreeTextNode(node);
      node = walker.nextNode();
    }
  }

  function translatePotreeInterface() {
    translatePotreeSubtree(byId("potree_sidebar_container"));
    translatePotreeSubtree(document.querySelector("#potree_render_area .potree_failpage"));
    renderPotreeMessages();
  }

  function schedulePotreeTranslation() {
    if (potreeTranslationScheduled) return;
    potreeTranslationScheduled = true;
    window.setTimeout(() => {
      potreeTranslationScheduled = false;
      translatePotreeInterface();
    }, 0);
  }

  function observePotreeInterface() {
    const root = byId("potree_sidebar_container");
    translatePotreeInterface();
    if (!root || potreeInterfaceObserver || typeof window.MutationObserver !== "function") return;

    potreeInterfaceObserver = new window.MutationObserver(schedulePotreeTranslation);
    potreeInterfaceObserver.observe(root, {
      attributes: true,
      attributeFilter: ["title", "placeholder", "value"],
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  function describePotreeMessage(content) {
    if (typeof content !== "string") return null;
    const copied = /^Copied value to clipboard:\s*<br>\s*'([\s\S]*)'$/.exec(content.trim());
    if (copied && /^[-+0-9.,\s]+$/.test(copied[1])) {
      return Object.freeze({
        key: "potree.message.copied",
        values: Object.freeze({ value: copied[1] }),
      });
    }

    const key = new Map([
      ["no measurements to export", "potree.message.noMeasurements"],
      [
        "Switch to Orthographic Camera Mode before using the Screen-Box-Select tool.",
        "potree.message.orthographicRequired",
      ],
      ["WebGL context lost. ☹", "potree.message.webglLost"],
    ]).get(content.trim());
    return key ? Object.freeze({ key, values: Object.freeze({}) }) : null;
  }

  function renderPotreeMessages() {
    const messages = state.viewer && state.viewer.messages;
    (messages || []).forEach((message) => {
      if (
        message.__lidarViewerTranslationKey
        && typeof message.setMessage === "function"
      ) {
        message.setMessage(t(
          message.__lidarViewerTranslationKey,
          message.__lidarViewerTranslationValues || {},
        ));
      }
      const close = message.elClose && message.elClose[0];
      if (close) {
        const label = t("potree.tooltip.closeMessage");
        close.setAttribute("title", label);
        close.setAttribute("aria-label", label);
      }
    });
  }

  function installPotreeMessageTranslation(viewer) {
    if (
      !viewer
      || viewer.__lidarViewerMessageTranslation
      || typeof viewer.postMessage !== "function"
    ) return;

    const originalPostMessage = viewer.postMessage;
    viewer.postMessage = function (content, params) {
      const descriptor = describePotreeMessage(content);
      const rendered = descriptor ? t(descriptor.key, descriptor.values) : content;
      const message = originalPostMessage.call(this, rendered, params);
      if (descriptor && message) {
        message.__lidarViewerTranslationKey = descriptor.key;
        message.__lidarViewerTranslationValues = descriptor.values;
      }
      const close = message && message.elClose && message.elClose[0];
      if (close) {
        const label = t("potree.tooltip.closeMessage");
        close.setAttribute("title", label);
        close.setAttribute("aria-label", label);
      }
      return message;
    };
    viewer.__lidarViewerMessageTranslation = true;
  }

  function installPotreeCrashTranslation() {
    const Viewer = window.Potree && window.Potree.Viewer;
    const prototype = Viewer && Viewer.prototype;
    if (
      !prototype
      || prototype.__lidarViewerCrashTranslation
      || typeof prototype.onCrash !== "function"
    ) return;

    const originalOnCrash = prototype.onCrash;
    prototype.onCrash = function (error) {
      const result = originalOnCrash.call(this, error);
      translatePotreeSubtree(document.querySelector("#potree_render_area .potree_failpage"));
      return result;
    };
    prototype.__lidarViewerCrashTranslation = true;
  }

  function installPotreeTranslations() {
    const potreeI18n = window.i18n;
    const supplement = i18n && i18n.potreeGermanSupplement;
    if (potreeI18n && supplement && typeof potreeI18n.addResources === "function") {
      potreeI18n.addResources("de", "translation", supplement);
    }
  }

  function inferPotreeMeasurementKey(measurement) {
    if (!measurement || measurement.__lidarViewerTranslationKey) return null;

    let key = null;
    if (measurement.showAzimuth) {
      key = "tool.azimuth";
    } else if (measurement.showCircle) {
      key = "tool.circle";
    } else if (measurement.showHeight) {
      key = "tool.height";
    } else if (measurement.showAngles) {
      key = "tool.angle";
    } else if (measurement.showArea) {
      key = "tool.area";
    } else if (measurement.showCoordinates && measurement.maxMarkers === 1) {
      key = "tool.point";
    } else if (measurement.showDistances) {
      key = "tool.distance";
    }

    const expectedName = key && i18n && i18n.catalog.en[key];
    return expectedName && measurement.name === expectedName ? key : null;
  }

  function tagPotreeMeasurement(measurement) {
    const key = inferPotreeMeasurementKey(measurement);
    if (key) labelSceneObject(measurement, key);
  }

  function tagPotreeProfile(profile) {
    if (
      profile
      && !profile.__lidarViewerTranslationKey
      && profile.name === "Profile"
    ) {
      labelSceneObject(profile, "tool.profile");
    }
  }

  function tagPotreeVolume(volume) {
    if (
      !volume
      || volume.__lidarViewerTranslationKey
      || volume.name !== "Volume"
    ) return;

    const constructorName = volume.constructor && volume.constructor.name;
    const key = volume.clip
      ? "tool.clipVolume"
      : (constructorName === "SphereVolume" ? "tool.sphereVolume" : "tool.volume");
    labelSceneObject(volume, key);
  }

  function tagPotreePolygonClip(volume) {
    if (!volume || volume.__lidarViewerTranslationKey) return;
    const match = /^polygon_clip_volume_(\d+)$/.exec(volume.name || "");
    if (match) {
      labelSceneObject(volume, "tool.clipPolygonNumbered", { number: match[1] });
    }
  }

  function translatePotreeSceneTree() {
    if (!state.viewer || !state.viewer.scene || !window.$) return;
    const element = window.$("#jstree_scene");
    if (!element || !element.length || typeof element.jstree !== "function") return;
    const tree = element.jstree(true);
    if (!tree || typeof tree.get_node !== "function" || typeof tree.rename_node !== "function") return;

    Object.entries(POTREE_TREE_ROOT_KEYS).forEach(([nodeId, translationKey]) => {
      const node = tree.get_node(nodeId);
      if (node) tree.rename_node(node, t(translationKey));
    });

    const root = tree.get_node("#");
    const scene = state.viewer.scene;
    ((root && root.children_d) || []).forEach((nodeId) => {
      const node = tree.get_node(nodeId);
      if (!node || !node.data) return;

      let translationKey = node.data.__lidarViewerTranslationKey || null;
      if (!translationKey && (scene.cameraAnimations || []).includes(node.data)) {
        translationKey = "potree.tree.cameraAnimation";
      } else if (!translationKey && (scene.orientedImages || []).includes(node.data)) {
        translationKey = "potree.tree.orientedImages";
      } else if (!translationKey && (scene.images360 || []).includes(node.data)) {
        translationKey = "potree.tree.images360";
      } else if (
        !translationKey
        && window.THREE
        && typeof window.THREE.Camera === "function"
        && node.data instanceof window.THREE.Camera
      ) {
        translationKey = "potree.tree.camera";
      }

      if (translationKey) {
        tree.rename_node(
          node,
          t(translationKey, node.data.__lidarViewerTranslationValues || {}),
        );
      }
    });
  }

  function watchPotreeSceneTree() {
    const scene = state.viewer && state.viewer.scene;
    if (!scene || typeof scene.addEventListener !== "function") return;
    const scheduleTranslation = () => window.setTimeout(() => {
      translatePotreeSceneTree();
      schedulePotreeTranslation();
    }, 0);

    scene.addEventListener("measurement_added", (event) => {
      tagPotreeMeasurement(event.measurement);
      scheduleTranslation();
    });
    scene.addEventListener("profile_added", (event) => {
      tagPotreeProfile(event.profile);
      scheduleTranslation();
    });
    scene.addEventListener("volume_added", (event) => {
      tagPotreeVolume(event.volume);
      scheduleTranslation();
    });
    scene.addEventListener("polygon_clip_volume_added", (event) => {
      tagPotreePolygonClip(event.volume);
      scheduleTranslation();
    });
    [
      "camera_animation_added",
      "oriented_images_added",
      "360_images_added",
    ].forEach((eventName) => scene.addEventListener(eventName, scheduleTranslation));
  }

  function translateSceneObjects() {
    if (!state.viewer || !state.viewer.scene) return;
    const collections = [
      state.viewer.scene.measurements,
      state.viewer.scene.profiles,
      state.viewer.scene.volumes,
      state.viewer.scene.polygonClipVolumes,
    ];
    collections.forEach((collection) => {
      (collection || []).forEach((object) => {
        if (object.__lidarViewerTranslationKey) {
          object.name = t(
            object.__lidarViewerTranslationKey,
            object.__lidarViewerTranslationValues || {},
          );
        }
      });
    });
    translatePotreeSceneTree();
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
      populateDatasetInfo(state.metadata, {
        mode: state.source.mode,
        scan: state.dataset,
      }, state.pointcloud);
    }
    applyQuality(state.qualityMode);
    translateSceneObjects();
    translatePotreeInterface();
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

  function setLoadingOverlayVisible(visible) {
    const overlay = byId("loading-overlay");
    const chrome = [
      document.querySelector(".app-header"),
      document.querySelector(".toolstrip"),
      document.querySelector(".status-pill"),
    ].filter(Boolean);

    overlay.classList.toggle("dismissed", !visible);
    overlay.toggleAttribute("inert", !visible);
    overlay.setAttribute("aria-hidden", String(!visible));
    chrome.forEach((element) => {
      element.toggleAttribute("inert", visible);
      element.setAttribute("aria-hidden", String(visible));
    });
  }

  function showFatal(titleKey, messageKey, retry = true, values = {}) {
    setLoadingOverlayVisible(true);
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
      setLoadingOverlayVisible(true);
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

      installPotreeCrashTranslation();
      const viewer = new Potree.Viewer(byId("potree_render_area"));
      state.viewer = viewer;
      installPotreeMessageTranslation(viewer);
      watchPotreeSceneTree();

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
          installPotreeTranslations();
          viewer.setLanguage(i18n.language);
          translatePotreeSceneTree();
          observePotreeInterface();
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
      setLoadingOverlayVisible(false);
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
