# Geschützter LiDAR-Viewer mit GitHub Pages und Zenodo

[English](README.md) | **Deutsch**

Dieses Paket stellt Potree als statische Website bereit. Die Website enthält **keine Scandaten, keine Zenodo-Record-ID und kein Zugangstoken**. Punktwolken werden erst nach dem Öffnen eines persönlichen Geheimlinks bereichsweise aus einem eingeschränkten Zenodo-Datensatz geladen.

## Was nach Zenodo gehört

Für den Browser-Viewer werden nur diese Dateien benötigt:

1. genau eine `viewer-manifest.json`; und
2. je Scan genau eine weboptimierte `*.copc.laz`.

E57, PLY, normale LAZ, GLB, Grundrisse und weitere Originaldateien können zusätzlich als Archivkopien in Zenodo liegen, werden von diesem Potree-Viewer aber nicht geladen. HTML, JavaScript, Potree und dieses Repository gehören **nicht** in den Zenodo-Datensatz.

Der aktuelle SiteScape-Datensatz besteht damit aus fünf Viewer-Dateien: einem Manifest und vier COPC-Dateien. Weitere Scans werden in einer neuen Zenodo-Version als zusätzliche COPC-Dateien ergänzt und im Manifest eingetragen.

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

Vor **Publish** müssen alle Viewer-Dateien 100 % anzeigen und eine Prüfsumme besitzen. Danach den Entwurf speichern, über den persönlichen Geheimlink einmal öffnen und alle Scans im Auswahlmenü testen. Die Sichtbarkeit bleibt auf **Files only → Restricted**; ein Embargo ist für dieses Freigabemodell nicht nötig.

Beim Veröffentlichen werden Datensatzseite und Metadaten öffentlich, die Dateien bleiben eingeschränkt. Der vorhandene Link mit `Can preview drafts` berechtigt laut Zenodo auch zum Zugriff auf eingeschränkte Dateien aktueller und zukünftiger Versionen. Für eine reine Freigabe der veröffentlichten Fassung kann alternativ pro Person ein Link mit `Can view` erzeugt werden. Der Viewer probiert automatisch zuerst den Entwurf und anschließend die veröffentlichte Fassung.

Veröffentlichte Dateien sollten praktisch als unveränderlich behandelt werden. Inhaltliche Ergänzungen oder neue Scans gehören in eine neue Zenodo-Version; dadurch bleibt die vorherige Fassung nachvollziehbar.

## Sprachauswahl

Die vollständige Viewer-Oberfläche einschließlich Hilfen, Tooltips, Dialogen, Status- und Fehlermeldungen sowie der eingebetteten Potree-Steuerelemente ist auf Englisch und Deutsch verfügbar. Der **DE/EN**-Schalter wechselt die Sprache unmittelbar, ohne die Punktwolke neu zu laden.

Die anfängliche Sprache wird in dieser Reihenfolge gewählt:

1. ein gültiger gespeicherter Wert (`en` oder `de`) aus `lidar-viewer.language.v1`;
2. die erste unterstützte Einstellung in `navigator.languages`, ausgewertet nach ihrem primären Sprachkürzel (beispielsweise wird `de-AT` zu `de`); falls diese Liste nicht verfügbar ist, wird `navigator.language` verwendet; und
3. Englisch, falls keine unterstützte Browsersprache gefunden wird.

Beim Sprachwechsel wird ausschließlich die Sprachpräferenz in `localStorage` gespeichert. Die Darstellungsqualität verwendet einen eigenen, unabhängigen `localStorage`-Eintrag. Zenodo-Record-ID und Token werden dort niemals abgelegt: Die Zugangsdaten bleiben getrennt im tab-lokalen `sessionStorage`. Bezeichnungen und Metadaten aus `viewer-manifest.json` bleiben exakt wie eingetragen und werden nicht übersetzt.

## Lokal testen

Aus dem Projektstamm unter Windows PowerShell:

```powershell
py -3.12 .\scripts\serve_viewer.py --port 8765
```

Anschließend den persönlichen Viewer-Link im Browser öffnen:

```text
http://127.0.0.1:8765/index.html#record=RECORD_ID&token=SECRET
```

`RECORD_ID` und `SECRET` stammen aus dem von Zenodo erzeugten Geheimlink. Der Viewer entfernt das Fragment sofort aus der Adresszeile und behält den Zugang nur in der aktuellen Tab-Sitzung (`sessionStorage`). Beim Schließen aller Kopien des Tabs oder über **Zugang aus diesem Tab entfernen** wird er verworfen. Für die Trennung des Speichers nach Origin siehe [SECURITY.md](SECURITY.md).

Der Link funktioniert sowohl mit einem unveröffentlichten Entwurf (`Can preview drafts`) als auch nach der eingeschränkten Veröffentlichung. Der Viewer ermittelt den passenden Zenodo-Endpunkt automatisch.

## Weitere SiteScape-Scans aufbereiten

Das mitgelieferte PowerShell-Skript verwendet die systemweite Python-3.12-Installation und installiert fehlende, festgeschriebene Pakete für das Windows-Benutzerkonto; es legt keine virtuelle Umgebung an. Für einen einzelnen Scan:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
& .\scripts\build_scan.ps1 `
  -InputFile "C:\Scans\SPZ Squash.e57" `
  -Name "Sportzentrum - Squash" `
  -Slug "spz-squash"
```

Eine bereits geometrisch geprüfte, geteilte E57-Aufnahme kann ohne Ausdünnung in eine gemeinsame COPC-Datei geschrieben werden:

```powershell
& .\scripts\build_scan.ps1 `
  -InputFile @("C:\Scans\Lueftung 1.e57", "C:\Scans\Lueftung 2.e57") `
  -Name "Sportzentrum - Lüftung" `
  -Slug "spz-lueftung" `
  -AssumeCommonCoordinates
```

`-AssumeCommonCoordinates` bestätigt bewusst, dass Pose, Grenzen und Überlappung zuvor geprüft wurden; das Skript führt keine automatische Registrierung oder ICP-Ausrichtung durch.

## Darstellungsqualität

Die Auswahl **Auto / Hoch / Maximum** wirkt sofort und verändert weder COPC-Datei noch Messwerte. Die Stufen erhöhen ausschließlich den gleichzeitig dargestellten Detailgrad:

| Stufe | Desktop | Kompakte Geräte | Verwendung |
|---|---:|---:|---|
| Auto | bis 3,5 Mio. Punkte | bis 1,2 Mio. Punkte | ausgewogene Voreinstellung |
| Hoch | bis 5,5 Mio. Punkte | bis 2,0 Mio. Punkte | detaillierte normale Untersuchung |
| Maximum | bis 9,0 Mio. Punkte | bis 3,5 Mio. Punkte | feinste Ansicht auf leistungsfähiger Hardware |

Alle Stufen verwenden adaptive, runde Punkte und eine zunehmend feinere Potree-LOD-Schwelle. Höhere Stufen benötigen mehr Zenodo-Anfragen, Grafikleistung und Arbeitsspeicher. Nur die Qualitätswahl wird unter ihrem eigenen Schlüssel in `localStorage` gespeichert; der Zenodo-Zugang bleibt davon getrennt und ausschließlich tab-lokal in `sessionStorage`.

## Auf GitHub Pages bereitstellen

1. Inhalt dieses Verzeichnisses in ein eigenes GitHub-Repository übernehmen.
2. Auf GitHub **Settings → Pages → Build and deployment → Source → GitHub Actions** auswählen.
3. Den Lauf **Deploy protected LiDAR viewer** unter **Actions** abwarten.
4. Die angezeigte Pages-Adresse öffnen. Sie hat typischerweise dieses Schema:

```text
https://USERNAME.github.io/REPOSITORY/
```

Der mitgelieferte Workflow veröffentlicht ausschließlich den Ordner `viewer/`. Tests, Skripte und Dokumentation werden nicht als Teil der Website ausgeliefert.

GitHub Pages selbst ist in diesem Aufbau öffentlich erreichbar. Das ist beabsichtigt, weil die Seite nur die Viewer-Hülle enthält. GitHub weist darauf hin, dass eine Pages-Site auch bei einem privaten Repository öffentlich sein kann. Auf GitHub Free steht Pages regulär für öffentliche Repositorys zur Verfügung; private Repositorys benötigen einen passenden Tarif. Die Scandaten bleiben unabhängig von Repository- und Pages-Sichtbarkeit in Zenodo eingeschränkt.

## Persönlichen Viewer-Link zusammensetzen

Ein Zenodo-Geheimlink enthält dieselben beiden Werte, die der Viewer benötigt:

```text
https://zenodo.org/records/RECORD_ID?preview=1&token=SECRET
```

Für die Empfängerin oder den Empfänger wird daraus:

```text
https://USERNAME.github.io/REPOSITORY/#record=RECORD_ID&token=SECRET
```

Optional kann ein bestimmter Scan vorausgewählt werden:

```text
https://USERNAME.github.io/REPOSITORY/#record=RECORD_ID&token=SECRET&scan=SCAN_ID
```

Den vollständigen persönlichen Link niemals in Git, GitLab, eine öffentliche README, ein Issue oder einen Screenshot kopieren. Für jede Person sollte in Zenodo ein eigener, möglichst befristeter Link erzeugt werden. Ein Link kann dort jederzeit widerrufen werden.

## Sicherheitsmodell

- Das URL-Fragment wird nicht an GitHub Pages gesendet und sofort aus der Adresszeile entfernt.
- Zenodo-Origin und API-Pfade sind fest vorgegeben; beliebige `?data=`-Quellen sind deaktiviert.
- Der Token wird weder in Konfiguration noch DOM, Konsolenausgaben oder `localStorage` geschrieben.
- COPC-Anfragen akzeptieren ausschließlich exakte HTTP-`206`-Bytebereiche. Eine vollständige `200`-Antwort wird vor dem Einlesen des Inhalts abgebrochen.
- Wiederholte Bereiche werden im Speicher dedupliziert; Starts werden auf etwa 40 Anfragen pro Minute begrenzt, unterhalb von Zenodos dokumentiertem Gastlimit von 60 pro Minute.
- CSP, `no-referrer` und `noindex` reduzieren unbeabsichtigte Weitergabe und Auffindbarkeit.

Ein Geheimlink ist kein DRM: Wer den Link erhalten hat, darf die Daten im Browser laden und kann sie mit Entwicklerwerkzeugen grundsätzlich auch herunterladen. Nicht berechtigte Personen erhalten ohne Token keinen Zugriff auf die eingeschränkten Dateien.

Weitere Hinweise stehen in [SECURITY.md](SECURITY.md).

## Tests ausführen

Es werden nur Node.js und Python benötigt. Aus dem Repository-Stamm unter Windows PowerShell:

```powershell
node --check .\viewer\zenodo-access.js
node --check .\viewer\i18n.js
node --check .\viewer\config.js
node --check .\viewer\app.js
node --test .\tests\test_i18n.mjs .\tests\test_zenodo_access.mjs
py -3.12 -m unittest discover -s tests -p "test_*.py" -v
```

Die Tests prüfen unter anderem die sofortige Fragmentbereinigung, Draft-/Published-Endpunkte, Mehrscan-Auswahl, Manifestvalidierung, Traversal-Schutz, exakte Bytebereiche, Deduplizierung, Abbruch bei `200`, Darstellungsstufen, Gleichstand der Übersetzungskataloge und Fallback-Verhalten, den live ausgeführten Sprachwechsel und die Speichertrennung, fehlende Scandateien im Webordner sowie den lokalen Range-Server.

## Verzeichnisstruktur

```text
.
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── README.md
├── README.de.md
├── SECURITY.md
├── THIRD_PARTY_NOTICES.md
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
    ├── data/
    │   └── README.md
    └── vendor/
```

## Referenzen

- [Zenodo: Link sharing](https://help.zenodo.org/docs/share/link-sharing/)
- [Zenodo: About records](https://help.zenodo.org/docs/deposit/about-records/)
- [Zenodo: Manage versions](https://help.zenodo.org/docs/deposit/manage-versions/)
- [Zenodo: REST API und Rate Limits](https://developers.zenodo.org/)
- [GitHub: Pages mit GitHub Actions veröffentlichen](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Potree](https://github.com/potree/potree)

## Open-Source-Komponenten und Danksagung

Dieser Viewer baut auf folgenden Open-Source-Projekten auf:

- [Potree 1.8](https://github.com/potree/potree), ein WebGL-Viewer für große Punktwolken von Markus Schütz und Mitwirkenden — BSD-2-Clause-Lizenz.
- [copc.js](https://github.com/connormanning/copc.js), eine Bibliothek zum Lesen und Streamen von Cloud-Optimized Point Clouds (COPC) von Connor Manning — MIT-Lizenz.
- [copc-converter](https://github.com/360-geo/copc-converter), verwendet bei der Vorverarbeitung zur Konvertierung von LAS/LAZ nach COPC — MIT-Lizenz.

Die projektspezifische Benutzeroberfläche, die geschützte Zenodo-Zugriffsschicht, die Verarbeitung mehrteiliger Aufnahmen und der GitHub-Pages-Workflow wurden für dieses Masterarbeitsprojekt entwickelt.

Die vollständigen Copyright- und Lizenzhinweise der eingebundenen Komponenten befinden sich in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) sowie in den mitgelieferten Lizenzdateien der jeweiligen Bibliotheken.
