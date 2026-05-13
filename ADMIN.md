# Pop in Hessen – Admin-Dashboard

## Erreichbarkeit

| Umgebung | URL |
|---|---|
| Live (GitHub Pages) | https://bex7-hessen.github.io/Pop-In-Hessen/admin/ |
| Lokal (Entwicklung) | Datei direkt im Browser öffnen (fetch schlägt fehl, da kein Server) |

---

## Erster Login – GitHub Token erstellen

Das Dashboard verwendet einen **GitHub Personal Access Token (PAT)** zur Authentifizierung. Der Token wird nie gespeichert (nur im `sessionStorage` des Browsers – wird beim Schließen des Tabs gelöscht).

**Token erstellen:**
1. GitHub öffnen → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. **Generate new token**
3. Token-Name: z. B. `Pop-in-Hessen Admin`
4. Expiration: nach Wunsch (z. B. 90 Tage)
5. Repository access: **Only selected repositories** → `Bex7-Hessen/Pop-In-Hessen`
6. Repository permissions → **Contents**: `Read and Write`
7. Token kopieren und im Dashboard eingeben

---

## Inhalte bearbeiten

### News / Aktuelles

- **Liste:** Alle News-Einträge mit Reihenfolge, Kategorie, Datum, Titel und Status
- **Neu anlegen:** Button „+ Neuer Eintrag" → Formular ausfüllen → Speichern
- **Bearbeiten:** Zeile → „Bearbeiten" → Formular anpassen → Speichern
- **Löschen:** Zeile → „Löschen" → Bestätigen
- **Reihenfolge:** Zahl in der ersten Spalte ändern → anschließend Seite speichern (über beliebigen Bearbeiten-Dialog erneut speichern, oder direkt GitHub committen)
- **Status:** `Veröffentlicht` erscheint auf der Website · `Entwurf` wird ausgeblendet

**Felder:**
| Feld | Pflicht | Beschreibung |
|---|---|---|
| Titel | ✅ | Überschrift der Karte |
| Kategorie | ✅ | Netzwerk, Veranstaltung, Künstler\*in, Förderung |
| Datum | ✅ | Freitext, z. B. „16. Juni 2026" oder „2026" |
| Kurztext | ✅ | 1–2 Sätze für die Karte |
| Volltext | – | HTML-Text für das Modal (leer = kein „Mehr lesen"-Button) |
| Bild-URL | – | URL zu einem Bild (leer = Platzhalter) |
| Reihenfolge | – | Zahl, kleinere Zahl = weiter vorne |
| Status | ✅ | Veröffentlicht oder Entwurf |

### Angebot

- 3 Karten (Beratung, Workshopreihe, Förderung) – Text und Buttons bearbeitbar
- Neue Karten anlegen und ausblenden möglich

### Einstellungen

- **Kontakt-E-Mail:** wird auf der Website angezeigt und als `mailto:`-Link verwendet
- **CTA-Button:** Text und Ziel-URL des „Mitmachen"-Buttons
- **Büro-Themenfelder:** Ein Thema pro Zeile, wird als Aufzählung angezeigt

---

## Content-Dateien

Alle Inhalte liegen als JSON im Repo:

```
content/
  news.json      ← News-Einträge (Array)
  angebot.json   ← Angebot-Karten (Array)
  settings.json  ← Kontakt, Büro-Texte
```

Änderungen über das Dashboard → direkter Git-Commit → GitHub Pages deployed automatisch (~30–60 Sekunden).

---

## Neuen Content-Typ ergänzen

1. Neue JSON-Datei in `content/` anlegen (z. B. `content/partner.json`)
2. In `admin/index.html` eine neue Seite und Tabelle hinzufügen (analog zu News)
3. In `index.html` eine `renderPartner()`-Funktion im Content-Loader ergänzen

---

## Deployment (manuell / Entwicklung)

```bash
# Repo klonen
git clone https://github.com/Bex7-Hessen/Pop-In-Hessen.git _temp
cp website-mockup.html _temp/index.html
cd _temp
git add .
git commit -m "Update"
git push
cd .. && rm -rf _temp
```

GitHub Pages deployed automatisch aus dem `main`-Branch (Root-Verzeichnis).

---

## Sicherheit

- Token nie in Code oder Repo einchecken
- Token-Scope: nur `Contents: Read & Write` für dieses Repo – kein Zugriff auf andere Repos oder Account-Einstellungen
- Token in `sessionStorage` → gelöscht beim Schließen des Browser-Tabs
- `/admin/` ist öffentlich erreichbar, aber ohne gültigen Token ist kein Schreiben möglich

---

## Bekannte Einschränkungen der ersten Version

- **Keine Medienverwaltung:** Bilder müssen manuell als URL angegeben werden (oder Platzhalter)
- **Keine Vorschau:** Änderungen sind erst nach GitHub-Deployment (~60 s) live sichtbar
- **Büro-Themen nur textuell:** Stats (Zahlen) und Träger-Logos sind noch nicht editierbar
- **Kein Rich-Text-Editor:** Volltext muss als HTML eingegeben werden

---

## Umgebungsvariablen

Keine. Das Dashboard verwendet keine Umgebungsvariablen – Auth ausschließlich über GitHub PAT im Browser.
