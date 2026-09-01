# QA-Bericht: SiteScape → LAZ → COPC/Potree

**Prüfdatum:** 1. September 2026  
**Referenzscan:** SPZ Squash  
**Prüfziel:** Feststellen, ob vorhandene SiteScape-Dateien ohne erneute Aufnahme als farbige, maßstäbliche Punktwolke für einen statischen Potree-Webviewer aufbereitet werden können.

## Gesamturteil

**Bestanden für die lokale Datenpipeline.** Die E57- und PLY-Datei enthalten nach Normalisierung der PLY-Achsen exakt dieselben 11.033.814 XYZRGB-Punkte. Die E57-Datei wurde mit unveränderter Punktzahl und Farbe in eine LAZ-Datei, eine hierarchische COPC-Einzeldatei sowie einen lesbaren klassischen Potree-2-Datensatz überführt.

Die Veröffentlichung auf GitHub Pages und der Abruf einer auf Zenodo veröffentlichten Datei sind externe Deployment-Schritte. Sie sind von der bestandenen Konvertierungsprüfung zu unterscheiden und müssen nach Anlage des echten öffentlichen Zenodo-Records noch einmal mit dessen endgültiger URL geprüft werden.

## 1. Prüfumfang

| Test | Gegenstand | Status |
|---|---|---|
| Quelldateien | Dateigröße, Hash, Punktzahl, Felder und Koordinatengültigkeit | Bestanden |
| E57/PLY-Vergleich | Achsen, XYZ und RGB über alle Punkte | Bestanden |
| E57 → LAZ | Punktzahl, Grenzen, RGB, LAS-Metadaten | Bestanden |
| LAZ → COPC | Punktzahl, Skala, Offsets, XYZRGB-Prüfsummen und LOD-Abfragen | Bestanden |
| LAZ → Potree 2 | Metadaten, Punktzahl, Attribute und Ausgabedateien | Bestanden |
| Lokaler HTTP-Server | CORS, `OPTIONS` und Byte-Range-Abruf der COPC-Datei | Bestanden |
| Öffentlicher Zenodo-COPC-Test | CORS, Byte-Range und progressive Teilabrufe an einem bestehenden Record | Bestanden |
| Browser-Viewer | RGB-Rendering und UI-Werkzeuge in einem echten Browser | Separater Abschlusslauf |
| Zenodo-Produktivlink | Endgültiger Record, CORS, Range und Browserabruf | Nach Veröffentlichung erneut prüfen |
| Polycam | GLB-Textur und kostenpflichtige Punktwolken-Exporte | Nicht durch SiteScape-Dateien abgedeckt |

Die maschinenlesbaren Primärberichte sind [qa/e57-ply-comparison.json](qa/e57-ply-comparison.json), [qa/e57-to-laz.json](qa/e57-to-laz.json) und [qa/laz-to-copc.json](qa/laz-to-copc.json).

## 2. Quelldateien

| Datei | Größe | SHA-256 |
|---|---:|---|
| `SPZ Squash.e57` | 166.226.944 Byte | `ad611e9563d9d41404bd49779656896f1b0c4dfc58e5ee1cc8d894c13f74e2df` |
| `SPZ Squash.ply` | 165.507.429 Byte | `f89c35c02e8dc1778dd4a7fbf35c9132267e7f1ae39ca5e4cb7f1b1958aba511` |

Beide Dateien enthalten:

- 11.033.814 Punkte;
- XYZ-Koordinaten als 32-Bit-Gleitkommazahlen;
- Rot, Grün und Blau als 8-Bit-Werte;
- keine nicht-endlichen XYZ-Werte.

Die E57-Datei enthält keine Scan-Pose und kein CRS/EPSG. Die Koordinaten sind daher lokal. Im getesteten E57-Datensatz wurde Z als Hochachse beibehalten.

### E57-Koordinatengrenzen

| Achse | Minimum | Maximum | Spannweite |
|---|---:|---:|---:|
| X | −7,730779648 | −1,717587113 | 6,013192534 |
| Y | −10,272649765 | −4,815305710 | 5,457344055 |
| Z | 1,373824239 | 4,859850407 | 3,486026168 |

### E57-Farbwerte

| Kanal | Minimum | Maximum | Mittelwert |
|---|---:|---:|---:|
| Rot | 0 | 255 | 159,5727 |
| Grün | 0 | 255 | 161,5758 |
| Blau | 0 | 255 | 159,6769 |

## 3. E57/PLY-Gleichheit

Die rohe PLY-Datei verwendet die SiteScape-Konvention Y-up. Vor dem Vergleich wurde jeder PLY-Punkt wie folgt in dasselbe Z-up-System wie E57 überführt:

```text
(x, y, z)PLY → (x, -z, y)Z-up
```

| Feld | Abweichende Punkte | Maximale absolute Differenz |
|---|---:|---:|
| X | 0 | 0 |
| Y | 0 | 0 |
| Z | 0 | 0 |
| Rot | 0 | 0 |
| Grün | 0 | 0 |
| Blau | 0 | 0 |

**Befund:** Die Dateien sind keine unterschiedlichen Messungen, sondern zwei Darstellungen derselben Punktfolge. Für Archivierung und Konvertierung wird E57 als Master empfohlen; PLY ist eine optionale Austauschkopie und für diesen Scan nicht zusätzlich erforderlich.

## 4. E57 → LAZ

Ausgabedatei: `source/spz-squash.laz`

| Merkmal | Ergebnis |
|---|---|
| Dateigröße | 85.258.517 Byte |
| SHA-256 | `1af76758aba343b3d50e8546a87d26a1446f75ae9538453df44890abb3c595cb` |
| Punktzahl | 11.033.814 |
| LAS-Version | 1.2 |
| Punktformat | 2 (XYZ + RGB) |
| Maßstab | 0,000001 auf allen drei Achsen |
| Offsets | X = −8, Y = −11, Z = 1 |
| RGB16 | je Kanal 0 bis 65.535 |
| CRS | keines hinterlegt |

Die 8-Bit-Farben wurden mit dem exakten Faktor 257 in den vollständigen 16-Bit-Bereich überführt. Die nach dem Schreiben erneut gelesene Punktzahl stimmt mit der Quelle überein. Sämtliche Koordinatengrenzen lagen innerhalb der durch die 1-µm-Quantisierung erlaubten Toleranz von 0,5 µm.

### Nachgelesene LAZ-Grenzen

| Achse | Minimum | Maximum |
|---|---:|---:|
| X | −7,730780 | −1,717587 |
| Y | −10,272650 | −4,815306 |
| Z | 1,373824 | 4,859850 |

## 5. LAZ → Potree 2

Verwendet wurden PotreeConverter **2.1.3** und die Optionen `--encoding BROTLI -m poisson --attributes rgb`.

Die erzeugte `metadata.json` meldet:

| Merkmal | Wert |
|---|---|
| Potree-Datenformat | 2.0 |
| Punktzahl | 11.033.814 |
| Kodierung | BROTLI |
| Attribute | `position`, `rgb` |
| Koordinatenskala | 0,000001 auf allen Achsen |
| Projektionsangabe | leer, passend zum lokalen System |

### Ausgabedateien

| Datei | Größe | SHA-256 |
|---|---:|---|
| `metadata.json` | 1.115 Byte | `6b08d5db334e6ece7804d146899d6ef391452fbbff6323b295b7d0e087bef353` |
| `hierarchy.bin` | 108.614 Byte | `76cfc85137354b13c838f26e570dfce838e1150f21de2fffe841b00c57ad7d08` |
| `octree.bin` | 102.394.259 Byte | `42dc6d17d87f1f14bf8ce7f4e229c7ecd0948106713240843b68845b93b5cf33` |

Die äußere `boundingBox` in Potrees Metadaten ist absichtlich würfelförmig und deshalb größer als die tatsächliche Punktwolke. Für die Datenprüfung wurden die Grenzen des Attributs `position` verwendet; sie stimmen mit den LAZ-Grenzen überein.

### Build-Hinweis

Der hier verwendete Linux-Quellbuild des Converters erzeugte alle drei finalen Dateien, meldete anschließend aber beim Entfernen seines temporären Chunk-Verzeichnisses einen späten Dateisystemfehler. Daher wurden nicht allein der Prozess-Exitcode, sondern die fertigen Dateien, die Metadaten, Attribute und Punktzahl separat geprüft. Für die normale Windows-Verarbeitung ist das offizielle PotreeConverter-2.1.3-Binary vorzuziehen.

## 6. LAZ → COPC

Für die Zenodo-Zielarchitektur wurde `source/spz-squash.laz` mit dem portablen Linux-Binary von **360-geo/copc_converter 0.9.15** in `viewer/data/spz-squash.copc.laz` umgewandelt.

| Merkmal | Ergebnis |
|---|---|
| Dateigröße | 99.941.088 Byte |
| SHA-256 | `0fde8b572590b40d75cf44249c5b77e58c4f31bc3fb80958a791b9310123eb21` |
| Punktzahl | 11.033.814 |
| LAS-Version | 1.4 |
| Punktformat | 7 (einschließlich RGB) |
| COPC-VLR | vorhanden |
| Skala | 0,000001 auf allen Achsen |
| Offsets | X = −8, Y = −11, Z = 1 |
| RGB16 | je Kanal 0 bis 65.535 |
| CRS | keines hinterlegt |

COPC ordnet Punkte räumlich neu; ein Vergleich gleicher Datensatzindizes wäre daher nicht aussagekräftig. Stattdessen wurden über den vollständigen LAZ- und COPC-Inhalt Punktzahl, RGB-Summen sowie modulare Summen und Quadratsummen der quantisierten XYZ-Werte verglichen. Alle Prüfwerte waren exakt gleich. Damit sind weder Punkte noch Farben verloren gegangen oder verändert worden.

Der COPC-Header verwendet dieselbe Skala und dieselben Offsets. Sein umschließender Headerbereich ist an einzelnen Minima um höchstens eine Quantisierungseinheit von 1 µm erweitert; die geprüften Punktwerte selbst sind unverändert.

### Räumliche COPC-Abfragen

`laspy.CopcReader` konnte dieselbe Datei hierarchisch in drei Detailstufen lesen:

| angeforderte Auflösung | gelieferte Punkte | Status |
|---:|---:|---|
| 0,5 | 37.695 | Bestanden |
| 0,01 | 3.971.081 | Bestanden |
| vollständig | 11.033.814 | Bestanden |

Damit ist nicht nur der LAS-Header lesbar: Hierarchie, räumliche Teilabfragen und der vollständige Datenabruf funktionieren. Dies ist die technische Grundlage für progressives Nachladen im Potree-Viewer über HTTP-Range.

### Lokaler HTTP-Range-Test

Der mitgelieferte Server `scripts/serve_viewer.py` wurde direkt gegen die erzeugte COPC-Datei geprüft:

| Anfrage | Ergebnis |
|---|---|
| `GET` mit `Range: bytes=0-999` | `206 Partial Content` |
| `Content-Range` | `bytes 0-999/99941088` |
| übertragene Länge | 1.000 Byte |
| CORS | `Access-Control-Allow-Origin: *` |
| Range-Ankündigung | `Accept-Ranges: bytes` |
| `OPTIONS` | `204 No Content`; `GET, HEAD, OPTIONS` und Header `Range` erlaubt |

Der reproduzierbare lokale Startbefehl lautet `py scripts\serve_viewer.py`; die Seite ist anschließend unter `http://127.0.0.1:8000/` erreichbar.

## 7. Zenodo-HTTP-Test

Am 1. September 2026 wurde ein bereits veröffentlichter COPC-Datensatz auf Zenodo als externe Browserquelle geprüft. Der für den Viewer geeignete Endpunkt lautet:

```text
https://zenodo.org/api/records/RECORD_ID/files/DATEINAME.copc.laz/content
```

Er lieferte im Live-Test:

- `Access-Control-Allow-Origin: *` für den ursprungsübergreifenden Browserzugriff;
- Unterstützung des `Range`-Headers im Preflight;
- `206 Partial Content` und einen korrekten `Content-Range` bei Byte-Bereichsanfragen;
- erfolgreich gelesene COPC-Header-, Hierarchie-, Wurzelpunkt- und RGB-Bereiche.

Der normale sichtbare Downloadpfad `/records/RECORD_ID/files/DATEINAME` unterstützte zwar Byte-Ranges, aber nicht die für GitHub Pages nötige CORS-Freigabe. Er eignet sich als Downloadlink, nicht als Daten-URL im Viewer.

**Abgrenzung:** Dieser Test bestätigt die technische Eignung des Zenodo-API-Endpunkts. Der eigene Record existiert noch nicht; seine endgültige, versionsspezifische URL muss nach der Veröffentlichung erneut geprüft und im Viewer fest eingetragen werden. Zenodo ist ein Forschungsdatenarchiv und kein unbegrenztes Streaming-CDN, weshalb Browser-Caching und ein vernünftiges Punktbudget wichtig bleiben.

## 8. Viewer-Funktionen und fachliche Grenzen

Der Potree-Viewer kann mit diesem Datentyp folgende Operationen ausführen:

| Funktion | Technischer Status | Fachliche Grenze |
|---|---|---|
| RGB-Darstellung | `rgb` ist im Potree-Datensatz vorhanden | Punktfarben sind keine Mesh-Fototextur |
| Punktkoordinate | Standard-Potree-Messwerkzeug | Lokales System ohne EPSG |
| Distanz, Höhe, Winkel, Fläche | Standard-Potree-Messwerkzeuge | Genauigkeit hängt von Scan und Punktwahl ab |
| Profil/Querschnitt | Profilwerkzeug mit Breite; CSV/LAS-Export | Keine automatische CAD-Schnittzeichnung |
| Clipping | Box-/Volumen-Clipping | Visuelle Selektion, keine dauerhafte Datenänderung |

Die Testdateien tragen keine Intensität, Klassifikation, Normalen, Zeitstempel oder Georeferenz. Entsprechende Filter oder Auswertungen sind mit diesem Scan nicht möglich. Die vorhandenen XYZRGB-Daten reichen jedoch für Orientierung, manuelle Messungen, Profile und Schnitte aus.

## 9. Veröffentlichungsrisiken

| Risiko | Bewertung | Maßnahme |
|---|---|---|
| Git-Dateigrenze | `octree.bin` liegt nur knapp unter 100 MiB; andere Scans können darüber liegen | Scandaten auf Zenodo, nur Viewer-Code auf GitHub Pages |
| Git LFS | Nicht als Datenquelle für GitHub Pages geeignet | Nicht für Browserdaten verwenden |
| Zenodo-Dauerhaftigkeit | Entwürfe sind nicht der endgültige zitierbare Stand | Erst veröffentlichten, versionsspezifischen Record verwenden |
| Zenodo-CORS/Range | Für partielles Nachladen erforderlich | Nach Publikation am echten `/api/records/.../content`-Endpunkt prüfen |
| Zenodo-Lastgrenzen | Archiv ist kein unbegrenztes Streaming-CDN | Caching nutzen, Punktbudget begrenzen, keine unnötigen Reloads |
| Datenschutz/Rechte | Technische Räume können sensible Details zeigen | Vor Veröffentlichung Freigabe und ggf. Redaktion prüfen |

## 10. Abgrenzung zu Polycam

Der bestandene Test reduziert das Risiko vor einem Polycam-Probeabo erheblich: Datenprüfung, LAZ-Erzeugung, Potree-Konvertierung und Analysekonzept funktionieren bereits mit einem realen Scan ähnlicher Größenordnung.

Offen bleiben ausschließlich Polycam-spezifische Punkte:

1. Welche Roh-/Exportformate der gewählte Tarif am Aktivierungstag tatsächlich freischaltet.
2. Ob Polycam-E57/LAZ/PLY Farbe, Maßstab und Achsen wie erwartet enthält.
3. Wie die fototexturierte GLB-Meshansicht neben der Potree-Punktwolke angeboten wird.

GLB sollte unabhängig davon archiviert werden, weil es die anschauliche Fototextur trägt. Für die Analyse ist zusätzlich ein farbiger Punktwolkenexport sinnvoll. Ein einzelner Polycam-Testexport genügt zunächst zur QA; danach können während des Probezeitraums alle benötigten Formate exportiert werden.

## 11. Freigabekriterium für die Gesamtsammlung

Ein weiterer Scan gilt als freigabefähig, wenn alle folgenden Punkte erfüllt sind:

- Quelldatei und SHA-256 sind dokumentiert;
- Punktzahl ist vor und nach der Konvertierung identisch;
- XYZ enthält keine NaN-/Inf-Werte;
- Hochachse und Maßstab wurden geprüft;
- RGB ist im Ziel enthalten und visuell plausibel;
- Potree/COPC lässt sich über HTTP laden;
- Messen, Profil und Clipping funktionieren in einem aktuellen Browser;
- öffentlicher Zenodo-Link verwendet den endgültigen, versionsspezifischen Record;
- Publikationsrechte und Datenschutz sind geklärt.
