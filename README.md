# Technikcheck / Technikplan

Kunden, Termine, Aufgaben und Einnahmen für deine eigene Technikberatung.
Die Berliner Offline-Karte ist vollständig enthalten (rund 83 MB Kartendaten).

## Lokal starten

Node.js ab 22.12 ist erforderlich.

```bash
npm install
npm run dev
```

Danach **http://localhost:5173** öffnen. Der Entwicklungsserver lauscht nur auf
diesem Computer. Kein Vercel-Befehl und kein Python-Starter erforderlich.

Ohne Supabase-Konfiguration startet automatisch ein lokaler Testmodus.
Die Daten liegen dann ausschließlich im IndexedDB-Speicher dieses Browsers.
Regelmäßig Backup exportieren. Löschen von Browserdaten kann diese Daten entfernen.
`localhost` und `127.0.0.1` haben getrennte Browserspeicher: immer dieselbe URL nutzen.

## Supabase verbinden

1. Im neuen Supabase-Projekt die Datei
   `supabase/migrations/202611210001_technikplan.sql` im SQL Editor ausführen.
2. `.env.example` nach `.env.local` kopieren.
3. Projekt-URL und öffentlichen Publishable Key eintragen:

```dotenv
VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=DEIN_OEFFENTLICHER_PUBLISHABLE_KEY
```

Keinen `service_role`- oder `sb_secret_`-Schlüssel verwenden. `.env.local` ist von
Git ausgeschlossen. Ein alter öffentlicher Anon-Key ist ebenfalls kompatibel.

4. Im Supabase Auth-Bereich für den lokalen Test die Site URL und erlaubte
   Redirect URL auf `http://localhost:5173` setzen. E-Mail/Passwort aktivieren.
5. `npm run dev` neu starten und ein Konto erstellen/anmelden.

Die Migration aktiviert Row Level Security. Jedes angemeldete Konto kann nur
seinen eigenen Datenbestand lesen und ändern. Ein Revisionsvergleich verhindert,
dass gleichzeitige Schreibvorgänge verschiedener Geräte blind überschrieben werden.
Nach Anmeldung werden die Daten direkt in Supabase gespeichert. Bei fehlender
Verbindung wird ein Fehler gezeigt; Änderungen werden nicht als gespeichert ausgegeben.
Offline-Änderungen mit späterer automatischer Synchronisierung sind noch nicht enthalten.

Der lokale Testmodus wird nicht automatisch in Supabase hochgeladen. Für den
Wechsel zuerst Backup exportieren, anschließend angemeldet das Backup importieren.

## Bisherige Daten übernehmen

Die bisherige Python-App öffnen, „Backup herunterladen“ verwenden und die JSON-Datei
in der neuen App unter „Backup wiederherstellen“ importieren. Die originale
`technikplan.sqlite3` bleibt unverändert. Backup-Dateien und Kundendaten niemals
in dieses öffentliche GitHub-Repository hochladen.

## Design bearbeiten

- `index.html`: HTML-Grundstruktur.
- `public/styles/interface.css`: helles Design und Animationen.
- `src/controls.js`: eigene Dropdowns, Kalender, Uhrzeit, Zahlenfelder und Dialoge.
- `public/ui.js`: bestehende Ansichten, Formulare und Kartenbedienung.
- `src/main.js`: Start und Anmeldung.
- `src/storage.js`: lokaler Speicher und Supabase-Anbindung.
- `src/model.js`: Datenprüfung und Änderungen.
- `public/map/`: Berliner Offline-Karte, Schrift, Symbole und Kartenstil.

## Vercel ist derzeit deaktiviert

`vercel.json` enthält `git.deploymentEnabled: false`. Pushes lösen deshalb keine
automatischen Vercel-Deployments aus. Es ist kein Deployment-Workflow enthalten.
Erst bei einer später bewusst vorgenommenen Freigabe diese Einstellung ändern.

```bash
npm test
npm run build
```

Der lokale Produktionsbuild landet in `dist/`. Auch das deployt nichts.

## Karte und Grenzen

OpenStreetMap/Protomaps-Ausschnitt Berlin, Build 2026-11-18, Zoomdaten 0–15,
Anzeige bis Zoom 18. Alle Ressourcen werden lokal geladen. Kundenpunkte setzt du
per Klick. Externe Routenlinks benötigen Internet. Offline-Adresssuche und
Offline-Routenberechnung sind nicht enthalten. Lizenzen: `public/licenses/`.

Die Finanzübersicht ist eine Einsatzübersicht und ersetzt keine Buchhaltung.
