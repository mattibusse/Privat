# Athletik Coach – Kontext für Claude Code

Dieses Repo enthält die Trainingsdaten von Matti (21, 194 cm, Hybrid-Training: Kraft + Laufen + Padel).
Ziel des Projekts: eine eigene Oberfläche (Web-App), in der Trainingspläne angezeigt, Einheiten geloggt und Fortschritte ausgewertet werden.

## Datenquellen

| Datei | Inhalt |
|---|---|
| `data/profile.json` | Stammdaten, Körperwerte, Ziele, Rahmenbedingungen |
| `data/plan.json` | Trainingsplan: Split, Übungen, Gewichte, Progressionsregeln, Laufplan, Ernährung |
| `data/workouts.json` | Protokollierte Krafteinheiten seit 21.09.2026 |
| `data/runs.json` | Läufe und Padel mit Pace, HF, Bewertung |
| `data/bodyweight.json` | Gewichtsverlauf und Ernährungs-Adhärenz |

Alle Gewichte in kg, Paces als `mm:ss` pro km, HF in bpm, Datumsformat ISO (`YYYY-MM-DD`).

## Fachliche Regeln, die die App abbilden muss

1. **Double Progression**: Gewicht wird erst erhöht, wenn ALLE Sätze das obere Ende des Wiederholungsbereichs beim Ziel-RIR erreichen. Schritte: Kniebeuge/RDL +5 kg, Schrägbank/Curls +2,5 kg, Maschinen eine Stufe.
2. **Konstantes Gewicht innerhalb einer Einheit.** Eine Erhöhung von Satz zu Satz ist ein Fehler und soll in der Auswertung markiert werden.
3. **RIR-Steuerung**: Satz 1 bei RIR 2 beenden. Nur der letzte Satz einer Isolationsübung darf RIR 0-1 erreichen. Zielmuster 10/10/9, Warnmuster 10/8/6.
4. **Maschinengewichte sind studiospezifisch.** Nur Werte am selben Gerät vergleichen.
5. **BIA-Werte und Wochengewichte** nur als Trend über Wochen bewerten, niemals Einzelwerte.
6. **Mindestabstände** zwischen Einheiten siehe `plan.json` → `min_gaps_hours`.

## Sinnvolle Features für die Oberfläche

- Heutige Einheit als Checkliste mit Zielgewicht, Ziel-Wdh., RIR, Pausentimer
- Eingabe pro Satz (Gewicht, Wdh., RIR) und automatische Progressionsempfehlung für die Folgewoche
- Warnung, wenn Wiederholungen von Satz zu Satz um mehr als 2 einbrechen
- Laufansicht mit Intervallstruktur, Pace-Zielen und HF-Obergrenze
- Charts: Gewichtsverlauf mit Wochenschnitt, Volumen je Muskelgruppe, Pace bei gleicher HF über Zeit
- Wochenübersicht mit Plan-Soll und Ist, inklusive Padel als Zusatzbelastung

## Hinweise

- Die Daten sind manuell aus einem Coaching-Chat extrahiert. Einzelne Felder sind unvollständig (`null`, Feld `gaps`, Felder `note`).
- Garmin-Daten liegen nicht per API vor. Ein Import über .fit- oder .tcx-Export oder manuelle Eingabe ist einzuplanen.
- Sprache der Oberfläche: Deutsch.

@AGENTS.md
