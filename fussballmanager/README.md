# Steilpass – Fußballmanager fürs Handy

Ein Fußballmanager im Geiste von **Anstoß 2** – für 1 bis 4 Freunde, direkt im Handy-Browser.
Keine Installation, kein Server, keine Anmeldung. Alle Vereine und Spieler sind frei erfunden.

**Spielen:** https://bex7-hessen.github.io/Pop-In-Hessen/fussballmanager/
(Im Browser „Zum Startbildschirm hinzufügen“ → läuft wie eine App, auch offline.)

## Features
- 2 Ligen mit je 18 Vereinen, 34 Spieltage, Auf- und Abstieg (3 Plätze)
- Live-Konferenz mit Ticker (Tore, Chancen, Karten, Verletzungen, Wechsel)
- Aufstellung auf dem Spielfeld, 6 Formationen, Einsatz (normal/hart/brutal) und Ausrichtung
- Training (Regeneration, Ausgewogen, Knochenhart, Taktik), Spielerentwicklung, Alterung, Jugendspieler
- Transfermarkt: Ablöse verhandeln, Spieler anbieten, sofort verkaufen, Verträge verlängern, Vereinslose
- Finanzen: Eintrittspreis, Zuschauer, TV, Sponsor, Gehälter, Prämien, Stadionausbau
- Vorstand mit Saisonziel – wer versagt, fliegt (und landet bei einem Zweitligisten)
- Anstoß-typische Zufallsereignisse: Golfunfall, Disco-Eskapaden, Wunderheiler, Maulwurf im Stadion …

## Mit Freunden spielen
- **Ein Handy (Hotseat):** Nach jedem Zug wird das Handy weitergereicht. Wenn alle fertig sind, läuft der Spieltag.
- **Mehrere Handys (Fernspiel):** Nach deinem Zug „Spielstand senden“ (z. B. per WhatsApp) an den nächsten Manager.
  Der öffnet Steilpass → „Spielstand laden“, macht seinen Zug und schickt weiter. Der letzte startet den Spieltag.

## Technik
Reines HTML/CSS/JavaScript ohne Abhängigkeiten. `js/engine.js` enthält die komplette Spiellogik
(läuft auch unter Node), `js/ui.js` die Oberfläche. Spielstand liegt im `localStorage`.
