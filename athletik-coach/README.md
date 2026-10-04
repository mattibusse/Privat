# Athletik Coach

Lokale Web-App (Next.js 16, Tailwind 4, Recharts) für den Hybrid-Trainingsplan. Fachliche Regeln: siehe `CLAUDE.md`.

## Starten

```bash
npm install
npm run dev        # http://localhost:3000
```

Die App liest und schreibt die JSON-Dateien in `data/` (`plan.json`, `workouts.json`, `runs.json`, `bodyweight.json`).
Diese Dateien sind per `.gitignore` vom Repo ausgeschlossen, weil sie persönliche Körper- und Trainingsdaten enthalten. Lege deinen `data/`-Ordner selbst in dieses Verzeichnis.

## Funktionen

**Heute** (`/`)
- Geplante Einheit laut `week_structure`, Blockwoche, Wochenübersicht mit Soll und Ist inklusive Padel
- Laufkarte mit Intervallstruktur, Pace-Zielen und HF-Obergrenze, erledigte Läufe mit Coach-Urteil
- Checkliste für Upper A, Lower, Upper B: Zielgewicht, Ziel-Wdh., RIR, Eingabe pro Satz, Pausentimer nach jedem abgehakten Satz
- Live-Auswertung pro Übung und Progressionsempfehlung für die Folgewoche
- Speichern schreibt die Einheit nach `data/workouts.json` (Eintrag mit `"source": "app"`); ein Entwurf bleibt bis dahin im Browser
- Testen mit anderem Datum: `/?datum=2026-10-05&einheit=upper_a`

**Fortschritt** (`/fortschritt`)
- Körpergewicht: Wochenschnitt als Linie, Tageswerte nur als Kontext, Entscheidungsregel 11.10.
- Laufpace (Zone 2, Arbeitspace Intervalle, Wettkampf) und „Pace bei gleicher HF“ als Meter pro Herzschlag

## Umsetzung der Regeln (`src/lib/coach.ts`)

| Regel | Umsetzung |
|---|---|
| Double Progression | Erhöhen nur, wenn alle geplanten Sätze am oberen Ende sind, Gewicht konstant und RIR nicht unter Ziel (bei Isolation darf der letzte Satz RIR 0-1 sein). Kniebeuge/RDL +5 kg, Schrägbank/Curls +2,5 kg, sonst „nächste Stufe“ am Gerät |
| Absenken | Zwei Einheiten in Folge am selben Gewicht, Mehrheit der Sätze unter dem unteren Ende: kleinste Stufe zwischen 5 und 10 % runter |
| Konstantes Gewicht | Erhöhung von Satz zu Satz = Fehler, Senkung = Warnung; keine Progression, nächste Einheit mit dem Zielgewicht konstant |
| RIR | Satz 1 unter RIR 2, Grundübung unter Ziel-RIR, Isolationsübung mit RIR 0-1 vor dem letzten Satz: Warnung |
| Einbrüche | mehr als 2 Wdh. von Satz zu Satz, oder Gesamtabfall ab 4 Wdh. (Muster 10/8/6) |
| Gerätespezifisch | Vergleich nur bei exakt gleichem Übungsnamen in derselben Einheit; „Gerät ändern“ speichert unter neuem Namen |
| Plan-Stand | Zielgewichte starten bei `plan.json` (Stand `block.as_of`), neuere Einheiten werden mit den Regeln fortgeschrieben |
| Volumenwochen / Deload | Upper A in den Bump-Wochen mit 4 Sätzen; Deload-Woche 2 Sätze, RIR 3-4, Gewicht halten |
| Mindestabstände | Warnung bei Lower vor Intervallen, Upper A vor Upper B, Padel vor Lower (tagesgenau, keine Uhrzeiten) |
