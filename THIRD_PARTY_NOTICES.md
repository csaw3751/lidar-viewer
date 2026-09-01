# Hinweise zu Drittkomponenten

Der Webordner enthält Potree 1.8.0 und von Potree gebündelte Open-Source-Bibliotheken. Die jeweiligen Lizenztexte liegen direkt bei den Komponenten unter:

- `viewer/vendor/potree/LICENSE`
- `viewer/vendor/potree/resources/LICENSE`
- `viewer/vendor/potree/resources/textures/LICENSE`
- `viewer/vendor/libs/**/LICENSE*`

`viewer/vendor/potree/potree.js` wurde für diesen Viewer geringfügig angepasst, damit Fehler beim COPC-Range-Streaming als Promise-Fehler weitergereicht werden und fehlerhafte Knoten nicht in einer Anfrageschleife hängen bleiben. Der Potree-Lizenzhinweis bleibt unverändert erhalten.

Nicht benötigte Potree-Beispielmodelle, die Textur `brick_pavement.jpg` und die serverseitige Datei `image_preview.php` sind aus dem Release-Paket ausgeschlossen. Sie werden für Punktwolkenanzeige, Messungen, Profile oder Clipping nicht benötigt.

Für den selbst entwickelten Integrations- und UI-Code wird mit diesem Paket keine zusätzliche öffentliche Nutzungslizenz erteilt. Das berührt die Rechte aus den beigefügten Open-Source-Lizenzen nicht.
