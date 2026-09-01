(function () {
  "use strict";

  const QUALITY_STORAGE_KEY = "lidar-viewer.render-quality.v1";
  const DEFAULT_QUALITY_PROFILES = Object.freeze({
    auto: Object.freeze({
      label: "Auto",
      desktopPointBudget: 3_500_000,
      compactPointBudget: 1_200_000,
      minNodeSize: 20,
      pointSize: 0.85,
      shape: "CIRCLE",
    }),
    high: Object.freeze({
      label: "Hoch",
      desktopPointBudget: 5_500_000,
      compactPointBudget: 2_000_000,
      minNodeSize: 10,
      pointSize: 0.72,
      shape: "CIRCLE",
    }),
    maximum: Object.freeze({
      label: "Maximum",
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
      label: typeof configured.label === "string" && configured.label.trim()
        ? configured.label.trim() : defaults.label,
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
    name: runtimeConfig.name || "Geschützter LiDAR-Viewer",
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
  };

  const byId = (id) => document.getElementById(id);
  const toolButtons = () => Array.from(document.querySelectorAll("[data-tool]"));
  const actionButtons = () => Array.from(document.querySelectorAll("[data-action]"));

  function formatInteger(value) {
    return new Intl.NumberFormat("de-AT", { maximumFractionDigits: 0 }).format(value);
  }

  function formatMeters(value) {
    return new Intl.NumberFormat("de-AT", {
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
      // Der Viewer funktioniert auch, wenn dauerhafte Browser-Speicherung gesperrt ist.
    }
  }

  function activePointBudget(profile) {
    return state.compactDevice ? profile.compactPointBudget : profile.desktopPointBudget;
  }

  function updateQualityInfo(profile, pointBudget) {
    const info = byId("info-quality");
    if (!info) return;
    info.textContent = `${profile.label} · bis zu ${formatInteger(pointBudget)} Punkte gleichzeitig`;
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
      setStatus(
        `Darstellung ${profile.label} · bis zu ${formatInteger(pointBudget)} Punkte gleichzeitig`,
        "ready",
      );
    }

    return profile;
  }

  async function resolveDataSource() {
    if (!window.ZenodoViewerAccess) {
      throw new Error("Die lokale Zenodo-Zugriffskomponente fehlt.");
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
    document.title = `${name} · LiDAR-Viewer`;
    const brandName = document.querySelector(".brand-copy strong");
    if (brandName) brandName.textContent = name;
    const brandSubtitle = document.querySelector(".brand-copy span");
    if (brandSubtitle) {
      brandSubtitle.textContent = sourceLabel ? `${sourceLabel} · Punktwolke` : "LiDAR-Punktwolke";
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

  function setStatus(message, tone = "ready") {
    const status = byId("viewer-status");
    byId("viewer-status-text").textContent = message;
    status.classList.remove("ready", "action", "error");
    status.classList.add(tone);
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
    let instruction;

    switch (toolName) {
      case "point":
        object = viewer.measuringTool.startInsertion({
          showDistances: false,
          showAngles: false,
          showCoordinates: true,
          showArea: false,
          closed: true,
          maxMarkers: 1,
          name: "Punkt",
        });
        instruction = "Punkt: Position in der Punktwolke anklicken.";
        break;

      case "distance":
        object = viewer.measuringTool.startInsertion({
          showDistances: true,
          showArea: false,
          closed: false,
          name: "Strecke",
        });
        instruction = "Strecke: Punkte anklicken, mit Rechtsklick abschließen.";
        break;

      case "height":
        object = viewer.measuringTool.startInsertion({
          showDistances: false,
          showHeight: true,
          showArea: false,
          closed: false,
          maxMarkers: 2,
          name: "Höhe",
        });
        instruction = "Höhe: unteren und oberen Bezugspunkt anklicken.";
        break;

      case "area":
        object = viewer.measuringTool.startInsertion({
          showDistances: true,
          showArea: true,
          closed: true,
          name: "Fläche",
        });
        instruction = "Fläche: Eckpunkte anklicken, mit Rechtsklick abschließen.";
        break;

      case "angle":
        object = viewer.measuringTool.startInsertion({
          showDistances: false,
          showAngles: true,
          showArea: false,
          closed: true,
          maxMarkers: 3,
          name: "Winkel",
        });
        instruction = "Winkel: drei Punkte anklicken; der zweite Punkt ist der Scheitel.";
        break;

      case "profile": {
        const profile = viewer.profileTool.startInsertion({ name: "Profil" });
        object = profile;
        instruction = "Profil: mindestens zwei Punkte setzen und mit Rechtsklick abschließen.";

        const openFinishedProfile = (event) => {
          if (event.button !== 2) return;
          window.setTimeout(() => {
            if (profile.points.length >= 2 && viewer.profileWindow && viewer.profileWindowController) {
              viewer.profileWindow.show();
              viewer.profileWindowController.setProfile(profile);
              setStatus("2D-Profil geöffnet · Export als CSV oder LAS im Profilfenster", "ready");
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
        object = viewer.volumeTool.startInsertion({ clip: true, name: "Schnittbox" });
        instruction = "Schnittbox platzieren; danach mit den Griffen verschieben, drehen und skalieren.";
        break;

      default:
        return;
    }

    markActiveTool(toolName);
    setStatus(instruction, "action");
    return object;
  }

  function fitView() {
    if (!state.ready) return;
    state.viewer.dispatchEvent({ type: "cancel_insertions" });
    clearActiveTool();
    state.viewer.fitToScreen(0.85, 350);
    setStatus("Gesamter Scan in die Ansicht eingepasst", "ready");
  }

  function topView() {
    if (!state.ready) return;
    state.viewer.dispatchEvent({ type: "cancel_insertions" });
    clearActiveTool();
    state.viewer.setTopView();
    setStatus("Draufsicht aktiv", "ready");
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
    setStatus("Auswertungen entfernt · Scan unverändert", "ready");
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
    const attributes = rawAttributes.map((name) => name === "rgb" ? "RGB-Farbe" : name);
    byId("info-attributes").textContent = attributes.join(", ") || "–";
    byId("info-format").textContent = configured.webFormat || "COPC 1.0 · LAZ";
    byId("info-source").textContent = configured.source || "LiDAR-Aufnahme";
    byId("info-access").textContent = source.mode === "draft"
      ? "Geschützter Zenodo-Entwurf"
      : "Geschützte Zenodo-Veröffentlichung";
    const coordinates = byId("info-coordinates");
    if (coordinates) coordinates.textContent = `Lokal, ${configured.units || "m"} (kein CRS)`;
  }

  function showFatal(title, message, retry = true) {
    const overlay = byId("loading-overlay");
    overlay.classList.remove("dismissed");
    byId("loading-spinner").classList.add("hidden");
    byId("loading-title").textContent = title;
    byId("loading-message").textContent = message;
    byId("loading-retry").classList.toggle("hidden", !retry);
    setStatus(title, "error");
  }

  function describeFailure(error) {
    const code = error && error.code;
    if (code === "missing_access" || code === "invalid_access") {
      return {
        title: "Persönlicher Freigabelink erforderlich",
        message: "Diese Seite enthält selbst keine Scandaten. Öffnen Sie den vollständigen Link, den Sie persönlich erhalten haben.",
        retry: false,
      };
    }
    if (code === "access_denied") {
      return {
        title: "Freigabelink nicht mehr gültig",
        message: "Der Link ist abgelaufen, wurde widerrufen oder passt nicht zu diesem Zenodo-Datensatz.",
        retry: false,
      };
    }
    if (["range_failed", "range_header", "range_length"].includes(code)) {
      return {
        title: "Zenodo-Streaming nicht verfügbar",
        message: "Der Server lieferte nicht den benötigten Bytebereich. Es wurde vorsorglich keine vollständige Scandatei geladen.",
        retry: true,
      };
    }
    if (code === "rate_limit") {
      return {
        title: "Zenodo ist vorübergehend ausgelastet",
        message: "Bitte warten Sie kurz und versuchen Sie es anschließend erneut.",
        retry: true,
      };
    }
    if (code === "invalid_manifest") {
      return {
        title: "Viewer-Manifest ist ungültig",
        message: "Die geschützte Dateiliste entspricht nicht dem erwarteten Format.",
        retry: false,
      };
    }
    return {
      title: "Punktwolke konnte nicht geladen werden",
      message: "Prüfen Sie die Internetverbindung und öffnen Sie den persönlichen Freigabelink erneut.",
      retry: true,
    };
  }

  function wireInterface() {
    window.addEventListener("potree_pointcloud_error", (event) => {
      if (!state.ready) return;
      state.ready = false;
      disableControls();
      const detail = event.detail || {};
      console.error("Punktwolken-Streamingfehler", {
        name: detail.name || "Error",
        code: detail.code || "pointcloud_load",
        status: detail.status || null,
      });
      const failure = describeFailure(detail);
      showFatal(failure.title, failure.message, failure.retry);
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
    byId("scan-selector").addEventListener("change", (event) => {
      if (!window.ZenodoViewerAccess.selectScan(event.target.value)) return;
      byId("loading-overlay").classList.remove("dismissed");
      byId("loading-spinner").classList.remove("hidden");
      byId("loading-title").textContent = "Scan wird gewechselt";
      byId("loading-message").textContent = "Die geschützte Punktwolke wird neu geladen …";
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
      if (state.ready) setStatus("Werkzeug abgebrochen", "ready");
    });
  }

  async function initialise() {
    applyDatasetName(CONFIG.name);
    wireInterface();
    state.compactDevice = window.matchMedia("(max-width: 760px)").matches;
    state.qualityMode = readQualityPreference();
    applyQuality(state.qualityMode);

    if (window.location.protocol === "file:") {
      showFatal(
        "Lokaler Webserver erforderlich",
        "Bitte diese Seite über einen lokalen Webserver oder GitHub Pages öffnen. Beispiel im Projektstamm: py scripts\\serve_viewer.py",
      );
      return;
    }

    if (!window.Potree || !window.$ || !window.ZenodoViewerAccess) {
      showFatal("Viewer konnte nicht starten", "Eine lokale Potree-Abhängigkeit fehlt oder konnte nicht geladen werden.");
      return;
    }

    try {
      byId("loading-message").textContent = "Geschützte Dateiliste wird von Zenodo geladen …";
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
      byId("loading-message").textContent = "Metadaten und erste Punkte werden bereichsweise geladen …";

      const viewer = new Potree.Viewer(byId("potree_render_area"));
      state.viewer = viewer;

      viewer.setEDLEnabled(true);
      viewer.setEDLRadius(1.25);
      viewer.setEDLStrength(0.45);
      viewer.setFOV(58);
      applyQuality(state.qualityMode);
      viewer.setBackground("gradient");
      viewer.setLengthUnit("m");
      viewer.setDescription("LiDAR-Punktwolke · lokale Koordinaten");

      const guiReady = new Promise((resolve) => {
        viewer.loadGUI(() => {
          viewer.setLanguage("de");
          resolve();
        });
      });

      const metadataReady = Promise.resolve(null);
      const pointCloudReady = window.ZenodoViewerAccess.loadPointCloud();

      const [metadata, , loaded] = await withTimeout(
        Promise.all([metadataReady, guiReady, pointCloudReady]),
        CONFIG.loadTimeoutMs,
        "Zeitüberschreitung beim Laden der Punktwolke",
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
        startTool: startMeasurement,
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
      const countLabel = Number.isFinite(pointCount) ? `${formatInteger(pointCount)} Punkte · ` : "";
      setStatus(
        `Bereit · ${countLabel}COPC · Qualität ${state.qualityProfile.label} · geschützter Zenodo-Zugriff`,
        "ready",
      );
      byId("loading-overlay").classList.add("dismissed");
    } catch (error) {
      console.error("Viewer-Fehler", {
        name: error && error.name ? error.name : "Error",
        code: error && error.code ? error.code : "unknown",
        status: error && error.status ? error.status : null,
      });
      const failure = describeFailure(error);
      showFatal(failure.title, failure.message, failure.retry);
    }
  }

  initialise();
})();
