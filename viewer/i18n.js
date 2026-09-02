(function () {
  "use strict";

  const STORAGE_KEY = "lidar-viewer.language.v1";
  const DEFAULT_LANGUAGE = "en";
  const SUPPORTED_LANGUAGES = Object.freeze(["en", "de"]);

  const ENGLISH = Object.freeze({
    "meta.title": "Protected LiDAR Viewer",
    "meta.description": "Protected interactive viewer for LiDAR point clouds",
    "app.name": "Protected LiDAR Viewer",
    "app.subtitle": "LiDAR point cloud",
    "aria.pointCloudView": "3D point cloud view",
    "aria.potreeSettings": "Advanced Potree settings",
    "aria.header": "Viewer header",
    "picker.scan": "Scan",
    "picker.scanAria": "Select scan",
    "picker.quality": "Quality",
    "picker.qualityAria": "Select rendering quality",
    "picker.qualityTitle": "More visible points increase detail, data traffic and GPU load",
    "picker.language": "Language",
    "picker.languageAria": "Select interface language",
    "quality.auto": "Auto",
    "quality.high": "High",
    "quality.maximum": "Maximum",
    "button.details": "Details",
    "button.detailsTitle": "Show or hide advanced Potree settings",
    "button.datasetInfo": "Dataset information",
    "button.help": "Help",
    "aria.analysisTools": "Analysis tools",
    "group.measure": "Measure",
    "group.analyse": "Analyse",
    "group.view": "View",
    "tool.point": "Point",
    "tool.pointTitle": "Determine the coordinates of a point",
    "tool.distance": "Distance",
    "tool.distanceTitle": "Measure a distance or polyline",
    "tool.height": "Height",
    "tool.heightTitle": "Measure a vertical height difference",
    "tool.area": "Area",
    "tool.areaTitle": "Measure a polygon area",
    "tool.angle": "Angle",
    "tool.angleTitle": "Measure an angle from three points",
    "tool.profile": "Profile",
    "tool.profileTitle": "Inspect an elevation profile along a line",
    "tool.clip": "Clip",
    "tool.clipTitle": "Clip the point cloud with a movable box",
    "action.fit": "Fit",
    "action.fitTitle": "Fit the complete scan into the view",
    "action.top": "Top view",
    "action.topTitle": "Show a vertical top view",
    "action.reset": "Reset",
    "action.resetTitle": "Remove all measurements, profiles and clipping boxes",
    "status.loading": "Viewer is loading …",
    "loading.prepareTitle": "Preparing point cloud",
    "loading.prepareMessage": "Loading metadata and the first points …",
    "button.reload": "Reload",
    "dialog.close": "Close dialog",
    "help.eyebrow": "Controls",
    "help.title": "How to use the viewer",
    "help.moveTitle": "Move the view",
    "help.leftMouse": "Left mouse button",
    "help.rotate": "Rotate",
    "help.rightMouse": "Right mouse button",
    "help.pan": "Pan",
    "help.mouseWheel": "Mouse wheel",
    "help.zoom": "Zoom",
    "help.analysisTitle": "Measure and analyse",
    "help.analysisText1": "Choose a tool and place points with the left mouse button. Use the right mouse button to finish a polyline, area or profile.",
    "help.analysisText2": "After completing a profile, the 2D analysis opens. CSV and LAS export are also available there.",
    "help.clipTitle": "Clipping box",
    "help.clipText": "Clip places a box and shows only points inside it. Use the coloured handles to move, rotate and scale the box.",
    "help.advancedTitle": "Advanced functions",
    "help.advancedText1": "Details opens the complete Potree interface, rendering options and measurement-geometry export as GeoJSON or DXF.",
    "help.advancedText2": "Quality levels affect rendering only. High and Maximum show more points but require more data traffic, memory and graphics performance.",
    "help.note": "Scan coordinates are local and measured in metres. No global coordinate reference system is defined.",
    "info.eyebrow": "Dataset",
    "info.title": "LiDAR scan",
    "info.points": "Points",
    "info.extent": "Extent",
    "info.attributes": "Attributes",
    "info.webFormat": "Web format",
    "info.source": "Source",
    "info.access": "Access",
    "info.quality": "Rendering",
    "info.coordinates": "Coordinates",
    "info.accessProtected": "Protected Zenodo link",
    "info.coordinatesLocal": "Local, m (no CRS)",
    "info.caption": "The point cloud is loaded on demand directly from the protected Zenodo dataset. Access is valid only in this browser tab.",
    "button.clearAccess": "Remove access from this tab",
    "reset.eyebrow": "Reset",
    "reset.title": "Remove analyses?",
    "reset.body": "All measurements, profiles and clipping boxes from this session will be removed. The scan itself remains unchanged.",
    "button.cancel": "Cancel",
    "button.removeAnalyses": "Remove analyses",
    "document.datasetTitle": "{name} · LiDAR Viewer",
    "brand.pointCloud": "LiDAR point cloud",
    "brand.pointCloudWithSource": "{source} · point cloud",
    "quality.info": "{label} · up to {count} points at once",
    "status.qualityChanged": "{label} rendering · up to {count} points at once",
    "error.missingAccessTitle": "Personal sharing link required",
    "error.missingAccessMessage": "This page contains no scan data itself. Open the complete link that was shared with you personally.",
    "error.accessDeniedTitle": "Sharing link is no longer valid",
    "error.accessDeniedMessage": "The link has expired, was revoked or does not match this Zenodo dataset.",
    "error.rangeTitle": "Zenodo streaming is unavailable",
    "error.rangeMessage": "The server did not return the required byte range. No complete scan file was buffered as a precaution.",
    "error.rateLimitTitle": "Zenodo is temporarily busy",
    "error.rateLimitMessage": "Please wait briefly and then try again.",
    "error.manifestTitle": "Viewer manifest is invalid",
    "error.manifestMessage": "The protected file list does not match the expected format.",
    "error.genericTitle": "Point cloud could not be loaded",
    "error.genericMessage": "Check the internet connection and reopen the personal sharing link.",
    "error.localServerTitle": "Local web server required",
    "error.localServerMessage": "Open this page through a local web server or GitHub Pages. Example from the project root: py scripts\\serve_viewer.py",
    "error.startTitle": "Viewer could not start",
    "error.startMessage": "A local Potree dependency is missing or could not be loaded.",
    "loading.switchTitle": "Switching scan",
    "loading.switchMessage": "The protected point cloud is being reloaded …",
    "loading.fileList": "Loading protected file list from Zenodo …",
    "loading.byteRanges": "Loading metadata and the first points by byte range …",
    "viewer.description": "LiDAR point cloud · local coordinates",
    "error.loadTimeout": "Timed out while loading the point cloud",
    "error.missingAccessComponent": "The local Zenodo access component is missing.",
    "measurement.pointInstruction": "Point: click a position in the point cloud.",
    "measurement.distanceInstruction": "Distance: click points and finish with a right-click.",
    "measurement.heightInstruction": "Height: click the lower and upper reference points.",
    "measurement.areaInstruction": "Area: click the vertices and finish with a right-click.",
    "measurement.angleInstruction": "Angle: click three points; the second point is the vertex.",
    "measurement.profileInstruction": "Profile: place at least two points and finish with a right-click.",
    "measurement.profileOpened": "2D profile opened · export CSV or LAS in the profile window",
    "measurement.clipName": "Clipping box",
    "measurement.clipInstruction": "Place the clipping box, then use its handles to move, rotate and scale it.",
    "status.fit": "Complete scan fitted to the view",
    "status.top": "Top view active",
    "status.reset": "Analyses removed · scan unchanged",
    "status.cancelled": "Tool cancelled",
    "attribute.rgb": "RGB colour",
    "dataset.sourceFallback": "LiDAR capture",
    "dataset.accessDraft": "Protected Zenodo draft",
    "dataset.accessPublished": "Protected Zenodo publication",
    "dataset.coordinates": "Local, {units} (no CRS)",
    "status.ready": "Ready · COPC · {quality} quality · protected Zenodo access",
    "status.readyWithPoints": "Ready · {count} points · COPC · {quality} quality · protected Zenodo access"
  });

  const GERMAN = Object.freeze({
    "meta.title": "Geschützter LiDAR-Viewer",
    "meta.description": "Geschützter interaktiver Viewer für LiDAR-Punktwolken",
    "app.name": "Geschützter LiDAR-Viewer",
    "app.subtitle": "LiDAR-Punktwolke",
    "aria.pointCloudView": "3D-Punktwolkenansicht",
    "aria.potreeSettings": "Erweiterte Potree-Einstellungen",
    "aria.header": "Viewer-Kopfzeile",
    "picker.scan": "Scan",
    "picker.scanAria": "Scan auswählen",
    "picker.quality": "Qualität",
    "picker.qualityAria": "Darstellungsqualität auswählen",
    "picker.qualityTitle": "Mehr sichtbare Punkte erhöhen Detailgrad, Datenverkehr und GPU-Last",
    "picker.language": "Sprache",
    "picker.languageAria": "Sprache der Oberfläche auswählen",
    "quality.auto": "Auto",
    "quality.high": "Hoch",
    "quality.maximum": "Maximum",
    "button.details": "Details",
    "button.detailsTitle": "Erweiterte Potree-Einstellungen ein- oder ausblenden",
    "button.datasetInfo": "Datensatzinformation",
    "button.help": "Bedienungshilfe",
    "aria.analysisTools": "Analysewerkzeuge",
    "group.measure": "Messen",
    "group.analyse": "Auswerten",
    "group.view": "Ansicht",
    "tool.point": "Punkt",
    "tool.pointTitle": "Koordinate eines Punktes bestimmen",
    "tool.distance": "Strecke",
    "tool.distanceTitle": "Strecke oder Linienzug messen",
    "tool.height": "Höhe",
    "tool.heightTitle": "Vertikalen Höhenunterschied messen",
    "tool.area": "Fläche",
    "tool.areaTitle": "Polygonfläche messen",
    "tool.angle": "Winkel",
    "tool.angleTitle": "Winkel aus drei Punkten messen",
    "tool.profile": "Profil",
    "tool.profileTitle": "Höhenprofil entlang einer Linie untersuchen",
    "tool.clip": "Schnitt",
    "tool.clipTitle": "Punktwolke mit einer verschiebbaren Box beschneiden",
    "action.fit": "Einpassen",
    "action.fitTitle": "Gesamten Scan in die Ansicht einpassen",
    "action.top": "Draufsicht",
    "action.topTitle": "Senkrechte Draufsicht anzeigen",
    "action.reset": "Rücksetzen",
    "action.resetTitle": "Alle Messungen, Profile und Schnittboxen entfernen",
    "status.loading": "Viewer wird geladen …",
    "loading.prepareTitle": "Punktwolke wird vorbereitet",
    "loading.prepareMessage": "Metadaten und erste Punkte werden geladen …",
    "button.reload": "Neu laden",
    "dialog.close": "Dialog schließen",
    "help.eyebrow": "Bedienung",
    "help.title": "So funktioniert der Viewer",
    "help.moveTitle": "Ansicht bewegen",
    "help.leftMouse": "Linke Maustaste",
    "help.rotate": "Drehen",
    "help.rightMouse": "Rechte Maustaste",
    "help.pan": "Verschieben",
    "help.mouseWheel": "Mausrad",
    "help.zoom": "Zoomen",
    "help.analysisTitle": "Messen und auswerten",
    "help.analysisText1": "Werkzeug wählen und Punkte mit der linken Maustaste setzen. Mit der rechten Maustaste wird ein Linienzug, eine Fläche oder ein Profil abgeschlossen.",
    "help.analysisText2": "Beim Profil öffnet sich anschließend die 2D-Auswertung. Dort sind auch CSV- und LAS-Export verfügbar.",
    "help.clipTitle": "Schnittbox",
    "help.clipText": "„Schnitt“ setzt eine Box und zeigt nur Punkte innerhalb der Box. Die farbigen Griffe dienen zum Verschieben, Drehen und Skalieren.",
    "help.advancedTitle": "Erweiterte Funktionen",
    "help.advancedText1": "Unter „Details“ stehen die vollständige Potree-Oberfläche, Darstellungsoptionen und der Export von Messgeometrien als GeoJSON oder DXF bereit.",
    "help.advancedText2": "Die Qualitätsstufen ändern nur die Darstellung. „Hoch“ und „Maximum“ zeigen mehr Punkte, benötigen aber mehr Datenverkehr, Arbeitsspeicher und Grafikleistung.",
    "help.note": "Die Scan-Koordinaten sind lokal und in Metern. Es ist kein globales Koordinatenreferenzsystem hinterlegt.",
    "info.eyebrow": "Datensatz",
    "info.title": "LiDAR-Scan",
    "info.points": "Punkte",
    "info.extent": "Ausdehnung",
    "info.attributes": "Attribute",
    "info.webFormat": "Webformat",
    "info.source": "Quelle",
    "info.access": "Zugriff",
    "info.quality": "Darstellung",
    "info.coordinates": "Koordinaten",
    "info.accessProtected": "Geschützter Zenodo-Link",
    "info.coordinatesLocal": "Lokal, m (kein CRS)",
    "info.caption": "Die Punktwolke wird bei Bedarf direkt aus dem geschützten Zenodo-Datensatz geladen. Der Zugang gilt nur in diesem Browser-Tab.",
    "button.clearAccess": "Zugang aus diesem Tab entfernen",
    "reset.eyebrow": "Zurücksetzen",
    "reset.title": "Auswertungen entfernen?",
    "reset.body": "Alle Messungen, Profile und Schnittboxen dieser Sitzung werden entfernt. Der Scan selbst bleibt unverändert.",
    "button.cancel": "Abbrechen",
    "button.removeAnalyses": "Auswertungen entfernen",
    "document.datasetTitle": "{name} · LiDAR-Viewer",
    "brand.pointCloud": "LiDAR-Punktwolke",
    "brand.pointCloudWithSource": "{source} · Punktwolke",
    "quality.info": "{label} · bis zu {count} Punkte gleichzeitig",
    "status.qualityChanged": "Darstellung {label} · bis zu {count} Punkte gleichzeitig",
    "error.missingAccessTitle": "Persönlicher Freigabelink erforderlich",
    "error.missingAccessMessage": "Diese Seite enthält selbst keine Scandaten. Öffnen Sie den vollständigen Link, den Sie persönlich erhalten haben.",
    "error.accessDeniedTitle": "Freigabelink nicht mehr gültig",
    "error.accessDeniedMessage": "Der Link ist abgelaufen, wurde widerrufen oder passt nicht zu diesem Zenodo-Datensatz.",
    "error.rangeTitle": "Zenodo-Streaming nicht verfügbar",
    "error.rangeMessage": "Der Server lieferte nicht den benötigten Bytebereich. Es wurde vorsorglich keine vollständige Scandatei geladen.",
    "error.rateLimitTitle": "Zenodo ist vorübergehend ausgelastet",
    "error.rateLimitMessage": "Bitte warten Sie kurz und versuchen Sie es anschließend erneut.",
    "error.manifestTitle": "Viewer-Manifest ist ungültig",
    "error.manifestMessage": "Die geschützte Dateiliste entspricht nicht dem erwarteten Format.",
    "error.genericTitle": "Punktwolke konnte nicht geladen werden",
    "error.genericMessage": "Prüfen Sie die Internetverbindung und öffnen Sie den persönlichen Freigabelink erneut.",
    "error.localServerTitle": "Lokaler Webserver erforderlich",
    "error.localServerMessage": "Bitte diese Seite über einen lokalen Webserver oder GitHub Pages öffnen. Beispiel im Projektstamm: py scripts\\serve_viewer.py",
    "error.startTitle": "Viewer konnte nicht starten",
    "error.startMessage": "Eine lokale Potree-Abhängigkeit fehlt oder konnte nicht geladen werden.",
    "loading.switchTitle": "Scan wird gewechselt",
    "loading.switchMessage": "Die geschützte Punktwolke wird neu geladen …",
    "loading.fileList": "Geschützte Dateiliste wird von Zenodo geladen …",
    "loading.byteRanges": "Metadaten und erste Punkte werden bereichsweise geladen …",
    "viewer.description": "LiDAR-Punktwolke · lokale Koordinaten",
    "error.loadTimeout": "Zeitüberschreitung beim Laden der Punktwolke",
    "error.missingAccessComponent": "Die lokale Zenodo-Zugriffskomponente fehlt.",
    "measurement.pointInstruction": "Punkt: Position in der Punktwolke anklicken.",
    "measurement.distanceInstruction": "Strecke: Punkte anklicken, mit Rechtsklick abschließen.",
    "measurement.heightInstruction": "Höhe: unteren und oberen Bezugspunkt anklicken.",
    "measurement.areaInstruction": "Fläche: Eckpunkte anklicken, mit Rechtsklick abschließen.",
    "measurement.angleInstruction": "Winkel: drei Punkte anklicken; der zweite Punkt ist der Scheitel.",
    "measurement.profileInstruction": "Profil: mindestens zwei Punkte setzen und mit Rechtsklick abschließen.",
    "measurement.profileOpened": "2D-Profil geöffnet · Export als CSV oder LAS im Profilfenster",
    "measurement.clipName": "Schnittbox",
    "measurement.clipInstruction": "Schnittbox platzieren; danach mit den Griffen verschieben, drehen und skalieren.",
    "status.fit": "Gesamter Scan in die Ansicht eingepasst",
    "status.top": "Draufsicht aktiv",
    "status.reset": "Auswertungen entfernt · Scan unverändert",
    "status.cancelled": "Werkzeug abgebrochen",
    "attribute.rgb": "RGB-Farbe",
    "dataset.sourceFallback": "LiDAR-Aufnahme",
    "dataset.accessDraft": "Geschützter Zenodo-Entwurf",
    "dataset.accessPublished": "Geschützte Zenodo-Veröffentlichung",
    "dataset.coordinates": "Lokal, {units} (kein CRS)",
    "status.ready": "Bereit · COPC · Qualität {quality} · geschützter Zenodo-Zugriff",
    "status.readyWithPoints": "Bereit · {count} Punkte · COPC · Qualität {quality} · geschützter Zenodo-Zugriff"
  });

  const CATALOG = Object.freeze({ en: ENGLISH, de: GERMAN });

  function normaliseLanguage(value) {
    if (typeof value !== "string") return null;
    const primary = value.trim().toLowerCase().split(/[-_]/, 1)[0];
    return SUPPORTED_LANGUAGES.includes(primary) ? primary : null;
  }

  function readSavedLanguage() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return SUPPORTED_LANGUAGES.includes(saved) ? saved : null;
    } catch (_error) {
      return null;
    }
  }

  function browserLanguages() {
    const navigatorObject = window.navigator || {};
    const preferred = Array.isArray(navigatorObject.languages) ? navigatorObject.languages : [];
    return [...preferred, navigatorObject.language].filter(Boolean);
  }

  function detectLanguage() {
    const saved = readSavedLanguage();
    if (saved) return saved;
    for (const candidate of browserLanguages()) {
      const language = normaliseLanguage(candidate);
      if (language) return language;
    }
    return DEFAULT_LANGUAGE;
  }

  let activeLanguage = detectLanguage();

  function interpolate(template, values) {
    const parameters = values || {};
    return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) =>
      Object.hasOwn(parameters, name) ? String(parameters[name]) : match);
  }

  function translate(key, values) {
    const selected = CATALOG[activeLanguage] || ENGLISH;
    const template = selected[key] ?? ENGLISH[key] ?? key;
    return interpolate(template, values);
  }

  function apply(root) {
    const documentRoot = root || (typeof document !== "undefined" ? document : null);
    if (!documentRoot) return;

    const documentElement = documentRoot.documentElement
      || (documentRoot.ownerDocument && documentRoot.ownerDocument.documentElement);
    if (documentElement) documentElement.lang = activeLanguage;

    const bindings = Object.freeze([
      ["data-i18n", "textContent"],
      ["data-i18n-title", "title"],
      ["data-i18n-aria-label", "aria-label"],
      ["data-i18n-content", "content"],
    ]);
    for (const [attribute, target] of bindings) {
      documentRoot.querySelectorAll("[" + attribute + "]").forEach((element) => {
        const key = element.getAttribute(attribute);
        if (target === "textContent") {
          element.textContent = translate(key);
        } else {
          element.setAttribute(target, translate(key));
        }
      });
    }

    documentRoot.querySelectorAll("[data-language-selector]").forEach((selector) => {
      selector.value = activeLanguage;
    });
  }

  function setLanguage(value, { persist = true } = {}) {
    activeLanguage = normaliseLanguage(value) || DEFAULT_LANGUAGE;
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, activeLanguage);
      } catch (_error) {
        // Language selection still works when persistent storage is unavailable.
      }
    }
    apply();
    if (typeof window.CustomEvent === "function" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new window.CustomEvent("lidar-language-changed", {
        detail: Object.freeze({ language: activeLanguage }),
      }));
    }
    return activeLanguage;
  }

  window.LidarI18n = Object.freeze({
    STORAGE_KEY,
    catalog: CATALOG,
    supportedLanguages: SUPPORTED_LANGUAGES,
    apply,
    detectLanguage,
    locale: () => activeLanguage === "de" ? "de-AT" : "en-GB",
    normaliseLanguage,
    setLanguage,
    t: translate,
    get language() { return activeLanguage; },
  });
})();
