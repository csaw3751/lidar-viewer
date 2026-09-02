# Geschützter LiDAR-Viewer mit GitHub Pages und Zenodo

[English](README.md) · **Deutsch**

Dieses Repository stellt Potree als statische Website zur Anzeige eingeschränkter COPC-Punktwolken auf Zenodo bereit. Die Website enthält **keine Scandaten, keine Zenodo-Record-ID und kein Zugangstoken**. Ein persönlicher Geheimlink übergibt Record-ID und Bearer-Token im URL-Fragment; der Viewer entfernt dieses Fragment sofort und lädt nur die benötigten Bytebereiche aus dem eingeschränkten Zenodo-Datensatz.

## Sprachunterstützung

Die Oberfläche ist auf Deutsch und Englisch verfügbar. Die Sprache wird in dieser Reihenfolge bestimmt:

1. eine gültige Sprache, die zuvor mit dem **DE/EN**-Schalter ausgewählt wurde;
2. die bevorzugten Browsersprachen;
3. Englisch als Rückfalloption.

Deutsch (`de` und regionale Varianten wie `de-AT`) aktiviert die deutsche Oberfläche. Bei allen anderen, nicht unterstützten oder fehlenden Sprachangaben wird Englisch verwendet. Der Schalter ändert die Oberfläche sofort und aktualisiert Dokumentsprache, Bedienelemente, Hilfetexte, Tooltips, Dialoge, Status- und Fehlermeldungen, barrierefreie Beschriftungen, Zahlenformatierung und die Potree-Oberfläche.

Die Spracheinstellung enthält keine Zugangsdaten und wird getrennt von den tab-lokalen Zenodo-Zugangsdaten gespeichert. Ein Sprachwechsel stellt das geheime URL-Fragment nicht wieder her und verändert weder Zenodo-Authentifizierung noch Endpunktauswahl, Range-Streaming oder COPC-Ladelogik. Titel, Scanbezeichnungen, Quellen und weitere beschreibende Werte aus `viewer-manifest.json` werden unverändert angezeigt, weil sie Inhalt des Datensatzes und keine Oberflächentexte sind.

Erstentwickelter Quellcode, Kommentare, Tests, `README.md`, `SECURITY.md` und `THIRD_PARTY_NOTICES.md` sind auf Englisch verfasst. Die vollständige deutsche Projektdokumentation steht in `README.de.md`; `QA_REPORT.md` bleibt als datierter deutschsprachiger Nachweisbericht erhalten. Dateien von Drittanbietern unter `viewer/vendor/` behalten ihren ursprünglichen Inhalt.

## Dateien für Zenodo

Für den Browser-Viewer werden nur diese Dateien benötigt:

1. genau eine `viewer-manifest.json`;
2. je Scan genau eine weboptimierte `*.copc.laz`.

E57, PLY, normale LAZ, GLB, Grundrisse und weitere Originale können zusätzlich als Archivkopien in Zenodo liegen, werden von diesem Potree-Viewer aber nicht geladen. HTML, JavaScript, Potree und dieses Repository gehören **nicht** in den Zenodo-Datensatz.

Zum Zeitpunkt der Paketerstellung bestand der SiteScape-Datensatz damit aus fünf Viewer-Dateien: einem Manifest und vier COPC-Dateien. Spätere Scans werden in einer neuen Zenodo-Version als zusätzliche COPC-Dateien ergänzt und im Manifest eingetragen.

Beispiel für mehrere Scans:

```json
{
  "schemaVersion": 1,
  "title": "LiDAR-Scans",
  "scans": [
    {
      "id": "scan-a",
      "label": "Scan A",
      "source": "SiteScape",
      "type": "pointcloud",
      "format": "copc",
      "file": "scan-a.copc.laz",
      "units": "m"
    },
    {
      "id": "scan-b",
      "label": "Scan B",
      "source": "Polycam",
      "type": "pointcloud",
      "format": "copc",
      "file": "scan-b.copc.laz",
      "units": "m"
    }
  ]
}
```

Dateinamen müssen einfache Namen ohne Verzeichnisse sein und auf `.copc.laz` enden. Optionale Manifestfelder sind `points`, `extent`, `attributes` und `webFormat`.

## Zenodo-Datensatz veröffentlichen

Vor **Publish** müssen alle Viewer-Dateien 100 % Uploadfortschritt anzeigen und eine Prüfsumme besitzen. Danach den Entwurf speichern, über den persönlichen Geheimlink einmal öffnen und alle Scans im Auswahlmenü testen. Die Sichtbarkeit bleibt auf **Files only → Restricted**; ein Embargo ist für dieses Freigabemodell nicht nötig.

Beim Veröffentlichen werden Datensatzseite und Metadaten öffentlich, die Dateien bleiben eingeschränkt. Ein vorhandener Link mit `Can preview drafts` kann laut Zenodo auf eingeschränkte Dateien der aktuellen und zukünftigen Versionen zugreifen. Für den Zugriff ausschließlich auf eine veröffentlichte Version wird pro Person ein eigener Link mit `Can view` erzeugt. Der Viewer probiert automatisch zuerst den Entwurfsendpunkt und anschließend den veröffentlichten Endpunkt.

Veröffentlichte Dateien sollten als unveränderlich behandelt werden. Korrekturen, Ergänzungen und neue Scans gehören in eine neue Zenodo-Version, damit frühere Fassungen nachvollziehbar bleiben.

## Lokal testen

Aus dem Projektstamm unter Windows PowerShell:

```powershell
py -3.12 .\scripts\serve_viewer.py --port 8765
```

Anschließend den persönlichen Viewer-Link im Browser öffnen:

```text
http://127.0.0.1:8765/index.html#record=RECORD_ID&token=SECRET
```

`RECORD_ID` und `SECRET` stammen aus dem von Zenodo erzeugten Geheimlink. Der Viewer entfernt das Fragment sofort aus der Adresszeile und behält den Zugang nur in der aktuellen Tab-Sitzung (`sessionStorage`). Beim Schließen aller Kopien des Tabs oder über **Zugang aus diesem Tab entfernen** wird er verworfen. Zur Einschränkung durch dieselbe Web-Origin siehe [SECURITY.md](SECURITY.md).

Der Link funktioniert sowohl mit einem unveröffentlichten Entwurf (`Can preview drafts`) als auch nach der eingeschränkten Veröffentlichung. Der Viewer ermittelt den passenden Zenodo-Endpunkt automatisch.

## Weitere SiteScape-Scans aufbereiten

Das mitgelieferte PowerShell-Skript verwendet die systemweite Python-3.12-Installation. Es installiert fehlende, festgeschriebene Pakete für das aktuelle Windows-Benutzerkonto und legt keine virtuelle Umgebung an.

Für einen einzelnen Scan:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
& .\scripts\build_scan.ps1 `
  -InputFile "C:\Scans\SPZ Squash.e57" `
  -Name "Sportzentrum - Squash" `
  -Slug "spz-squash"
```

Eine geometrisch geprüfte, geteilte E57-Aufnahme kann ohne Ausdünnung in eine gemeinsame COPC-Datei geschrieben werden:

```powershell
& .\scripts\build_scan.ps1 `
  -InputFile @("C:\Scans\Lueftung 1.e57", "C:\Scans\Lueftung 2.e57") `
  -Name "Sportzentrum - Lüftung" `
  -Slug "spz-lueftung" `
  -AssumeCommonCoordinates
```

`-AssumeCommonCoordinates` bestätigt ausdrücklich, dass Pose, Grenzen und Überlappung zuvor geprüft wurden. Das Skript führt keine automatische Registrierung oder ICP-Ausrichtung durch.

## Darstellungsqualität

Die Auswahl **Auto / Hoch / Maximum** wirkt sofort und verändert weder die COPC-Datei noch Messwerte. Sie verändert ausschließlich den gleichzeitig dargestellten Detailgrad:

| Stufe | Desktop | Kompakte Geräte | Verwendung |
|---|---:|---:|---|
| Auto | bis 3,5 Mio. Punkte | bis 1,2 Mio. Punkte | ausgewogene Voreinstellung |
| Hoch | bis 5,5 Mio. Punkte | bis 2,0 Mio. Punkte | detaillierte normale Untersuchung |
| Maximum | bis 9,0 Mio. Punkte | bis 3,5 Mio. Punkte | feinste Ansicht auf leistungsfähiger Hardware |

Alle Stufen verwenden adaptive, runde Punkte und zunehmend feinere Potree-LOD-Schwellen. Höhere Stufen benötigen mehr Zenodo-Anfragen, Grafikleistung und Arbeitsspeicher. Qualitäts- und Spracheinstellungen verwenden getrennte Schlüssel in `localStorage`; der Zenodo-Zugang bleibt davon getrennt und ausschließlich tab-lokal in `sessionStorage`.

## Auf GitHub Pages bereitstellen

1. Inhalt dieses Verzeichnisses in ein eigenes GitHub-Repository übernehmen.
2. Auf GitHub **Settings → Pages → Build and deployment → Source → GitHub Actions** auswählen.
3. Unter **Actions** den Abschluss von **Deploy protected LiDAR viewer** abwarten.
4. Die angezeigte Pages-Adresse öffnen. Sie hat typischerweise dieses Schema:

```text
https://USERNAME.github.io/REPOSITORY/
```

Der mitgelieferte Workflow veröffentlicht ausschließlich `viewer/`. Tests, Skripte und die Dokumentation im Projektstamm werden nicht als Website ausgeliefert.

Die GitHub-Pages-Hülle ist bewusst öffentlich, weil sie weder Scandaten noch Zugangsdaten enthält. GitHub weist darauf hin, dass eine Pages-Site auch bei einem privaten Repository öffentlich sein kann. GitHub Free stellt Pages regulär für öffentliche Repositorys bereit; private Repositorys benötigen einen passenden Tarif. Die Scandateien bleiben unabhängig von der Sichtbarkeit des Repositorys in Zenodo eingeschränkt.

## Persönlichen Viewer-Link zusammensetzen

Ein Zenodo-Geheimlink enthält die benötigten Werte:

```text
https://zenodo.org/records/RECORD_ID?preview=1&token=SECRET
```

Daraus wird der persönliche Viewer-Link:

```text
https://USERNAME.github.io/REPOSITORY/#record=RECORD_ID&token=SECRET
```

Optional kann ein bestimmter Scan vorausgewählt werden:

```text
https://USERNAME.github.io/REPOSITORY/#record=RECORD_ID&token=SECRET&scan=SCAN_ID
```

Den vollständigen persönlichen Link niemals in Git, GitLab, eine öffentliche README, ein Issue oder einen Screenshot kopieren. Für jede Person sollte in Zenodo ein eigener, möglichst befristeter Link erzeugt werden. Jeder Link kann dort jederzeit widerrufen werden.

## Sicherheitsmodell

- Das URL-Fragment wird nicht an GitHub Pages gesendet und sofort aus der Adresszeile entfernt.
- Zenodo-Origin und API-Pfade sind fest vorgegeben; beliebige `?data=`-Quellen sind deaktiviert.
- Der Token wird weder in Konfiguration noch DOM, Konsolenausgaben oder `localStorage` geschrieben.
- Zugangsdaten bleiben ausschließlich in der aktuellen Tab-Sitzung in `sessionStorage`.
- COPC-Anfragen akzeptieren nur exakte HTTP-`206 Partial Content`-Bytebereiche. Eine vollständige `200 OK`-Antwort wird vor dem Einlesen verworfen.
- Wiederholte Bereiche werden im Speicher dedupliziert. Anfragestarts sind auf etwa 40 pro Minute begrenzt und liegen damit unter Zenodos dokumentiertem Gastlimit von 60 pro Minute.
- CSP, `no-referrer` und `noindex` reduzieren unbeabsichtigte Weitergabe und Auffindbarkeit.
- Die Sprachauswahl verwendet getrennten, nicht sensiblen Zustand und kann weder Zugangssitzung noch Anfrage-URLs oder Streamingverhalten verändern.

Ein Geheimlink ist kein DRM. Wer den Link erhalten hat, darf die Daten im Browser laden und kann Token und übertragene Punktdaten grundsätzlich mit Entwicklerwerkzeugen auslesen. Personen ohne gültigen Token erhalten keinen Zugriff auf die eingeschränkten Dateien.

Die Einschränkung von `sessionStorage` auf dieselbe Origin, das Vorgehen bei offengelegten Links und weitere technische Grenzen stehen in [SECURITY.md](SECURITY.md).

## Tests ausführen

Es werden nur Node.js und Python benötigt:

```powershell
node --check .\viewer\zenodo-access.js
node --check .\viewer\i18n.js
node --check .\viewer\app.js
node --test .\tests\test_zenodo_access.mjs
node --test .\tests\test_i18n.mjs
py -3.12 -m unittest -v tests.test_static_and_server
```

Die bestehenden Tests prüfen Fragmentbereinigung, Entwurfs- und Veröffentlichungsendpunkte, Mehrscan-Auswahl, Manifestvalidierung, Traversal-Schutz, exakte Bytebereiche, Deduplizierung, Abbruch bei vollständigen `200`-Antworten, Darstellungsstufen, verbotene Scandateien im Webordner und den lokalen Range-Server.

Die Übersetzungs- und Sicherheitstests prüfen zusätzlich identische Wörterbuchschlüssel, vollständige Zuordnung der Markup-Schlüssel, englischen statischen Fallback, Erkennung von `de-AT`, englischen Fallback für nicht unterstützte Sprachen, Vorrang einer gespeicherten Auswahl, ungültige gespeicherte Werte, unmittelbare Übersetzung von Texten und Attributen, Synchronisierung der Potree-Sprache, sprachabhängige Zahlenformatierung, Trennung von Spracheinstellung und Zugangsdaten, CSP und sicherheitskritische Skriptreihenfolge sowie einen unveränderten `viewer/vendor/`-Baum.

## Verzeichnisstruktur

```text
.
├── .github/workflows/deploy-pages.yml
├── QA_REPORT.md
├── README.md
├── README.de.md
├── SECURITY.md
├── THIRD_PARTY_NOTICES.md
├── qa/
├── scripts/
│   ├── build_scan.ps1
│   ├── prepare_pointcloud.py
│   ├── requirements.txt
│   └── serve_viewer.py
├── tests/
│   ├── test_i18n.mjs
│   ├── test_static_and_server.py
│   └── test_zenodo_access.mjs
└── viewer/
    ├── .nojekyll
    ├── index.html
    ├── config.js
    ├── zenodo-access.js
    ├── i18n.js
    ├── app.js
    ├── styles.css
    ├── data/README.md
    └── vendor/
```

## Qualitätssicherung und Referenzen

[QA_REPORT.md](QA_REPORT.md) ist der datierte Konvertierungs- und Streaming-Prüfbericht vom 1. September 2026. Er dokumentiert die damals geprüfte Pipeline SiteScape → LAZ → COPC/Potree und die damaligen Testbedingungen; er ist keine Aussage zum aktuellen Bereitstellungsstatus eines produktiven Zenodo-Records.

- [Zenodo: Link sharing](https://help.zenodo.org/docs/share/link-sharing/)
- [Zenodo: About records](https://help.zenodo.org/docs/deposit/about-records/)
- [Zenodo: Manage versions](https://help.zenodo.org/docs/deposit/manage-versions/)
- [Zenodo: REST API und Rate Limits](https://developers.zenodo.org/)
- [GitHub: Pages mit einem eigenen GitHub-Actions-Workflow veröffentlichen](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Potree](https://github.com/potree/potree)

## Open-Source-Komponenten und Danksagung

Dieser Viewer baut auf folgenden Open-Source-Projekten auf:

- [Potree 1.8.0](https://github.com/potree/potree), einem WebGL-Viewer für große Punktwolken von Markus Schütz und Mitwirkenden — BSD-2-Clause;
- [copc.js](https://github.com/connormanning/copc.js), einer Bibliothek zum Lesen und Streamen von COPC von Connor Manning — MIT;
- [copc-converter 0.9.15](https://github.com/360-geo/copc-converter), bei der Vorverarbeitung zur Konvertierung von LAS/LAZ nach COPC verwendet — MIT.

Die Scanaufbereitung verwendet außerdem die in [`scripts/requirements.txt`](scripts/requirements.txt) festgeschriebenen Python-Pakete laspy, lazrs, NumPy, pye57 und pyquaternion.

Die projektspezifische Benutzeroberfläche, die geschützte Zenodo-Zugriffsschicht, die Verarbeitung mehrteiliger Aufnahmen und der GitHub-Pages-Workflow wurden für dieses Masterarbeitsprojekt entwickelt. Beim bilingualen Umbau wird keine Datei unter `viewer/vendor/` verändert.

Vollständige Copyright- und Lizenzhinweise der eingebundenen Komponenten befinden sich in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) und in den mitgelieferten Lizenzdateien der jeweiligen Komponenten. Ohne eine gesonderte Projektlizenz wird für den erstentwickelten Integrations- und UI-Code keine zusätzliche öffentliche Nutzungslizenz erteilt.
