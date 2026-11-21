# Technikcheck

Seniorengerechte Kundenseite und separate Verwaltung für deine eigene Technikberatung.

## Lokal öffnen

Node.js ab 22.12:

```bash
npm install
npm run dev
```

- Kundenseite: **http://localhost:5173/**
- Verwaltungslogin: **http://localhost:5173/admin**
- Ohne Supabase: Im Login „Lokale Verwaltung ansehen“ öffnet die ausdrücklich
  gekennzeichnete Vorschau. Sie verwendet den bisherigen IndexedDB-Speicher.
  Diese Vorschau gibt es nur im Vite-Entwicklungsmodus und nur ohne Supabase-Konfiguration.
  Es gibt keinen lokalen Ersatz-Login, der eine echte Zugangssicherung vortäuscht.

Immer dieselbe URL verwenden: localhost und 127.0.0.1 haben getrennte Browserspeicher.
Kundenanfragen und Einrichtungscodes benötigen die fertig eingerichtete Supabase-Datenbank.
Bis dahin meldet die Kundenseite keine erfolgreich übermittelte Anfrage.

## Supabase einrichten

Der Code ist vorbereitet. Die folgenden Schritte müssen im eigenen Supabase-Projekt
noch ausgeführt werden; ein GitHub-Push führt keine SQL-Migration aus.

1. Im SQL Editor diese Migrationen in der Reihenfolge **jeweils einmal** ausführen:
   - `supabase/migrations/202611210001_technikplan.sql`
   - `supabase/migrations/202611210002_customer_portal.sql`
   Falls die erste schon angewendet wurde, nur die zweite ausführen.
2. Unter **Authentication > Users** dein Verwaltungskonto mit E-Mail und Passwort
   anlegen. Es gibt bewusst keine öffentliche Registrierung in der App.
3. In `supabase/ADMIN_SETUP.sql` den Platzhalter `DEINE-ADMIN-EMAIL-HIER` ersetzen
   und den SQL-Text im SQL Editor ausführen. Keine Zugangsdaten ins Repository schreiben.
   Das Skript gibt das Konto frei und ordnet diesem einen Technikberatungsbetrieb zu.
   Die Freigabe erfolgt ausschließlich auf dem Server. Ein normales Supabase-Konto
   erhält dadurch nicht automatisch Verwaltungsrechte.
4. `.env.example` nach `.env.local` kopieren und eintragen:

```dotenv
VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=DEIN_OEFFENTLICHER_PUBLISHABLE_KEY
```

5. Im Auth-Bereich E-Mail/Passwort aktivieren. Für lokale Passwort-Reset-Links:
   Site URL `http://localhost:5173`, erlaubte Redirect URL
   `http://localhost:5173/admin?recovery=1`.
   Für späteren Betrieb die entsprechende eigene HTTPS-Adresse ergänzen.
6. `npm run dev` neu starten und unter `/admin` anmelden.

Nie `service_role`, `sb_secret_` oder Datenbankpasswörter im Browser verwenden.
`.env.local` ist von Git ausgeschlossen. Anonymous Sign-ins werden für das
Kundenportal nicht benötigt; die öffentlichen Endpunkte dürfen nur begrenzte
Portalaktionen ausführen und gewähren keinen Tabellenzugriff.

## Kundenhandy einrichten

1. In der Verwaltung einen Kunden mit Name, Telefonnummer und Adresse anlegen.
2. Kundenprofil öffnen, **Handy einrichten** wählen, ggf. „Frau Müller“ als
   Begrüßungsnamen eingeben und **Einrichtungscode erzeugen** drücken.
3. Die Kundenseite auf dem Smartphone zum Homebildschirm hinzufügen.
4. Die **installierte Webapp öffnen** und unten **Neueinrichtung** wählen.
5. Den langen Code einfügen. Er gilt 24 Stunden für ein Gerät; ein identischer
   Netzwerk-Wiederholungsversuch mit demselben Geräteschlüssel ist erlaubt.
6. Den vierstelligen Rückrufcode dem Kunden zum Aufbewahren geben.

Der Server speichert nur Hashes des langen Einrichtungscodes und des zufälligen
Geräteschlüssels. Das Handy speichert seinen Zugang und den Begrüßungsnamen lokal.
Nach Verlust der Gerätedaten erscheint die große vierstellige Code-Eingabe.
Der Rückrufcode zeigt keine Kundendaten und keinen Namen vom Server an.
Er dient ausschließlich zum Anfordern eines Rückrufs. Nach Eingabe erscheint
„Willkommen“, mit neuem Einrichtungscode wieder die persönliche Begrüßung.

Kontaktdaten im Portal werden bei der Einrichtung aus dem Kundenprofil übernommen.
Bei Änderungen an Telefonnummer oder Adresse nochmals „Einrichtungscode erzeugen“
verwenden: Dies aktualisiert die Portal-Kontaktdaten auch für bereits verbundene Geräte.
Der dabei erzeugte neue Code muss auf bereits eingerichteten Geräten nicht eingelöst werden.
„Bestehende Kundenzugänge sperren“ deaktiviert Geräte und Rückrufcode. Ein neuer
Einrichtungscode reaktiviert den Rückrufcode, aber keine zuvor gesperrten Geräte.

## Anfragen bearbeiten

Unter **Anfragen** erscheinen Rückrufwünsche mit Kontaktdaten, Zeitpunkt und Code.
Status: **Offen → In Bearbeitung → Erledigt**. Interne Notizen, Anruf-Button,
Kundenprofil und „Termin planen“ helfen bei der Bearbeitung. Ein Termin wird
nicht automatisch als Erledigung der Anfrage gewertet: Den Bearbeitungsstand
bewusst speichern. Aktive Anfragen werden vollständig geladen, erledigte Anfragen
zeigen die letzten 200. Aktualisierung alle 30 Sekunden bei sichtbarer Verwaltung,
beim Fensterfokus oder über „Aktualisieren“; offene Dialoge bleiben unberührt.

- Mehrere Klicks erzeugen pro Rückrufcode höchstens eine offene Anfrage.
- Unbekannte vierstellige Codes werden ohne Kontaktdaten als **nicht zugeordnet**
  empfangen. Die öffentliche Antwort verrät nie, ob ein Code existiert.
- Serverseitige Begrenzung: 12 Sendeversuche pro Code/Stunde sowie insgesamt
  120/5 Minuten; Einrichtungen insgesamt 60/5 Minuten. Diese globalen Grenzen
  begrenzen auch legitime Zugriffe bei hoher Last. Vierstellige Codes sind
  absichtlich keine geheimen Passwörter und verhindern keine falschen Rückrufwünsche.
- Das Kundengerät sieht den offenen Anfragestatus nur mit seinem langen Geräteschlüssel.
- Bei fehlendem Internet erscheint: „Sie haben wahrscheinlich gerade Internetprobleme.
  Bitte rufen Sie mich unter 0177 4103884 an.“ Der Anruf-Button öffnet die Telefon-App.
- Keine automatische Offline-Warteschlange; Erfolg wird erst nach Serverbestätigung angezeigt.

## Homebildschirm und Offline-Verhalten

Manifest und App-Symbole sind enthalten. Der Service Worker wird nur im
Produktionsbuild registriert. Er speichert ausschließlich eine neutrale Offline-Seite
mit der Telefonnummer. Kundendaten, API-Antworten und Verwaltungsseiten werden nicht
gecached. Die Kontaktseite funktioniert nach erfolgreicher erster Online-Installation
auch beim Start ohne Internet. Im Vite-Entwicklungsbetrieb gibt es keinen Service Worker.
Das lokale Behalten eines Gerätezugangs kann nie garantiert werden.
Für Kundenhandys wird später eine erreichbare HTTPS-Adresse benötigt.

## Daten, Backups und bestehende App

- Kunden, Termine und Aufgaben: bisheriger Supabase-Workspace, ausschließlich für
  das freigegebene Verwaltungskonto lesbar und schreibbar.
- Portalzugänge: nicht öffentlich zugängliche Tabellen im Schema `technik_private`.
- Anfragen: separate Tabelle `technik_requests`, nur vom Eigentümer als Admin lesbar.
- Alte JSON-Backups lassen sich in der Verwaltung weiter importieren. Der lokale
  Browserbestand wird nicht automatisch in Supabase hochgeladen.
- Das normale App-Backup enthält Kunden, Termine und Aufgaben. **Portalzugänge und
  Anfragen sind darin nicht enthalten.** „Anfragen exportieren“ exportiert die aktuell
  geladenen Anfragen (alle aktiven und bis zu 200 erledigte), keine Geräteschlüssel.
  Für eine vollständige Sicherung einschließlich älterer Anfragen ist ein
  Datenbank-Backup im Supabase-Projekt erforderlich.
- Datenbestand nach Möglichkeit vor der Einrichtung der Kundenhandys importieren.
  Ein vollständig anderer importierter Kundenbestand kann bisherige numerische
  Kunden-IDs wiederverwenden; bestehende Portalzugänge vorher sperren und neu einrichten.
- Keine Kundendaten oder Backup-Dateien in dieses öffentliche Repository hochladen.

## Design und Code

- `public/styles/interface.css`: helles Design, große Bedienelemente und Animationen.
- `src/controls.js`: eigene Dropdowns, Kalender, Zeit-/Zahlenfelder und Bestätigungen.
- `src/main.js`: Routing, Verwaltungslogin, Berechtigungsprüfung und Passwort-Reset.
- `src/customer.js`: Kundenansicht, Codes, Hilfeknopf und Offline-Hinweis.
- `src/portal-api.js`: Aufrufe der begrenzten Supabase-Funktionen.
- `public/portal-admin.js`: Anfragen und Einrichtungscodes in der Verwaltung.
- `public/ui.js`: Kalender, Kunden, Aufgaben, Finanzen und Offlinekarte.
- `public/map/`: Berliner OpenStreetMap/Protomaps-Karte, ca. 83 MB, Datenzoom 0–15.
  Offline-Adresssuche und Offline-Routenberechnung sind nicht enthalten.

## Noch kein Vercel-Deployment

`vercel.json` enthält weiterhin `git.deploymentEnabled: false`.
Die Route `/admin` ist vorbereitet. Ein Push startet kein automatisches Deployment.

```bash
npm test
npm run build
```

Diese Befehle laufen lokal und veröffentlichen nichts. Die aktuellen Portaländerungen
wurden auf Wunsch ohne Testlauf, Build oder Vorschauprüfung übernommen. Die SQL-Migration
wurde hier nicht auf ein Supabase-Projekt angewendet.
