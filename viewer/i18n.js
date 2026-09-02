(function () {
  "use strict";

  const LANGUAGE_STORAGE_KEY = "lidar-viewer.language.v1";
  const SUPPORTED_LANGUAGES = Object.freeze(["en", "de"]);

  const ENGLISH = Object.freeze({
    "meta.description": "Protected interactive viewer for LiDAR point clouds",
    "app.name": "Protected LiDAR Viewer",
    "app.documentTitle": "{{name}} · LiDAR Viewer",
    "app.javascriptRequired": "This viewer requires JavaScript.",
    "aria.pointCloudView": "3D point cloud view",
    "aria.potreeSettings": "Advanced Potree settings",
    "aria.header": "Viewer header",
    "aria.analysisTools": "Analysis tools",
    "brand.subtitle": "LiDAR point cloud",
    "brand.subtitleSource": "{{source}} · point cloud",
    "scan.label": "Scan",
    "scan.select": "Select scan",
    "quality.label": "Quality",
    "quality.select": "Select rendering quality",
    "quality.hint": "More visible points increase detail, data traffic, and GPU load",
    "quality.auto": "Auto",
    "quality.high": "High",
    "quality.maximum": "Maximum",
    "quality.info": "{{quality}} · up to {{points}} points at once",
    "quality.status": "Rendering: {{quality}} · up to {{points}} points at once",
    "language.label": "Language",
    "language.switchToEnglish": "Switch to English",
    "language.switchToGerman": "Switch to German",
    "header.details": "Details",
    "header.detailsTitle": "Show or hide advanced Potree settings",
    "header.datasetInfo": "Dataset information",
    "header.help": "Viewer help",
    "tools.measure": "Measure",
    "tools.evaluate": "Analyse",
    "tools.view": "View",
    "tools.point": "Point",
    "tools.pointTitle": "Determine a point coordinate",
    "tools.distance": "Distance",
    "tools.distanceTitle": "Measure a distance or polyline",
    "tools.height": "Height",
    "tools.heightTitle": "Measure a vertical height difference",
    "tools.area": "3D area",
    "tools.areaTitle": "Measure an orientation-independent 3D polygon area and show its XY projection",
    "tools.angle": "Angle",
    "tools.angleTitle": "Measure an angle from three points",
    "tools.profile": "Profile",
    "tools.profileTitle": "Inspect an elevation profile along a line",
    "tools.clip": "Clip",
    "tools.clipTitle": "Clip the point cloud with a movable box",
    "tools.fit": "Fit",
    "tools.fitTitle": "Fit the entire scan into the view",
    "tools.top": "Top view",
    "tools.topTitle": "Show a vertical top view",
    "tools.reset": "Reset",
    "tools.resetTitle": "Remove all measurements, profiles, and clipping boxes",
    "status.loading": "Loading viewer …",
    "status.pointInstruction": "Point: click a position in the point cloud.",
    "status.distanceInstruction": "Distance: click points; right-click to finish.",
    "status.heightInstruction": "Height: click the lower and upper reference points.",
    "status.areaInstruction": "3D area: click corner points; right-click to finish. The label also shows the XY projection.",
    "status.areaMeasured": "3D area {{area}} · XY projection {{projected}}",
    "status.areaNonPlanar": "⚠ Points are not coplanar (maximum deviation {{deviation}}) · 3D area {{area}} is a planar approximation · XY projection {{projected}}",
    "status.areaInvalid": "3D area unavailable · place at least three non-collinear points",
    "status.angleInstruction": "Angle: click three points; the second point is the vertex.",
    "status.profileInstruction": "Profile: add at least two points; right-click to finish.",
    "status.profileOpened": "2D profile opened · export CSV or LAS in the profile window",
    "status.clipInstruction": "Place the clipping box, then use its handles to move, rotate, and scale it.",
    "status.fit": "Entire scan fitted into the view",
    "status.top": "Top view active",
    "status.reset": "Analyses removed · scan unchanged",
    "status.cancelled": "Tool cancelled",
    "status.pointCount": "{{points}} points · ",
    "status.ready": "Ready · {{count}}COPC · quality {{quality}} · protected Zenodo access",
    "loading.title": "Preparing point cloud",
    "loading.initial": "Loading metadata and initial points …",
    "loading.retry": "Reload",
    "loading.switchTitle": "Switching scan",
    "loading.switchMessage": "Reloading the protected point cloud …",
    "loading.manifest": "Loading the protected file list from Zenodo …",
    "loading.points": "Loading metadata and initial points by byte range …",
    "help.eyebrow": "Help",
    "help.title": "How to use the viewer",
    "help.navigationTitle": "Move the view",
    "help.leftMouse": "Left mouse button",
    "help.rotate": "Rotate",
    "help.rightMouse": "Right mouse button",
    "help.pan": "Pan",
    "help.mouseWheel": "Mouse wheel",
    "help.zoom": "Zoom",
    "help.measureTitle": "Measure and analyse",
    "help.measureText": "Choose a tool and place points with the left mouse button. Right-click to finish a polyline, 3D area, or profile.",
    "help.areaText": "The 3D area uses all coordinates and works on floors, roofs, and walls; XY is its horizontal projection. Non-coplanar points trigger a warning because the 3D value is then only a planar approximation. Use a simple ordered polygon without self-intersections.",
    "help.profileText": "Completing a profile opens the 2D analysis, which also provides CSV and LAS exports.",
    "help.clipTitle": "Clipping box",
    "help.clipText": "Clip places a box and shows only the points inside it. Use the coloured handles to move, rotate, and scale the box.",
    "help.advancedTitle": "Advanced features",
    "help.advancedText": "Details opens the complete Potree interface, rendering options, and GeoJSON or DXF export for measurement geometries.",
    "help.qualityText": "Quality levels affect rendering only. High and Maximum display more points but require more data traffic, memory, and graphics performance.",
    "help.coordinates": "Scan coordinates are local and measured in metres. No global coordinate reference system is defined.",
    "dialog.close": "Close dialog",
    "info.eyebrow": "Dataset",
    "info.defaultTitle": "LiDAR scan",
    "info.points": "Points",
    "info.extent": "Extent",
    "info.attributes": "Attributes",
    "info.webFormat": "Web format",
    "info.source": "Source",
    "info.access": "Access",
    "info.rendering": "Rendering",
    "info.coordinates": "Coordinates",
    "info.accessLink": "Protected Zenodo link",
    "info.coordinatesDefault": "Local, m (no CRS)",
    "info.caption": "The point cloud is streamed on demand directly from the protected Zenodo dataset. Access is valid only in this browser tab.",
    "info.clearAccess": "Remove access from this tab",
    "info.rgbColour": "RGB colour",
    "info.rgbaColour": "RGBA colour",
    "attribute.position": "Position",
    "attribute.intensity": "Intensity",
    "attribute.classification": "Classification",
    "attribute.returnNumber": "Return number",
    "attribute.numberOfReturns": "Number of returns",
    "attribute.sourceId": "Source ID",
    "attribute.pointSourceId": "Point source ID",
    "attribute.gpsTime": "GPS time",
    "info.defaultSource": "LiDAR capture",
    "info.draftAccess": "Protected Zenodo draft",
    "info.publishedAccess": "Protected Zenodo publication",
    "info.localCoordinates": "Local, {{units}} (no CRS)",
    "reset.eyebrow": "Reset",
    "reset.title": "Remove analyses?",
    "reset.message": "All measurements, profiles, and clipping boxes from this session will be removed. The scan itself remains unchanged.",
    "reset.cancel": "Cancel",
    "reset.confirm": "Remove analyses",
    "measurement.point": "Point",
    "measurement.distance": "Distance",
    "measurement.height": "Height",
    "measurement.area": "3D area",
    "area.label3d": "3D {{area}}",
    "area.labelProjectedXY": "XY {{area}}",
    "area.nonPlanarWarning": "⚠ approx.",
    "area.invalidWarning": "3D area unavailable",
    "measurement.angle": "Angle",
    "measurement.circle": "Circle",
    "measurement.azimuth": "Azimuth",
    "measurement.volume": "Volume",
    "measurement.profile": "Profile",
    "measurement.clipBox": "Clipping box",
    "measurement.polygonClip": "Polygon clipping {{number}}",
    "measurement.selectionBox": "Selection box {{number}}",
    "measurement.clipVolume": "Clipping volume {{number}}",
    "annotation.defaultTitle": "Annotation title",
    "annotation.defaultDescription": "Annotation description",
    "viewer.description": "LiDAR point cloud · local coordinates",
    "error.localServerTitle": "Local web server required",
    "error.localServerMessage": "Open this page through a local web server or GitHub Pages. From the project root, for example: py scripts\\serve_viewer.py",
    "error.startTitle": "Viewer could not start",
    "error.startMessage": "A local Potree dependency is missing or could not be loaded.",
    "error.timeout": "Timed out while loading the point cloud",
    "error.accessRequiredTitle": "Personal access link required",
    "error.accessRequiredMessage": "This page contains no scan data. Open the complete link that you received personally.",
    "error.accessDeniedTitle": "Access link no longer valid",
    "error.accessDeniedMessage": "The link has expired, was revoked, or does not match this Zenodo dataset.",
    "error.rangeTitle": "Zenodo streaming unavailable",
    "error.rangeMessage": "The server did not return the required byte range. No complete scan file was loaded as a precaution.",
    "error.rateLimitTitle": "Zenodo is temporarily busy",
    "error.rateLimitMessage": "Wait briefly, then try again.",
    "error.manifestTitle": "Viewer manifest is invalid",
    "error.manifestMessage": "The protected file list does not match the expected format.",
    "error.loadTitle": "Point cloud could not be loaded",
    "error.loadMessage": "Check the internet connection and reopen the personal access link.",
  });

  const GERMAN = Object.freeze({
    "meta.description": "Geschützter interaktiver Viewer für LiDAR-Punktwolken",
    "app.name": "Geschützter LiDAR-Viewer",
    "app.documentTitle": "{{name}} · LiDAR-Viewer",
    "app.javascriptRequired": "Dieser Viewer benötigt JavaScript.",
    "aria.pointCloudView": "3D-Punktwolkenansicht",
    "aria.potreeSettings": "Erweiterte Potree-Einstellungen",
    "aria.header": "Viewer-Kopfzeile",
    "aria.analysisTools": "Analysewerkzeuge",
    "brand.subtitle": "LiDAR-Punktwolke",
    "brand.subtitleSource": "{{source}} · Punktwolke",
    "scan.label": "Scan",
    "scan.select": "Scan auswählen",
    "quality.label": "Qualität",
    "quality.select": "Darstellungsqualität auswählen",
    "quality.hint": "Mehr sichtbare Punkte erhöhen Detailgrad, Datenverkehr und GPU-Last",
    "quality.auto": "Auto",
    "quality.high": "Hoch",
    "quality.maximum": "Maximum",
    "quality.info": "{{quality}} · bis zu {{points}} Punkte gleichzeitig",
    "quality.status": "Darstellung: {{quality}} · bis zu {{points}} Punkte gleichzeitig",
    "language.label": "Sprache",
    "language.switchToEnglish": "Zu Englisch wechseln",
    "language.switchToGerman": "Zu Deutsch wechseln",
    "header.details": "Details",
    "header.detailsTitle": "Erweiterte Potree-Einstellungen ein- oder ausblenden",
    "header.datasetInfo": "Datensatzinformation",
    "header.help": "Bedienungshilfe",
    "tools.measure": "Messen",
    "tools.evaluate": "Auswerten",
    "tools.view": "Ansicht",
    "tools.point": "Punkt",
    "tools.pointTitle": "Koordinate eines Punktes bestimmen",
    "tools.distance": "Strecke",
    "tools.distanceTitle": "Strecke oder Linienzug messen",
    "tools.height": "Höhe",
    "tools.heightTitle": "Vertikalen Höhenunterschied messen",
    "tools.area": "3D-Fläche",
    "tools.areaTitle": "Orientierungsunabhängige 3D-Polygonfläche messen und ihre XY-Projektion anzeigen",
    "tools.angle": "Winkel",
    "tools.angleTitle": "Winkel aus drei Punkten messen",
    "tools.profile": "Profil",
    "tools.profileTitle": "Höhenprofil entlang einer Linie untersuchen",
    "tools.clip": "Schnitt",
    "tools.clipTitle": "Punktwolke mit einer verschiebbaren Box beschneiden",
    "tools.fit": "Einpassen",
    "tools.fitTitle": "Gesamten Scan in die Ansicht einpassen",
    "tools.top": "Draufsicht",
    "tools.topTitle": "Senkrechte Draufsicht anzeigen",
    "tools.reset": "Rücksetzen",
    "tools.resetTitle": "Alle Messungen, Profile und Schnittboxen entfernen",
    "status.loading": "Viewer wird geladen …",
    "status.pointInstruction": "Punkt: Position in der Punktwolke anklicken.",
    "status.distanceInstruction": "Strecke: Punkte anklicken, mit Rechtsklick abschließen.",
    "status.heightInstruction": "Höhe: unteren und oberen Bezugspunkt anklicken.",
    "status.areaInstruction": "3D-Fläche: Eckpunkte anklicken und mit Rechtsklick abschließen. Das Label zeigt zusätzlich die XY-Projektion.",
    "status.areaMeasured": "3D-Fläche {{area}} · XY-Projektion {{projected}}",
    "status.areaNonPlanar": "⚠ Punkte liegen nicht in einer Ebene (maximale Abweichung {{deviation}}) · 3D-Fläche {{area}} ist eine planare Näherung · XY-Projektion {{projected}}",
    "status.areaInvalid": "3D-Fläche nicht verfügbar · mindestens drei nicht kollineare Punkte setzen",
    "status.angleInstruction": "Winkel: drei Punkte anklicken; der zweite Punkt ist der Scheitel.",
    "status.profileInstruction": "Profil: mindestens zwei Punkte setzen und mit Rechtsklick abschließen.",
    "status.profileOpened": "2D-Profil geöffnet · Export als CSV oder LAS im Profilfenster",
    "status.clipInstruction": "Schnittbox platzieren; danach mit den Griffen verschieben, drehen und skalieren.",
    "status.fit": "Gesamter Scan in die Ansicht eingepasst",
    "status.top": "Draufsicht aktiv",
    "status.reset": "Auswertungen entfernt · Scan unverändert",
    "status.cancelled": "Werkzeug abgebrochen",
    "status.pointCount": "{{points}} Punkte · ",
    "status.ready": "Bereit · {{count}}COPC · Qualität {{quality}} · geschützter Zenodo-Zugriff",
    "loading.title": "Punktwolke wird vorbereitet",
    "loading.initial": "Metadaten und erste Punkte werden geladen …",
    "loading.retry": "Neu laden",
    "loading.switchTitle": "Scan wird gewechselt",
    "loading.switchMessage": "Die geschützte Punktwolke wird neu geladen …",
    "loading.manifest": "Geschützte Dateiliste wird von Zenodo geladen …",
    "loading.points": "Metadaten und erste Punkte werden bereichsweise geladen …",
    "help.eyebrow": "Bedienung",
    "help.title": "So funktioniert der Viewer",
    "help.navigationTitle": "Ansicht bewegen",
    "help.leftMouse": "Linke Maustaste",
    "help.rotate": "Drehen",
    "help.rightMouse": "Rechte Maustaste",
    "help.pan": "Verschieben",
    "help.mouseWheel": "Mausrad",
    "help.zoom": "Zoomen",
    "help.measureTitle": "Messen und auswerten",
    "help.measureText": "Werkzeug wählen und Punkte mit der linken Maustaste setzen. Mit der rechten Maustaste wird ein Linienzug, eine 3D-Fläche oder ein Profil abgeschlossen.",
    "help.areaText": "Die 3D-Fläche verwendet alle Koordinaten und funktioniert für Böden, Dächer und Wände; XY ist ihre horizontale Projektion. Bei nicht koplanaren Punkten erscheint eine Warnung, weil der 3D-Wert dann nur eine planare Näherung ist. Verwenden Sie ein einfaches, geordnetes Polygon ohne Selbstüberschneidungen.",
    "help.profileText": "Beim Profil öffnet sich anschließend die 2D-Auswertung. Dort sind auch CSV- und LAS-Export verfügbar.",
    "help.clipTitle": "Schnittbox",
    "help.clipText": "„Schnitt“ setzt eine Box und zeigt nur Punkte innerhalb der Box. Die farbigen Griffe dienen zum Verschieben, Drehen und Skalieren.",
    "help.advancedTitle": "Erweiterte Funktionen",
    "help.advancedText": "Unter „Details“ stehen die vollständige Potree-Oberfläche, Darstellungsoptionen und der Export von Messgeometrien als GeoJSON oder DXF bereit.",
    "help.qualityText": "Die Qualitätsstufen ändern nur die Darstellung. „Hoch“ und „Maximum“ zeigen mehr Punkte, benötigen aber mehr Datenverkehr, Arbeitsspeicher und Grafikleistung.",
    "help.coordinates": "Die Scan-Koordinaten sind lokal und in Metern. Es ist kein globales Koordinatenreferenzsystem hinterlegt.",
    "dialog.close": "Dialog schließen",
    "info.eyebrow": "Datensatz",
    "info.defaultTitle": "LiDAR-Scan",
    "info.points": "Punkte",
    "info.extent": "Ausdehnung",
    "info.attributes": "Attribute",
    "info.webFormat": "Webformat",
    "info.source": "Quelle",
    "info.access": "Zugriff",
    "info.rendering": "Darstellung",
    "info.coordinates": "Koordinaten",
    "info.accessLink": "Geschützter Zenodo-Link",
    "info.coordinatesDefault": "Lokal, m (kein CRS)",
    "info.caption": "Die Punktwolke wird bei Bedarf direkt aus dem geschützten Zenodo-Datensatz geladen. Der Zugang gilt nur in diesem Browser-Tab.",
    "info.clearAccess": "Zugang aus diesem Tab entfernen",
    "info.rgbColour": "RGB-Farbe",
    "info.rgbaColour": "RGBA-Farbe",
    "attribute.position": "Position",
    "attribute.intensity": "Intensität",
    "attribute.classification": "Klassifizierung",
    "attribute.returnNumber": "Rücklaufnummer",
    "attribute.numberOfReturns": "Anzahl Rückläufe",
    "attribute.sourceId": "Quellen-ID",
    "attribute.pointSourceId": "Punktquellen-ID",
    "attribute.gpsTime": "GPS-Zeit",
    "info.defaultSource": "LiDAR-Aufnahme",
    "info.draftAccess": "Geschützter Zenodo-Entwurf",
    "info.publishedAccess": "Geschützte Zenodo-Veröffentlichung",
    "info.localCoordinates": "Lokal, {{units}} (kein CRS)",
    "reset.eyebrow": "Zurücksetzen",
    "reset.title": "Auswertungen entfernen?",
    "reset.message": "Alle Messungen, Profile und Schnittboxen dieser Sitzung werden entfernt. Der Scan selbst bleibt unverändert.",
    "reset.cancel": "Abbrechen",
    "reset.confirm": "Auswertungen entfernen",
    "measurement.point": "Punkt",
    "measurement.distance": "Strecke",
    "measurement.height": "Höhe",
    "measurement.area": "3D-Fläche",
    "area.label3d": "3D {{area}}",
    "area.labelProjectedXY": "XY {{area}}",
    "area.nonPlanarWarning": "⚠ Näherung",
    "area.invalidWarning": "3D-Fläche nicht verfügbar",
    "measurement.angle": "Winkel",
    "measurement.circle": "Kreis",
    "measurement.azimuth": "Azimut",
    "measurement.volume": "Volumen",
    "measurement.profile": "Profil",
    "measurement.clipBox": "Schnittbox",
    "measurement.polygonClip": "Polygonschnitt {{number}}",
    "measurement.selectionBox": "Auswahlbox {{number}}",
    "measurement.clipVolume": "Schnittvolumen {{number}}",
    "annotation.defaultTitle": "Anmerkungstitel",
    "annotation.defaultDescription": "Anmerkungsbeschreibung",
    "viewer.description": "LiDAR-Punktwolke · lokale Koordinaten",
    "error.localServerTitle": "Lokaler Webserver erforderlich",
    "error.localServerMessage": "Bitte diese Seite über einen lokalen Webserver oder GitHub Pages öffnen. Beispiel im Projektstamm: py scripts\\serve_viewer.py",
    "error.startTitle": "Viewer konnte nicht starten",
    "error.startMessage": "Eine lokale Potree-Abhängigkeit fehlt oder konnte nicht geladen werden.",
    "error.timeout": "Zeitüberschreitung beim Laden der Punktwolke",
    "error.accessRequiredTitle": "Persönlicher Freigabelink erforderlich",
    "error.accessRequiredMessage": "Diese Seite enthält selbst keine Scandaten. Öffnen Sie den vollständigen Link, den Sie persönlich erhalten haben.",
    "error.accessDeniedTitle": "Freigabelink nicht mehr gültig",
    "error.accessDeniedMessage": "Der Link ist abgelaufen, wurde widerrufen oder passt nicht zu diesem Zenodo-Datensatz.",
    "error.rangeTitle": "Zenodo-Streaming nicht verfügbar",
    "error.rangeMessage": "Der Server lieferte nicht den benötigten Bytebereich. Es wurde vorsorglich keine vollständige Scandatei geladen.",
    "error.rateLimitTitle": "Zenodo ist vorübergehend ausgelastet",
    "error.rateLimitMessage": "Bitte warten Sie kurz und versuchen Sie es anschließend erneut.",
    "error.manifestTitle": "Viewer-Manifest ist ungültig",
    "error.manifestMessage": "Die geschützte Dateiliste entspricht nicht dem erwarteten Format.",
    "error.loadTitle": "Punktwolke konnte nicht geladen werden",
    "error.loadMessage": "Prüfen Sie die Internetverbindung und öffnen Sie den persönlichen Freigabelink erneut.",
  });

  const CATALOGS = Object.freeze({ en: ENGLISH, de: GERMAN });

  // Potree 1.8 translates only part of its legacy interface. These exact-text
  // replacements cover the remaining bundled UI without changing vendor files
  // or translating arbitrary dataset, scan, annotation, or attribute names.
  const POTREE_GERMAN = Object.freeze({
    "Appearance": "Darstellung",
    "Tools": "Werkzeuge",
    "Measurements": "Messungen",
    "Scene": "Szene",
    "Filters": "Filter",
    "Classification filter": "Klassifizierungsfilter",
    "About": "Über Potree",
    "Other settings": "Weitere Einstellungen",
    "Point budget": "Punktbudget",
    "Point size": "Punktgröße",
    "Minimum size": "Mindestgröße",
    "Opacity": "Deckkraft",
    "Field of view": "Sichtfeld",
    "Point sizing": "Punktgrößenmodus",
    "Materials": "Materialien",
    "Elevation range": "Höhenbereich",
    "Scalar range": "Skalarbereich",
    "Quality": "Qualität",
    "Shape": "Form",
    "Radius": "Radius",
    "Strength": "Stärke",
    "Enable": "Aktivieren",
    "Min node size": "Minimale Knotengröße",
    "Clip mode": "Schnittmodus",
    "Speed": "Geschwindigkeit",
    "Sky": "Himmel",
    "Keep above ground": "Über Boden halten",
    "Box": "Box",
    "Length unit": "Längeneinheit",
    "Lock view": "Ansicht sperren",
    "Language": "Sprache",
    "Backface Culling": "Rückseiten ausblenden",
    "Eye-Dome-Lighting": "Eye-Dome-Lighting",
    "Background": "Hintergrund",
    "Skybox": "Himmel",
    "Gradient": "Verlauf",
    "Black": "Schwarz",
    "White": "Weiß",
    "None": "Keine",
    "Other": "Weitere",
    "Standard": "Standard",
    "High Quality": "Hohe Qualität",
    "Measurement": "Messung",
    "Show": "Anzeigen",
    "Hide": "Ausblenden",
    "Clipping": "Schnitt",
    "Highlight": "Hervorheben",
    "Inside": "Innen",
    "Outside": "Außen",
    "Inside Any": "Innerhalb einer Box",
    "Inside All": "Innerhalb aller Boxen",
    "Navigation": "Navigation",
    "Objects": "Objekte",
    "Properties": "Eigenschaften",
    "Classification": "Klassifizierung",
    "Returns": "Rückläufe",
    "Return Number": "Rücklaufnummer",
    "Number of Returns": "Anzahl Rückläufe",
    "Point Source ID": "Punktquellen-ID",
    "GPS Time": "GPS-Zeit",
    "Time:": "Zeit:",
    "find": "Suchen",
    "Point Clouds": "Punktwolken",
    "Annotations": "Anmerkungen",
    "clip": "Schnitt",
    "show volume": "Volumen anzeigen",
    "show in 3D": "In 3D anzeigen",
    "show on map": "Auf Karte anzeigen",
    "Vectors": "Vektoren",
    "Images": "Bilder",
    "Camera": "Kamera",
    "Camera Position": "Kameraposition",
    "Camera Target": "Kameraziel",
    "Camera Projection": "Kameraprojektion",
    "Perspective": "Perspektivisch",
    "Orthographic": "Orthografisch",
    "Export": "Export",
    "GeoJSON": "GeoJSON",
    "DXF": "DXF",
    "Show/Hide labels": "Beschriftungen ein-/ausblenden",
    "Clip Task": "Schnittaufgabe",
    "Clip Method": "Schnittmethode",
    "Splat Quality": "Punktqualität",
    "Angle measurement": "Winkelmessung",
    "Point measurement": "Punktmessung",
    "Distance measurement": "Streckenmessung",
    "Height measurement": "Höhenmessung",
    "Circle measurement": "Kreismessung",
    "Area measurement": "3D-Flächenmessung",
    "Volume measurement": "Volumenmessung",
    "Height profile": "Höhenprofil",
    "Annotation": "Anmerkung",
    "Annotation Title": "Anmerkungstitel",
    "Annotation Description": "Anmerkungsbeschreibung",
    "Volume clip": "Volumenschnitt",
    "Polygon clip": "Polygonschnitt",
    "Draw a selection box. Requires you to be in orthographic camera mode!": "Auswahlbox zeichnen. Dafür muss die orthografische Kamera aktiv sein.",
    "Clip plane on x axis": "Schnittebene auf der X-Achse",
    "Clip plane on y axis": "Schnittebene auf der Y-Achse",
    "Clip plane on z axis": "Schnittebene auf der Z-Achse",
    "Remove all measurements": "Alle Messungen entfernen",
    "Remove all clipping volumes": "Alle Schnittvolumen entfernen",
    "Left view": "Ansicht von links",
    "Right view": "Ansicht von rechts",
    "Front view": "Vorderansicht",
    "Back view": "Rückansicht",
    "Top view": "Draufsicht",
    "Bottom view": "Untersicht",
    "Full extent": "Gesamtausdehnung",
    "Orbit control": "Orbit-Steuerung",
    "Fly control": "Flugsteuerung",
    "Helicopter control": "Helikoptersteuerung",
    "Earth control": "Erdsteuerung",
    "Perspective camera": "Perspektivische Kamera",
    "Orthographic camera": "Orthografische Kamera",
    "Navigation cube": "Navigationswürfel",
    "Compass": "Kompass",
    "Camera Animation": "Kameraanimation",
    "Enter": "Start",
    "Exit": "Beenden",
    "Angle": "Winkel",
    "Point": "Punkt",
    "Distance": "Strecke",
    "Height": "Höhe",
    "Circle": "Kreis",
    "Azimuth": "Azimut",
    "Area": "3D-Fläche",
    "Volume": "Volumen",
    "Length": "Länge",
    "Width": "Breite",
    "Fixed": "Fest",
    "Attenuated": "Abgeschwächt",
    "Adaptive": "Adaptiv",
    "Square": "Quadratisch",
    "Paraboloid": "Paraboloid",
    "FIXED": "Fest",
    "ATTENUATED": "Abgeschwächt",
    "ADAPTIVE": "Adaptiv",
    "SQUARE": "Quadratisch",
    "CIRCLE": "Kreisförmig",
    "PARABOLOID": "Paraboloid",
    "ENTER": "START",
    "EXIT": "BEENDEN",
    "Attribute": "Attribut",
    "Attribute Weights": "Attributgewichtung",
    "Extra Attribute": "Zusatzattribut",
    "Gradient Scheme:": "Verlaufsschema:",
    "Color": "Farbe",
    "Transition": "Übergang",
    "Indices": "Indizes",
    "intensity gradient": "Intensitätsverlauf",
    "elevation": "Höhe",
    "color": "Farbe",
    "matcap": "MatCap",
    "indices": "Indizes",
    "level of detail": "Detailstufe",
    "composite": "Kombiniert",
    "gps-time": "GPS-Zeit",
    "returnNumber": "Rücklaufnummer",
    "number of returns": "Anzahl Rückläufe",
    "return number": "Rücklaufnummer",
    "source id": "Quellen-ID",
    "Number of Points": "Anzahl Punkte",
    "Save LAS(3D)": "LAS speichern (3D)",
    "Save CSV(2D)": "CSV speichern (2D)",
    "Distances:": "Strecken:",
    "Total:": "Gesamt:",
    "Area:": "3D-Fläche:",
    "Center:": "Mittelpunkt:",
    "Circumference:": "Umfang:",
    "Height:": "Höhe:",
    "Volume:": "Volumen:",
    "Width:": "Breite:",
    "Duration:": "Dauer:",
    "position": "Position",
    "copy": "Kopieren",
    "length": "Länge",
    "width": "Breite",
    "height": "Höhe",
    "transition": "Übergang",
    "target": "Ziel",
    "Title": "Titel",
    "Description": "Beschreibung",
    "profile from measure": "Profil aus Messung",
    "prepare download": "Download vorbereiten",
    "make clip volume": "Als Schnittvolumen verwenden",
    "reset orientation": "Ausrichtung zurücksetzen",
    "make uniform": "Gleichmäßig skalieren",
    "show 2d profile": "2D-Profil anzeigen",
    "play": "Abspielen",
    "insert control point": "Kontrollpunkt einfügen",
    "keyframe": "Schlüsselbild",
    "ERROR:": "FEHLER:",
    "RGB": "RGB",
    "Intensity": "Intensität",
    "Elevation": "Höhe",
    "Source ID": "Quellen-ID",
    "Gamma": "Gamma",
    "Brightness": "Helligkeit",
    "Contrast": "Kontrast",
    "Clamp": "Begrenzen",
    "Repeat": "Wiederholen",
    "Mirrored Repeat": "Gespiegelt wiederholen",
    "Range": "Bereich",
    "transition": "Übergang",
    "never classified": "nie klassifiziert",
    "unclassified": "unklassifiziert",
    "ground": "Boden",
    "low vegetation": "niedrige Vegetation",
    "medium vegetation": "mittlere Vegetation",
    "high vegetation": "hohe Vegetation",
    "building": "Gebäude",
    "low point(noise)": "Tiefpunkt (Rauschen)",
    "key-point": "Schlüsselpunkt",
    "water": "Wasser",
    "overlap": "Überlappung",
    "default": "Standard",
    "invert": "Umkehren",
    "show/hide all": "Alle ein-/ausblenden",
    "Apply": "Anwenden",
    "Copied value to clipboard:": "Wert in die Zwischenablage kopiert:",
    "no measurements to export": "Keine Messungen zum Exportieren vorhanden",
    "Switch to Orthographic Camera Mode before using the Screen-Box-Select tool.": "Vor Verwendung der Auswahlbox muss die orthografische Kamera aktiviert werden.",
    "WebGL context lost. ☹": "WebGL-Kontext verloren. ☹",
    "estimating results ...": "Ergebnisse werden geschätzt …",
    "downloads ready:": "Downloads bereit:",
    "Unexpected Response.": "Unerwartete Antwort.",
    "status:": "Status:",
    "message:": "Meldung:",
    "Author:": "Autor:",
    "License:": "Lizenz:",
    "Dependency Licenses:": "Lizenzen der Abhängigkeiten:",
    "See github": "Auf GitHub anzeigen",
    "Funding:": "Förderung:",
    "Project Name": "Projektname",
    "Funding Agency": "Förderstelle",
    "Potree is a viewer for large point cloud / LIDAR data sets, developed at the Vienna University of Technology.": "Potree ist ein Viewer für große Punktwolken- und LiDAR-Datensätze, entwickelt an der Technischen Universität Wien.",
    "is a viewer for large point cloud / LIDAR data sets, developed at the Vienna University of Technology.": "ist ein Viewer für große Punktwolken- und LiDAR-Datensätze, entwickelt an der Technischen Universität Wien.",
    "Potree is funded by a combination of research projects, companies, institutions and individuals. If you're making good use of Potree, please consider funding its future development": "Potree wird durch Forschungsprojekte, Unternehmen, Institutionen und Einzelpersonen finanziert. Wenn Sie Potree erfolgreich einsetzen, unterstützen Sie bitte seine weitere Entwicklung",
    "via Github Sponsors": "über GitHub Sponsors",
    "or by directly inquiring": "oder durch eine direkte Anfrage",
    "via e-mail": "per E-Mail",
    "Research projects who's funding contributes to Potree:": "Forschungsprojekte, deren Förderung zu Potree beiträgt:",
    "Thanks to all the companies and institutions funding Potree:": "Dank an alle Unternehmen und Institutionen, die Potree fördern:",
    "or": "oder",
    "• Diamond •": "• Diamant •",
    "• Gold •": "• Gold •",
    "• Silver •": "• Silber •",
    "• Bronze •": "• Bronze •",
    "Potree Encountered An Error": "In Potree ist ein Fehler aufgetreten",
    "This may happen if your browser or graphics card is not supported.": "Dies kann auftreten, wenn Ihr Browser oder Ihre Grafikkarte nicht unterstützt wird.",
    "We recommend to use": "Wir empfehlen",
    "Please also visit": "Besuchen Sie außerdem",
    "and check whether your system supports WebGL.": "und prüfen Sie, ob Ihr System WebGL unterstützt.",
    "If you are already using one of the recommended browsers and WebGL is enabled, consider filing an issue report at": "Wenn Sie bereits einen der empfohlenen Browser verwenden und WebGL aktiviert ist, können Sie einen Fehlerbericht erstellen unter",
    "including your operating system, graphics card, browser and browser version, as well as the error message below.": "Geben Sie dabei Betriebssystem, Grafikkarte, Browser und Browserversion sowie die unten stehende Fehlermeldung an.",
    "Please do not report errors on unsupported browsers.": "Bitte melden Sie keine Fehler für nicht unterstützte Browser.",
    "Close profile": "Profil schließen",
    "Rotate clockwise": "Im Uhrzeigersinn drehen",
    "Rotate counter-clockwise": "Gegen den Uhrzeigersinn drehen",
    "Move profile forward": "Profil vorwärts verschieben",
    "Move profile backward": "Profil rückwärts verschieben",
    "Download 2D DXF": "2D-DXF herunterladen",
    "Download 3D DXF": "3D-DXF herunterladen",
    "Download CSV": "CSV herunterladen",
    "Download LAS": "LAS herunterladen",
    "ENTER VR": "VR STARTEN",
    "EXIT VR": "VR BEENDEN",
    "Copy": "Kopieren",
  });

  const POTREE_KEYS = Object.freeze({
    "tb.navigation_opt": "Navigation",
    "tb.rendering_opt": "Appearance",
    "tb.tools_opt": "Tools",
    "tb.measurments_opt": "Measurements",
    "tb.clipping_opt": "Clipping",
    "tb.annotations_opt": "Annotations",
    "tb.materials_opt": "Materials",
    "tb.scene_opt": "Scene",
    "tb.classification_filter_opt": "Classification filter",
    "tb.filters_opt": "Filters",
    "tb.parameters_opt": "Other settings",
    "tb.about_opt": "About",
    "tt.angle_measurement": "Angle measurement",
    "tt.point_measurement": "Point measurement",
    "tt.distance_measurement": "Distance measurement",
    "tt.height_measurement": "Height measurement",
    "tt.circle_measurement": "Circle measurement",
    "tt.area_measurement": "Area measurement",
    "tt.volume_measurement": "Volume measurement",
    "tt.height_profile": "Height profile",
    "tt.annotation": "Annotation",
    "tt.clip_volume": "Volume clip",
    "tt.clip_polygon": "Polygon clip",
    "tt.screen_clip_box": "Draw a selection box. Requires you to be in orthographic camera mode!",
    "tt.clip_plane_x": "Clip plane on x axis",
    "tt.clip_plane_y": "Clip plane on y axis",
    "tt.clip_plane_z": "Clip plane on z axis",
    "tt.remove_all_measurement": "Remove all measurements",
    "tt.left_view_control": "Left view",
    "tt.right_view_control": "Right view",
    "tt.front_view_control": "Front view",
    "tt.back_view_control": "Back view",
    "tt.top_view_control": "Top view",
    "tt.bottom_view_control": "Bottom view",
    "tt.focus_control": "Full extent",
    "tt.orbit_control": "Orbit control",
    "tt.flight_control": "Fly control",
    "tt.heli_control": "Helicopter control",
    "tt.earth_control": "Earth control",
    "tt.perspective_camera_control": "Perspective camera",
    "tt.orthographic_camera_control": "Orthographic camera",
    "tt.navigation_cube_control": "Navigation cube",
    "tt.remove_all_clipping_volumes": "Remove all clipping volumes",
    "tt.compass": "Compass",
    "tt.camera_animation": "Camera Animation",
    "appearance.nb_max_pts": "Point budget",
    "appearance.point_size": "Point size",
    "appearance.min_point_size": "Minimum size",
    "appearance.point_opacity": "Opacity",
    "appearance.field_view": "Field of view",
    "appearance.point_size_type": "Point sizing",
    "appearance.point_material": "Materials",
    "appearance.elevation_range": "Elevation range",
    "appearance.extra_range": "Scalar range",
    "appearance.point_quality": "Quality",
    "appearance.point_shape": "Shape",
    "appearance.edl_radius": "Radius",
    "appearance.edl_strength": "Strength",
    "appearance.edl_opacity": "Opacity",
    "appearance.edl_enable": "Enable",
    "appearance.min_node_size": "Min node size",
    "appearance.clip_mode": "Clip mode",
    "appearance.move_speed": "Speed",
    "appearance.skybox": "Sky",
    "appearance.bottom_lock": "Keep above ground",
    "appearance.box": "Box",
    "appearance.length_unit": "Length unit",
    "appearance.freeze": "Lock view",
    "appearance.language": "Language",
    "appearance.backface_culling": "Backface Culling",
    "measurements.clip": "clip",
    "measurements.show": "show volume",
    "annotations.show3D": "show in 3D",
    "annotations.showMap": "show on map",
    "profile.nb_points": "Number of Points",
    "profile.title": "Height profile",
    "profile.save_las": "Save LAS(3D)",
    "profile.save_ortho": "Save CSV(2D)",
    "scene.camera_position": "Camera Position",
    "scene.camera_target": "Camera Target",
    "filters.return_number": "Return Number",
    "filters.number_of_returns": "Number of Returns",
    "filters.gps_min": "min",
    "filters.gps_max": "max",
    "filters.gps_time": "GPS Time",
    "settings.language": "Language",
    "Azimuth": "Azimuth",
  });

  const POTREE_ALIASES = Object.freeze({
    "Aussehen": "Appearance",
    "Max Punkte": "Point budget",
    "Punktgrösse": "Point size",
    "Punkt number": "Number of Points",
    "Elevation Bereich": "Elevation range",
    "Klassifizierung  Filter": "Classification filter",
    "Materials": "Materials",
    "Min Knotengrösse": "Min node size",
    "Speed": "Speed",
    "Sky": "Sky",
    "Halten über dem Boden": "Keep above ground",
    "Lenght unit": "Length unit",
    "Lock view": "Lock view",
    "Orbit Kontrolle": "Orbit control",
    "Fly Kontrolle": "Fly control",
    "Earth Kontrolle": "Earth control",
    "Volume clip": "Volume clip",
    "Polygon clip": "Polygon clip",
    "Righ view": "Right view",
  });

  const POTREE_ELEMENT_TITLES = Object.freeze({
    closeProfileContainer: "Close profile",
    potree_profile_rotate_cw: "Rotate clockwise",
    potree_profile_rotate_ccw: "Rotate counter-clockwise",
    potree_profile_move_forward: "Move profile forward",
    potree_profile_move_backward: "Move profile backward",
    potree_download_dxf2D_icon: "Download 2D DXF",
    potree_download_dxf3D_icon: "Download 3D DXF",
    potree_download_csv_icon: "Download CSV",
    potree_download_las_icon: "Download LAS",
  });

  const POTREE_ENGLISH_OVERRIDES = Object.freeze({
    "Area measurement": "3D area measurement",
    "Area": "3D area",
    "Area:": "3D area:",
  });

  const POTREE_CANONICAL = new Map();
  Object.entries(POTREE_GERMAN).forEach(([english, german]) => {
    POTREE_CANONICAL.set(english, english);
    if (!POTREE_CANONICAL.has(german)) POTREE_CANONICAL.set(german, english);
  });
  Object.entries(POTREE_ALIASES).forEach(([alias, english]) => {
    POTREE_CANONICAL.set(alias, english);
  });
  Object.entries(POTREE_ENGLISH_OVERRIDES).forEach(([english, rendered]) => {
    POTREE_CANONICAL.set(rendered, english);
  });

  const dynamicRangeIds = new Set([
    "lblHeightRange",
    "lblExtraRange",
    "lblIntensityRange",
    "lblReturnNumber",
    "lblNumberOfReturns",
  ]);
  const observedRoots = new Map();
  const listeners = new Set();
  const potreeTextSources = new WeakMap();
  const potreePropertySources = new WeakMap();
  const enhancedPotreeControls = new WeakSet();
  const externalPotreeRootSelector = [
    ".ui-selectmenu-menu",
    ".sp-container",
    ".potree_message",
    ".potree_failpage",
    "#profile_window",
    "#message_listing",
    "#potree_quick_buttons",
    "#VRButton",
  ].join(", ");
  let translatingPotree = false;
  let discoveryStarted = false;

  function safeReadPreference() {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return SUPPORTED_LANGUAGES.includes(saved) ? saved : null;
    } catch (_error) {
      return null;
    }
  }

  function browserLanguage() {
    const listed = window.navigator && window.navigator.languages;
    const candidates = Array.isArray(listed) && listed.length
      ? listed
      : [window.navigator && window.navigator.language];
    for (const candidate of candidates) {
      const primary = String(candidate || "").toLowerCase().split("-")[0];
      if (SUPPORTED_LANGUAGES.includes(primary)) return primary;
    }
    return "en";
  }

  function normaliseLanguage(language) {
    const primary = String(language || "").toLowerCase().split("-")[0];
    return SUPPORTED_LANGUAGES.includes(primary) ? primary : "en";
  }

  let currentLanguage = safeReadPreference() || browserLanguage();

  function interpolate(template, values) {
    return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key) => (
      Object.hasOwn(values, key) ? String(values[key]) : match
    ));
  }

  function t(key, values = {}, language = currentLanguage) {
    const selected = CATALOGS[normaliseLanguage(language)] || ENGLISH;
    const template = selected[key] ?? ENGLISH[key] ?? key;
    return interpolate(template, values);
  }

  function elementsWithAttribute(root, attribute) {
    const elements = [];
    if (root && root.nodeType === 1 && root.hasAttribute(attribute)) elements.push(root);
    if (root && typeof root.querySelectorAll === "function") {
      elements.push(...root.querySelectorAll(`[${attribute}]`));
    }
    return elements;
  }

  function setAttributeIfChanged(element, attribute, value) {
    const rendered = String(value);
    if (element.getAttribute(attribute) !== rendered) {
      element.setAttribute(attribute, rendered);
    }
  }

  function setTextIfChanged(element, value) {
    const rendered = String(value);
    if (element.textContent !== rendered) element.textContent = rendered;
  }

  function labelPotreeImage(element, label) {
    if (!element || element.tagName !== "IMG") return;
    setAttributeIfChanged(element, "alt", label);
    setAttributeIfChanged(element, "aria-label", label);

    const wrapper = typeof element.closest === "function" ? element.closest("a, button") : null;
    if (wrapper && wrapper !== element) {
      setAttributeIfChanged(wrapper, "aria-label", label);
      setAttributeIfChanged(wrapper, "title", label);
      return;
    }
    setAttributeIfChanged(element, "role", "button");
    setAttributeIfChanged(element, "tabindex", "0");
    if (enhancedPotreeControls.has(element) || typeof element.addEventListener !== "function") return;
    enhancedPotreeControls.add(element);
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      element.click();
    });
  }

  function translateDocument(root = document) {
    const bindings = [
      ["data-lidar-i18n", "textContent"],
      ["data-lidar-i18n-title", "title"],
      ["data-lidar-i18n-aria-label", "aria-label"],
      ["data-lidar-i18n-content", "content"],
      ["data-lidar-i18n-placeholder", "placeholder"],
    ];
    bindings.forEach(([attribute, target]) => {
      elementsWithAttribute(root, attribute).forEach((element) => {
        const translated = t(element.getAttribute(attribute));
        if (target === "textContent") setTextIfChanged(element, translated);
        else setAttributeIfChanged(element, target, translated);
      });
    });
    if (document.documentElement) document.documentElement.lang = currentLanguage;
  }

  function canonicalPotreeText(value, element) {
    const compact = String(value || "").replace(/\s+/g, " ").trim();
    let canonical = POTREE_CANONICAL.get(compact) || null;
    if (canonical) return canonical;

    const colonMatch = /^(.*?):$/.exec(compact);
    if (colonMatch) {
      canonical = POTREE_CANONICAL.get(colonMatch[1]) || null;
      if (canonical) return `${canonical}:`;
    }

    if (element && dynamicRangeIds.has(element.id)) {
      const englishMatch = /^(.*?)\s+to\s+(.*?)$/.exec(compact);
      if (englishMatch) return `${englishMatch[1]} to ${englishMatch[2]}`;
      const germanMatch = /^(.*?)\s+bis\s+(.*?)$/.exec(compact);
      if (germanMatch) return `${germanMatch[1]} to ${germanMatch[2]}`;
    }

    const englishError = /^ERROR:\s*(.*)$/.exec(compact);
    if (englishError) return `ERROR: ${englishError[1]}`;
    const germanError = /^FEHLER:\s*(.*)$/.exec(compact);
    if (germanError) return `ERROR: ${germanError[1]}`;

    const prefixes = [
      ["status:", "status:"],
      ["Status:", "status:"],
      ["message:", "message:"],
      ["Meldung:", "message:"],
    ];
    for (const [rendered, source] of prefixes) {
      if (compact.startsWith(`${rendered} `)) {
        return `${source}${compact.slice(rendered.length)}`;
      }
    }
    return null;
  }

  function localisePotreeCanonical(canonical, element) {
    if (currentLanguage === "en") return POTREE_ENGLISH_OVERRIDES[canonical] || canonical;

    if (element && dynamicRangeIds.has(element.id)) {
      const rangeMatch = /^(.*?)\s+to\s+(.*?)$/.exec(canonical);
      if (rangeMatch) return `${rangeMatch[1]} bis ${rangeMatch[2]}`;
    }
    const errorMatch = /^ERROR:\s*(.*)$/.exec(canonical);
    if (errorMatch) return `FEHLER: ${errorMatch[1]}`;
    for (const prefix of ["status:", "message:"]) {
      if (canonical.startsWith(`${prefix} `)) {
        return `${POTREE_GERMAN[prefix] || prefix}${canonical.slice(prefix.length)}`;
      }
    }
    if (POTREE_GERMAN[canonical]) return POTREE_GERMAN[canonical];
    const colonMatch = /^(.*?):$/.exec(canonical);
    if (colonMatch) {
      return `${POTREE_GERMAN[colonMatch[1]] || colonMatch[1]}:`;
    }
    return canonical;
  }

  function localisePotreeText(value, element) {
    const canonical = canonicalPotreeText(value, element);
    return canonical ? localisePotreeCanonical(canonical, element) : value;
  }

  function trackedPotreeSource(element, property, value) {
    const compact = String(value || "").replace(/\s+/g, " ").trim();
    let properties = potreePropertySources.get(element);
    if (!properties) {
      properties = new Map();
      potreePropertySources.set(element, properties);
    }
    const tracked = properties.get(property);
    if (tracked && tracked.rendered === compact) return tracked.canonical;

    const canonical = canonicalPotreeText(compact, element);
    if (!canonical) {
      properties.delete(property);
      return null;
    }
    properties.set(property, { canonical, rendered: compact });
    return canonical;
  }

  function rememberPotreeRendering(element, property, canonical, rendered) {
    let properties = potreePropertySources.get(element);
    if (!properties) {
      properties = new Map();
      potreePropertySources.set(element, properties);
    }
    properties.set(property, {
      canonical,
      rendered: String(rendered || "").replace(/\s+/g, " ").trim(),
    });
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentElement) return;
    if (node.parentElement.closest("#jstree_scene .jstree-anchor")) {
      return;
    }
    const match = /^(\s*)(.*?)(\s*)$/s.exec(node.nodeValue || "");
    if (!match || !match[2]) return;
    const compact = match[2].replace(/\s+/g, " ").trim();
    const annotationField = node.parentElement.closest("#annotation_title, #annotation_description");
    if (annotationField) {
      const allowed = new Set([
        "Annotation Title",
        "Annotation Description",
        POTREE_GERMAN["Annotation Title"],
        POTREE_GERMAN["Annotation Description"],
      ]);
      if (!allowed.has(compact)) return;
    }
    const tracked = potreeTextSources.get(node);
    const canonical = tracked && tracked.rendered === compact
      ? tracked.canonical
      : canonicalPotreeText(compact, node.parentElement);
    if (!canonical) {
      potreeTextSources.delete(node);
      return;
    }
    const translated = localisePotreeCanonical(canonical, node.parentElement);
    potreeTextSources.set(node, { canonical, rendered: translated });
    const replacement = `${match[1]}${translated}${match[3]}`;
    if (replacement !== node.nodeValue) node.nodeValue = replacement;
  }

  function translatePotreeElement(element) {
    if (!element || element.nodeType !== 1) return;

    const elementTitle = POTREE_ELEMENT_TITLES[element.id];
    if (elementTitle) {
      const translatedTitle = currentLanguage === "de"
        ? (POTREE_GERMAN[elementTitle] || elementTitle)
        : elementTitle;
      setAttributeIfChanged(element, "title", translatedTitle);
      setAttributeIfChanged(element, "aria-label", translatedTitle);
      labelPotreeImage(element, translatedTitle);
    }

    if (element.id === "VRButton") {
      const content = String(element.textContent || "").toLowerCase();
      const leaving = content.includes("exit") || content.includes("beenden");
      const english = leaving ? "EXIT VR" : "ENTER VR";
      const label = currentLanguage === "de" ? POTREE_GERMAN[english] : english;
      setAttributeIfChanged(element, "aria-label", label);
      setAttributeIfChanged(element, "title", label);
    }

    if (element.tagName === "OPTION" && !element.hasAttribute("value")) {
      const canonical = canonicalPotreeText(element.textContent, element);
      if (canonical) setAttributeIfChanged(element, "value", element.value);
    }

    const vendorBinding = element.getAttribute("data-lidar-potree-i18n")
      || element.getAttribute("data-i18n");
    if (vendorBinding) {
      const explicitTitleBinding = vendorBinding.startsWith("[title]");
      const titleBinding = explicitTitleBinding || element.tagName === "IMG";
      const key = explicitTitleBinding ? vendorBinding.slice(7) : vendorBinding;
      const english = POTREE_KEYS[key];
      if (english) {
        setAttributeIfChanged(element, "data-lidar-potree-i18n", vendorBinding);
        if (element.hasAttribute("data-i18n")) element.removeAttribute("data-i18n");
        const translated = currentLanguage === "de"
          ? (POTREE_GERMAN[english] || english)
          : (POTREE_ENGLISH_OVERRIDES[english] || english);
        if (titleBinding) {
          setAttributeIfChanged(element, "title", translated);
          rememberPotreeRendering(element, "title", english, translated);
          labelPotreeImage(element, translated);
        } else {
          setTextIfChanged(element, translated);
          const child = element.childNodes && element.childNodes.length === 1
            ? element.childNodes[0] : null;
          if (child && child.nodeType === 3) {
            potreeTextSources.set(child, { canonical: english, rendered: translated });
          }
        }
      }
    }

    Array.from(element.childNodes || []).forEach((node) => {
      if (node.nodeType === 3) translateTextNode(node);
    });
    ["title", "aria-label", "placeholder"].forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const value = element.getAttribute(attribute);
      const canonical = trackedPotreeSource(element, attribute, value);
      if (!canonical) return;
      const translated = localisePotreeCanonical(canonical, element);
      rememberPotreeRendering(element, attribute, canonical, translated);
      setAttributeIfChanged(element, attribute, translated);
      if (attribute === "title") labelPotreeImage(element, translated);
    });
    if (element.matches('input[type="button"], input[type="submit"]')) {
      const canonical = trackedPotreeSource(element, "value", element.value);
      if (canonical) {
        const translated = localisePotreeCanonical(canonical, element);
        rememberPotreeRendering(element, "value", canonical, translated);
        if (element.value !== translated) element.value = translated;
      }
    }
  }

  function translatePotree(root) {
    if (!root || translatingPotree) return;
    translatingPotree = true;
    try {
      translatePotreeElement(root);
      if (typeof root.querySelectorAll === "function") {
        root.querySelectorAll("*").forEach(translatePotreeElement);
      }
      translatePotreeTree();
    } finally {
      translatingPotree = false;
    }
  }

  function translatePotreeTree() {
    if (!window.$ || !window.$.jstree || !document.getElementById("jstree_scene")) return;
    let tree;
    try {
      tree = window.$("#jstree_scene").jstree(true);
    } catch (_error) {
      return;
    }
    if (!tree || typeof tree.get_node !== "function") return;

    const fixedNodes = {
      pointclouds: "Point Clouds",
      measurements: "Measurements",
      annotations: "Annotations",
      other: "Other",
      vectors: "Vectors",
      images: "Images",
    };
    Object.entries(fixedNodes).forEach(([id, english]) => {
      const node = tree.get_node(id);
      if (!node) return;
      const label = currentLanguage === "de" ? (POTREE_GERMAN[english] || english) : english;
      if (String(node.text).replace(/<\/?b>/g, "") !== label) {
        tree.rename_node(node, `<b>${label}</b>`);
      }
    });

    const other = tree.get_node("other");
    (other && other.children ? other.children : []).forEach((id) => {
      const node = tree.get_node(id);
      const constructorName = node && node.data && node.data.constructor
        ? node.data.constructor.name : "";
      if (constructorName !== "Camera") return;
      const label = currentLanguage === "de" ? POTREE_GERMAN.Camera : "Camera";
      if (node.text !== label) tree.rename_node(node, label);
    });

    let nodes = [];
    try {
      nodes = tree.get_json("#", { flat: true });
    } catch (_error) {
      return;
    }
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      const object = node && node.data;
      const constructorName = object && object.constructor ? object.constructor.name : "";
      let label = null;

      if (constructorName === "Annotation" && object.title === "Annotation Title") {
        label = t("annotation.defaultTitle");
      } else if (constructorName === "PolygonClipVolume") {
        const match = /^polygon_clip_volume_(\d+)$/.exec(object.name || "");
        if (match) label = t("measurement.polygonClip", { number: Number(match[1]) + 1 });
      } else if (constructorName === "BoxVolume") {
        const match = /^box_(\d+)$/.exec(object.name || "");
        if (match) label = t("measurement.selectionBox", { number: Number(match[1]) + 1 });
      } else if (constructorName === "ClipVolume") {
        const match = /^clip_volume_(\d+)$/.exec(object.name || "");
        if (match) label = t("measurement.clipVolume", { number: Number(match[1]) + 1 });
      }

      if (label && node.text !== label) tree.rename_node(node, label);
    });
  }

  function handlePotreeMutations(mutations) {
    if (translatingPotree) return;
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        translateTextNode(mutation.target);
        return;
      }
      if (mutation.type === "attributes") {
        translatePotreeElement(mutation.target);
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 3) translateTextNode(node);
        else translatePotree(node);
      });
      translatePotreeElement(mutation.target);
    });
  }

  function pruneObservedRoots() {
    observedRoots.forEach((observer, root) => {
      if (!("isConnected" in root) || root.isConnected) return;
      if (observer && typeof observer.disconnect === "function") observer.disconnect();
      observedRoots.delete(root);
    });
  }

  const potreeDiscoveryObserver = typeof window.MutationObserver === "function"
    ? new window.MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (!node || node.nodeType !== 1) return;
        if (node.matches(externalPotreeRootSelector)) observePotree(node);
        node.querySelectorAll(externalPotreeRootSelector).forEach(observePotree);
      }));
      pruneObservedRoots();
    })
    : null;

  function startPotreeDiscovery() {
    if (discoveryStarted || !document.body) return;
    discoveryStarted = true;
    document.querySelectorAll(externalPotreeRootSelector).forEach(observePotree);
    if (potreeDiscoveryObserver) {
      potreeDiscoveryObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function observePotree(root) {
    if (!root || observedRoots.has(root)) return;
    const observer = typeof window.MutationObserver === "function"
      ? new window.MutationObserver(handlePotreeMutations)
      : null;
    observedRoots.set(root, observer);
    translatePotree(root);
    if (observer) {
      observer.observe(root, {
        attributes: true,
        attributeFilter: ["title", "aria-label", "placeholder", "value"],
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
    startPotreeDiscovery();
  }

  function savePreference(language) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (_error) {
      // The selected language remains active when persistent storage is blocked.
    }
  }

  function setLanguage(language, { persist = true } = {}) {
    currentLanguage = normaliseLanguage(language);
    if (persist) savePreference(currentLanguage);
    translateDocument(document);
    pruneObservedRoots();
    observedRoots.forEach((_observer, root) => translatePotree(root));
    listeners.forEach((listener) => listener(currentLanguage));
    return currentLanguage;
  }

  function onChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.LidarViewerI18n = Object.freeze({
    catalogs: CATALOGS,
    detectLanguage: browserLanguage,
    languageStorageKey: LANGUAGE_STORAGE_KEY,
    normaliseLanguage,
    observePotree,
    onChange,
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    t,
    translateDocument,
    translatePotree,
    get language() { return currentLanguage; },
    get locale() { return currentLanguage === "de" ? "de-AT" : "en-GB"; },
  });

  if (document.documentElement) document.documentElement.lang = currentLanguage;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => translateDocument(document), { once: true });
  } else {
    translateDocument(document);
  }
})();
