# Berliner S-Bahn-Stationsdaten (lokal)

`berlin-sbahn-stations.json` wird mit der App ausgeliefert. Für die Anzeige des nächstgelegenen S-Bahnhofs ist **kein Drittanbieter-API-Aufruf zur Laufzeit** erforderlich. Die U-Bahn-Erkennung verwendet derzeit weiterhin ihre bisherige, getrennte Abfrage bzw. den Browser-Cache.

## Herkunft und Lizenzen

- **Koordinaten:** [Deutsche Bahn Station&Service Bahnhofsdaten, Stand September 2017](https://github.com/ratopi/haltestellendaten), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), © Deutsche Bahn. Es handelt sich um ältere Daten, nicht um tagesaktuelle Zugangs- oder Fahrplaninformationen.
- **Zuordnung zum S-Bahn-Verkehr und Stationsnamen:** [poldixd/vbb-stations](https://github.com/poldixd/vbb-stations), Copyright (c) 2017 Nils, MIT-Lizenz. Die Liste beruht auf damaligen VBB-Verkehrsunternehmensdaten.

Die Datensätze wurden über Stationsnamen abgeglichen und bei abweichenden Schreibweisen mit nachvollziehbaren DB-Stationsnamen ergänzt. Nicht sicher zuordenbare Stationen wurden **nicht** mit geschätzten Koordinaten ergänzt. Die Datei ist deshalb nicht vollständig und sollte später mit aktuellen VBB-GTFS-Daten ersetzt werden. Entfernungen in der App sind Luftlinie, kein Fußweg.

Die Daten dürfen mit entsprechender Namensnennung weiterverwendet werden. Hinweise auf DB/VBB und die jeweilige Lizenz sollten bei Verteilung der App beibehalten werden.
