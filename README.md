# Kandidaten – Investment-Ideen erfassen

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
- **Dashboard** (Standardansicht): Liste mit Datum, Erfassungskurs, aktuellem Kurs und Veränderung in %. Tippen auf einen Eintrag öffnet die Details. Umschalten auf «Karten» möglich, Sortierung nach Datum, Performance oder Name.
- Oben Suche und Filter nach Sektor und Region.

## Hinweise

- Kursdaten kommen von Yahoo Finance (inoffizielle Schnittstelle, ohne Gewähr,
  Kurse ggf. verzögert). Schweizer Titel haben das Kürzel `.SW` (z. B. `NESN.SW`).
- Bei ETFs gibt es meist kein Land/keinen Sektor; Sektor wird dann «ETF».
- Lokal starten: `npm install`, dann `DATABASE_URL=… npm start`.
