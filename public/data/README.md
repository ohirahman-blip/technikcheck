# Berliner S-Bahn-Stationsdaten (lokal)

`berlin-sbahn-stations.json` wird mit der App ausgeliefert. Für die Anzeige des nächstgelegenen S-Bahnhofs ist **kein Drittanbieter-API-Aufruf zur Laufzeit** erforderlich. Die U-Bahn-Erkennung verwendet ebenfalls eine gebündelte lokale Datei.

## Herkunft und Lizenzen

- **Koordinaten:** [Deutsche Bahn Station&Service Bahnhofsdaten, Stand September 2017](https://github.com/ratopi/haltestellendaten), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), © Deutsche Bahn. Es handelt sich um ältere Daten, nicht um tagesaktuelle Zugangs- oder Fahrplaninformationen.
- **Zuordnung zum S-Bahn-Verkehr und Stationsnamen:** [poldixd/vbb-stations](https://github.com/poldixd/vbb-stations), Copyright (c) 2017 Nils, MIT-Lizenz. Die Liste beruht auf damaligen VBB-Verkehrsunternehmensdaten.

Die Datensätze wurden über Stationsnamen abgeglichen und bei abweichenden Schreibweisen mit nachvollziehbaren DB-Stationsnamen ergänzt. Nicht sicher zuordenbare Stationen wurden **nicht** mit geschätzten Koordinaten ergänzt. Die Datei ist deshalb nicht vollständig und sollte später mit aktuellen VBB-GTFS-Daten ersetzt werden. Entfernungen in der App sind Luftlinie, kein Fußweg.

Die Daten dürfen mit entsprechender Namensnennung weiterverwendet werden. Hinweise auf DB/VBB und die jeweilige Lizenz sollten bei Verteilung der App beibehalten werden.


## U-Bahn (statisch)

`berlin-ubahn-stations.json` enthält 167 eindeutig benannte U-Bahnhöfe samt Koordinaten. Die Daten stammen aus der Wikidata-Koordinatenabfrage aus dem öffentlichen Forschungsbeispiel [Exploring the U-Bahn with Neo4j / 03-stations.csv](https://gist.github.com/CliffordAnderson/7fb7473af31f9343f8a55518545480a0) (Wikidata CC0). Doppelte Koordinaten-/Namenseinträge und eindeutig als S-Bahn bezeichnete Stationen wurden nicht übernommen. Es handelt sich um einen historischen Snapshot; neu eröffnete oder umbenannte Bahnhöfe sollten bei Aktualisierungen mit aktuellen offiziellen Daten abgeglichen werden.

Beide Bahnhofstypen werden seit dem Deployment-Fix ausschließlich über die lokalen Dateien unter `/data/berlin-ubahn-stations.json` und `/data/berlin-sbahn-stations.json` geladen. Frühere Cache-Stände dienen lediglich als Fallback bei beschädigter lokaler Auslieferung. Es werden keine Overpass-Abfragen mehr für die nächsten U-/S-Bahnhöfe ausgelöst.
