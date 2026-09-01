# Sicherheitshinweise

## Geheimlinks

Zenodo-Geheimlinks sind Bearer-Zugangsdaten: Jede Person mit dem vollständigen Link erhält die zugehörige Berechtigung. Deshalb:

- pro Empfängerin oder Empfänger einen eigenen Link mit Ablaufdatum erstellen;
- Links nur direkt versenden;
- versehentlich veröffentlichte Links sofort in Zenodo löschen;
- niemals einen persönlichen Zenodo-API-Token verwenden;
- `token`, `record` oder vollständige Viewer-Links nie in Git committen.

Der Viewer liest `record` und `token` nur aus dem URL-Fragment. Nach der Validierung wird das Fragment per `history.replaceState` entfernt. Für Neu laden und Scanwechsel wird der Zugang ausschließlich in `sessionStorage` der aktuellen Tab-Sitzung gehalten; er überlebt weder das Schließen aller Kopien des Tabs noch den Befehl „Zugang aus diesem Tab entfernen“.

`sessionStorage` ist nach Web-Origin und nicht nach Repository-Pfad getrennt. Andere JavaScript-Seiten unter demselben `https://USERNAME.github.io`-Origin könnten den Eintrag im selben Tab lesen. Für besonders sensible Fälle sollte der Viewer daher die einzige Pages-Anwendung dieses Origins sein oder eine eigene Domain erhalten. Unabhängig davon sind kurze Ablaufzeiten und getrennte Zenodo-Links pro Person sinnvoll.

## Technische Grenzen

Ein statischer Viewer kann den Geheimlink nicht vor einer bereits berechtigten Person verbergen. Diese Person kann den Token und die übertragenen Punktdaten in den Browser-Entwicklerwerkzeugen sehen. Das vereinbarte Modell schützt vor öffentlichem Auffinden und vor Zugriff ohne Link, verhindert aber keinen Download durch berechtigte Personen.

Für echte personenbezogene Anmeldung, Downloadverbote oder eine große Zahl gleichzeitiger Personen wäre ein eigener Authentifizierungs-/Streamingdienst erforderlich. Zenodo ist ein Repositorium und kein Hochlast-CDN.

## Reaktion auf einen offengelegten Link

1. In Zenodo den betroffenen Link unter **Share → Links → Delete** löschen.
2. Einen neuen, befristeten Link erzeugen.
3. Den neuen Viewer-Link nur an die vorgesehenen Personen senden.
4. Git-Verlauf und öffentliche Kommunikationskanäle kontrollieren; dort darf kein Token verbleiben.

## Drittkomponenten

Der Viewer enthält Potree und dessen gebündelte Open-Source-Abhängigkeiten unter ihren jeweiligen Lizenzen. Lizenzdateien bleiben in `viewer/vendor/` erhalten. Die veralteten, aber lokal gebündelten Bibliotheken laden keinen Code von CDNs; untrusted HTML oder beliebige Datenquellen werden nicht zugelassen.
