# Candidates – Investment-Ideen erfassen

Kleine Web-App für den iPhone-Home-Bildschirm. Du gibst Name oder Ticker ein,
die App holt Kurs, Sektor, Land und Region automatisch. Zu jedem Kandidaten
kannst du Notizen und beliebig viele Artikel-Links hinterlegen.

## Einrichten (gleicher Weg wie beim Asset Tracker)

1. **GitHub:** neues Repository (z. B. `kandidaten`) anlegen und alle Dateien
   dieses Ordners hochladen (ohne `node_modules`).
2. **Neon:** neues Projekt bzw. neue Datenbank anlegen und den
   Connection-String kopieren (beginnt mit `postgresql://`).
3. **Railway:** «New Project» → «Deploy from GitHub repo» → `kandidaten` wählen.
   Unter «Variables» setzen:
   - `DATABASE_URL` = Connection-String aus Neon
   - `ACCESS_CODE` = frei gewählter Code (schützt die App vor fremdem Zugriff)
4. Unter «Settings → Networking» eine öffentliche Domain erzeugen.
5. **iPhone:** Domain in Safari öffnen → Teilen-Symbol → «Zum Home-Bildschirm».
   Beim ersten Start einmal den Zugangscode eingeben.

Die Tabelle wird beim ersten Start automatisch angelegt.

## Bedienung

- **+** unten rechts: Name oder Ticker tippen, Treffer wählen → Kurs, Sektor,
  Land und Region werden gefüllt (jederzeit von Hand änderbar).
- Artikel-Links mit «+ Link hinzufügen» erfassen, optional mit Titel.
- Der Kurs beim Erfassen wird als **Erfassungskurs** fix gespeichert und nie überschrieben.
- Die Kurse werden automatisch aktualisiert, sobald du die App öffnest oder wieder in den Vordergrund holst (höchstens alle 2 Minuten).
- «Kurse aktualisieren» holt den aktuellen Kurs und zeigt die Veränderung seit der Erfassung.
- **Dashboard** (Standardansicht): Liste mit Datum, Erfassungskurs, aktuellem Kurs und Veränderung in %. Tippen auf einen Eintrag öffnet die Details. Umschalten auf «Details» möglich, Sortierung nach Datum, Performance oder Name.
- **Investment erfassen:** In den Details (Eintrag im Dashboard antippen, oder Ansicht «Details») auf «Investment erfassen». Eingabe: Art (Kauf Titel, Kauf Option, Verkauf Option, Andere), Datum, Anzahl, Preis, optional Details (z. B. Strike/Verfall) und die **Begründung** (Pflicht). Der Zeitpunkt der ersten Erfassung der Begründung wird fix gespeichert.
- Im Dashboard sind getätigte Investments grün markiert (mit Art und Datum). Filter «Investiert» / «Nur beobachtet».
- Oben Suche und Filter nach Sektor und Region.
## Marktsicht (neu in Version 2, Prototyp)

Zweiter Bereich unten in der Tab-Leiste. Hier hältst du deine allgemeinen Markteinschätzungen fest:

- **Taktisch (1–3 Monate):** Eine Haltung zum Gesamtmarkt (Abwarten, Selektiv investieren, Investieren, Risiko reduzieren) mit Gültigkeitsdauer, z. B. «Abwarten bis in 4 Wochen». Dazu optionale kurzfristige Über-/Untergewichtungen von Region, Land oder Sektor.
- **Strategisch (12+ Monate):** Übergewichten, Neutral oder Untergewichten von Region, Land oder Sektor, z. B. «Schweiz übergewichten, Technologie untergewichten».
- Jede Einschätzung braucht eine **Begründung**. Eine neue Einschätzung zum gleichen Gegenstand ersetzt die alte, die alte bleibt im **Verlauf** erhalten.
- Abgelaufene Einschätzungen werden als «Überprüfung fällig» markiert.
- Auf der Candidates-Seite zeigt ein Banner die aktuelle taktische Haltung. In den Details eines Candidates und beim Erfassen eines Investments steht ein **Abgleich** mit den passenden Einschätzungen (Gesamtmarkt, Sektor, Land, Region).
- Technisch: eigene Tabelle `market_views` und eigene Datei `public/views.js`. Die Candidates-Daten werden nicht verändert.

## Zurück zur stabilen Version 1

Die Version ohne Marktsicht liegt als `candidates-v1-stable.zip` vor. Da Version 2 nur neue Tabellen anlegt, funktioniert Version 1 mit der gleichen Datenbank weiter. Die Marktsicht-Daten bleiben dabei erhalten und sind wieder da, sobald Version 2 läuft.


## Hinweise

- Kursdaten kommen von Yahoo Finance (inoffizielle Schnittstelle, ohne Gewähr,
  Kurse ggf. verzögert). Schweizer Titel haben das Kürzel `.SW` (z. B. `NESN.SW`).
- Bei ETFs gibt es meist kein Land/keinen Sektor; Sektor wird dann «ETF».
- Lokal starten: `npm install`, dann `DATABASE_URL=… npm start`.
