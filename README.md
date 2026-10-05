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
- «Kurse aktualisieren» holt für alle Kandidaten den aktuellen Kurs.
- Oben Suche und Filter nach Sektor und Region.

## Hinweise

- Kursdaten kommen von Yahoo Finance (inoffizielle Schnittstelle, ohne Gewähr,
  Kurse ggf. verzögert). Schweizer Titel haben das Kürzel `.SW` (z. B. `NESN.SW`).
- Bei ETFs gibt es meist kein Land/keinen Sektor; Sektor wird dann «ETF».
- Lokal starten: `npm install`, dann `DATABASE_URL=… npm start`.
