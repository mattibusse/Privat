// Fachlogik nach CLAUDE.md: Double Progression, konstantes Gewicht, RIR-Steuerung,
// geraetespezifischer Vergleich, Mindestabstaende. Reine Funktionen, laufen auf Server und Client.
import type {
  LoggedSet,
  Plan,
  PlanExercise,
  Run,
  SessionKey,
  StrengthSession,
  Workout,
} from "./types";

// ---------- Datum ----------

const DAY_MS = 86_400_000;
export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * DAY_MS));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS);
}

/** 0 = Montag ... 6 = Sonntag */
export function weekdayIndex(iso: string): number {
  return (parseISO(iso).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function formatDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.split("-");
  return withYear ? `${d}.${m}.${y}` : `${d}.${m}.`;
}

/** Blockwoche: Woche 0 ist die Teilwoche des Blockstarts, danach ab Montag gezaehlt. */
export function blockWeek(plan: Plan, iso: string): number {
  return Math.floor(daysBetween(mondayOf(plan.block.start), mondayOf(iso)) / 7);
}

export function plannedSession(plan: Plan, iso: string): SessionKey {
  return plan.week_structure[weekdayIndex(iso)].session;
}

export const SESSION_LABELS: Record<SessionKey, string> = {
  upper_a: "Upper A (schwer)",
  lower: "Lower",
  upper_b: "Upper B (Volumen)",
  rest_or_padel: "Pause oder Padel",
  run_intervals: "Intervalllauf",
  run_zone2: "Zone-2-Lauf",
};

export function isStrength(s: SessionKey): s is StrengthSession {
  return s === "upper_a" || s === "lower" || s === "upper_b";
}

// ---------- Uebungen ----------

export type ExerciseKind = "compound" | "isolation";

export function exerciseKind(name: string): ExerciseKind {
  const n = name.toLowerCase();
  if (/waden/.test(n)) return "isolation";
  if (/schraegbank|rudern|latzug|kniebeuge|rdl|beinpresse/.test(n)) return "compound";
  return "isolation";
}

export type Increment =
  | { type: "kg"; step: number }
  | { type: "machine" }
  | { type: "bodyweight" };

export function increment(name: string, weight: number): Increment {
  const n = name.toLowerCase();
  if (weight === 0) return { type: "bodyweight" };
  if (/kniebeuge|rdl/.test(n)) return { type: "kg", step: 5 };
  if (/schraegbank|curls/.test(n)) return { type: "kg", step: 2.5 };
  return { type: "machine" };
}

/** Plan-Uebung fuer eine konkrete Woche: Volumen-Bump in Upper A, Deload-Woche. */
export function effectiveExercise(
  plan: Plan,
  session: StrengthSession,
  ex: PlanExercise,
  week: number,
): PlanExercise & { bumped: boolean; deload: boolean } {
  if (week === plan.deload.week) {
    return { ...ex, sets: 2, rir: 3, bumped: false, deload: true };
  }
  const bumped =
    session === "upper_a" &&
    plan.progression.volume_bump_weeks.includes(week) &&
    /schraegbank|latzug|rudern|seitheben/i.test(ex.name);
  return { ...ex, sets: bumped ? 4 : ex.sets, bumped, deload: false };
}

// ---------- Auswertung einer Uebung ----------

export type IssueLevel = "error" | "warn" | "info";
export interface Issue {
  level: IssueLevel;
  text: string;
}

export interface Analysis {
  working: LoggedSet[];
  issues: Issue[];
  constant: boolean;
  weight: number | null;
  complete: boolean;
  topReached: boolean;
  belowLower: boolean;
}

const fmt = (n: number) => n.toLocaleString("de-DE");

export function analyzeExercise(ex: PlanExercise & { deload?: boolean }, sets: LoggedSet[]): Analysis {
  const working = sets.filter((s) => !s.warmup && s.reps != null && s.kg != null);
  const issues: Issue[] = [];
  const [lo, hi] = ex.reps;
  const kind = exerciseKind(ex.name);

  if (working.length === 0) {
    return { working, issues, constant: true, weight: null, complete: false, topReached: false, belowLower: false };
  }

  // Regel 2: konstantes Gewicht
  let constant = true;
  for (let i = 1; i < working.length; i++) {
    const a = working[i - 1].kg!;
    const b = working[i].kg!;
    if (b > a) {
      constant = false;
      issues.push({ level: "error", text: `Gewicht von Satz ${i} auf ${i + 1} erhöht (${fmt(a)} → ${fmt(b)} kg). Gewicht bleibt innerhalb der Einheit konstant.` });
    } else if (b < a) {
      constant = false;
      issues.push({ level: "warn", text: `Gewicht in Satz ${i + 1} gesenkt (${fmt(a)} → ${fmt(b)} kg). Nicht konstant, Progression nicht bewertbar.` });
    }
  }

  // Einbrueche bei den Wiederholungen
  let bigDrop = false;
  for (let i = 1; i < working.length; i++) {
    const drop = working[i - 1].reps! - working[i].reps!;
    if (drop > 2) {
      bigDrop = true;
      issues.push({ level: "warn", text: `Einbruch von Satz ${i} auf ${i + 1}: ${working[i - 1].reps} → ${working[i].reps} Wdh. (mehr als 2).` });
    }
  }
  const totalDrop = working[0].reps! - working[working.length - 1].reps!;
  if (!bigDrop && working.length >= 3 && totalDrop >= 4) {
    issues.push({ level: "warn", text: `Warnmuster wie 10/8/6 (${working.map((s) => s.reps).join("/")}). Satz 1 früher beenden, Ziel ist 10/10/9.` });
  }

  // Regel 3: RIR-Steuerung (Deload hat RIR 3-4, dort nur Untergrenze pruefen)
  const rirMissing = working.some((s) => s.rir == null);
  working.forEach((s, i) => {
    if (s.rir == null) return;
    const last = i === working.length - 1;
    if (ex.deload) {
      if (s.rir < 3) issues.push({ level: "warn", text: `Deload: Satz ${i + 1} bei RIR ${fmt(s.rir)}, Ziel RIR 3-4.` });
      return;
    }
    if (i === 0 && s.rir < 2) {
      issues.push({ level: "warn", text: `Satz 1 bei RIR ${fmt(s.rir)}. Satz 1 bei RIR 2 beenden.` });
      return;
    }
    if (kind === "compound" && s.rir < ex.rir) {
      issues.push({ level: "warn", text: `Satz ${i + 1} bei RIR ${fmt(s.rir)}, Ziel-RIR ${fmt(ex.rir)}. Grundübungen nicht bis RIR 0-1.` });
    } else if (kind === "isolation" && !last && s.rir <= 1) {
      issues.push({ level: "warn", text: `Satz ${i + 1} bei RIR ${fmt(s.rir)}. Nur der letzte Satz einer Isolationsübung darf RIR 0-1 erreichen.` });
    }
  });
  if (rirMissing) issues.push({ level: "info", text: "RIR nicht in jedem Satz erfasst. Progression wird nur über Wdh. bewertet." });

  const complete = working.length >= ex.sets;
  if (!complete) issues.push({ level: "info", text: `${working.length} von ${ex.sets} Arbeitssätzen erfasst.` });

  const rirOk = working.every((s, i) => {
    if (s.rir == null) return true;
    const last = i === working.length - 1;
    return kind === "isolation" && last ? true : s.rir >= ex.rir;
  });
  const topReached = complete && constant && working.every((s) => s.reps! >= hi) && rirOk;
  const below = working.filter((s) => s.reps! < lo).length;
  const belowLower = below > working.length / 2;

  return { working, issues, constant, weight: working[0].kg, complete, topReached, belowLower };
}

// ---------- Progressionsempfehlung ----------

export type Action = "increase" | "hold" | "decrease" | "fix" | "none";

export interface Recommendation {
  action: Action;
  headline: string;
  reason: string;
  /** Zahl fuer die naechste Einheit; bei Maschinen-Stufe das alte Gewicht plus stepUp-Flag */
  nextWeight: number | null;
  stepUp: boolean;
}

function roundDown(x: number, step: number) {
  return Math.floor(x / step + 1e-9) * step;
}

export function recommend(
  ex: PlanExercise & { deload?: boolean },
  a: Analysis,
  prev: Analysis | null,
  currentTarget: number,
): Recommendation {
  const [lo, hi] = ex.reps;
  if (a.working.length === 0) {
    return { action: "none", headline: "Noch keine Sätze", reason: "Sätze eintragen, dann erscheint die Empfehlung.", nextWeight: null, stepUp: false };
  }
  if (!a.constant) {
    return {
      action: "fix",
      headline: `${fmt(currentTarget)} kg, alle Sätze gleich`,
      reason: "Gewicht war nicht konstant. Erst eine saubere Einheit mit gleichem Gewicht, dann wird bewertet.",
      nextWeight: currentTarget,
      stepUp: false,
    };
  }
  const w = a.weight!;
  if (ex.deload) {
    return { action: "hold", headline: `${fmt(w)} kg halten`, reason: "Deload-Woche: gleiche Gewichte, keine Progression.", nextWeight: w, stepUp: false };
  }
  const inc = increment(ex.name, w);
  if (a.topReached) {
    if (inc.type === "kg") {
      return { action: "increase", headline: `${fmt(w + inc.step)} kg (+${fmt(inc.step)})`, reason: `Alle Sätze bei ${hi} Wdh. am Ziel-RIR. Double Progression: erhöhen, wieder bei ${lo} Wdh. starten.`, nextWeight: w + inc.step, stepUp: false };
    }
    if (inc.type === "machine") {
      return { action: "increase", headline: `nächste Stufe über ${fmt(w)} kg`, reason: `Alle Sätze bei ${hi} Wdh. am Ziel-RIR. Am selben Gerät eine Stufe hoch.`, nextWeight: w, stepUp: true };
    }
    return { action: "increase", headline: "Zusatzgewicht oder langsameres Tempo", reason: `Alle Sätze bei ${hi} Wdh. erreicht.`, nextWeight: w, stepUp: false };
  }
  // "2 Einheiten in Folge" nur am selben Gewicht, sonst ist es keine Wiederholung
  if (a.belowLower && prev?.belowLower && prev.constant && prev.weight === w) {
    const step = inc.type === "kg" ? 2.5 : 0.5;
    // kleinste Absenkung, die mindestens 5 % betraegt und hoechstens 10 %
    let target = roundDown(w * 0.95, step);
    if (target < w * 0.9) target = Math.ceil((w * 0.9) / step - 1e-9) * step;
    const range = `${fmt(Math.ceil(w * 0.9 * 2) / 2)}-${fmt(Math.floor(w * 0.95 * 2) / 2)} kg`;
    return {
      action: "decrease",
      headline: inc.type === "machine" ? `auf ca. ${range} senken` : `${fmt(target)} kg`,
      reason: `Zwei Einheiten in Folge bei ${fmt(w)} kg unter ${lo} Wdh. Regel: 5-10 % runter.`,
      nextWeight: target,
      stepUp: false,
    };
  }
  const holdText = inc.type === "bodyweight" ? "Körpergewicht, Wdh. steigern" : `${fmt(w)} kg halten`;
  if (a.belowLower) {
    return { action: "hold", headline: holdText, reason: `Unter ${lo} Wdh. Bei der nächsten Einheit erneut darunter: 5-10 % runter.`, nextWeight: w, stepUp: false };
  }
  return {
    action: "hold",
    headline: holdText,
    reason: a.complete
      ? `Noch nicht alle Sätze bei ${hi} Wdh. am Ziel-RIR. Wiederholungen steigern.`
      : "Einheit unvollständig, Gewicht halten.",
    nextWeight: w,
    stepUp: false,
  };
}

// ---------- Historie (Regel 4: nur gleiches Geraet vergleichen) ----------

export interface HistoryEntry {
  date: string;
  sets: LoggedSet[];
  name: string;
  comparable: boolean;
}

function baseName(name: string) {
  return name.split(" ")[0].toLowerCase();
}

/** Letzter Eintrag derselben Einheit. Nicht vergleichbar, wenn Geraet/Variante abweicht. */
export function lastEntry(workouts: Workout[], session: StrengthSession, name: string, before: string): HistoryEntry | null {
  const sorted = workouts.filter((w) => w.session === session && w.date < before).sort((a, b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    const exact = w.exercises.find((e) => e.name === name);
    if (exact) return { date: w.date, sets: exact.sets, name: exact.name, comparable: true };
    const similar = w.exercises.find((e) => baseName(e.name) === baseName(name));
    if (similar) return { date: w.date, sets: similar.sets, name: similar.name, comparable: false };
  }
  return null;
}

export interface Target {
  weight: number;
  stepUp: boolean;
  source: "plan" | "log";
  from?: string;
}

/**
 * Zielgewicht fuer die naechste Einheit: Plangewicht (Stand block.as_of),
 * danach jede neuere Einheit am selben Geraet mit den Regeln fortgeschrieben.
 */
export function targetWeight(plan: Plan, workouts: Workout[], session: StrengthSession, ex: PlanExercise, before: string): Target {
  const logs = workouts
    .filter((w) => w.session === session && w.date > plan.block.as_of && w.date < before)
    .sort((a, b) => a.date.localeCompare(b.date));
  let t: Target = { weight: ex.weight_kg, stepUp: false, source: "plan" };
  let prev: Analysis | null = null;
  for (const w of logs) {
    const logged = w.exercises.find((e) => e.name === ex.name);
    if (!logged) continue;
    const eff = effectiveExercise(plan, session, ex, blockWeek(plan, w.date));
    const a = analyzeExercise(eff, logged.sets);
    const r = recommend(eff, a, prev, t.weight);
    if (r.nextWeight != null) t = { weight: r.nextWeight, stepUp: r.stepUp, source: "log", from: w.date };
    prev = a;
  }
  return t;
}

/** Vorherige Auswertung am selben Geraet, fuer die Regel "2 Einheiten in Folge". */
export function previousAnalysis(plan: Plan, workouts: Workout[], session: StrengthSession, ex: PlanExercise, before: string): Analysis | null {
  const e = lastEntry(workouts, session, ex.name, before);
  if (!e || !e.comparable) return null;
  return analyzeExercise(effectiveExercise(plan, session, ex, blockWeek(plan, e.date)), e.sets);
}

// ---------- Mindestabstaende (Regel 6) ----------

function lastDateOf(dates: string[], before: string): string | null {
  const d = dates.filter((x) => x < before).sort();
  return d.length ? d[d.length - 1] : null;
}

export function gapWarnings(plan: Plan, workouts: Workout[], runs: Run[], session: SessionKey, date: string): Issue[] {
  const g = plan.min_gaps_hours;
  const out: Issue[] = [];
  const check = (prevDate: string | null, hours: number, what: string) => {
    if (!prevDate) return;
    const h = daysBetween(prevDate, date) * 24;
    if (h < hours) out.push({ level: "warn", text: `${what} am ${formatDate(prevDate)}, nur ca. ${h} h Abstand. Mindestens ${hours} h.` });
  };
  const sessionDates = (s: StrengthSession) => workouts.filter((w) => w.session === s).map((w) => w.date);
  if (session === "run_intervals") check(lastDateOf(sessionDates("lower"), date), g.lower_to_intervals, "Lower");
  if (session === "upper_b") check(lastDateOf(sessionDates("upper_a"), date), g.upper_a_to_upper_b, "Upper A");
  if (session === "lower") check(lastDateOf(runs.filter((r) => r.type === "padel").map((r) => r.date), date), g.padel_before_lower, "Padel");
  return out;
}

// ---------- Laufen ----------

/** "4:30" -> 270 s; "ca. 4:25-4:30" -> Mittelwert; null wenn nicht lesbar */
export function paceToSec(p: string | undefined): number | null {
  if (!p) return null;
  const m = [...p.matchAll(/(\d+):(\d{2})/g)].map((x) => Number(x[1]) * 60 + Number(x[2]));
  if (m.length === 0) return null;
  return m.reduce((a, b) => a + b, 0) / m.length;
}

export function secToPace(s: number): string {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

/** Arbeits-Pace der Intervalle, nach Distanz gewichtet. */
export function intervalWorkPace(run: Run): number | null {
  const reps = (run.intervals ?? []).map((i) => ({ d: i.distance_km, p: paceToSec(i.pace) })).filter((x) => x.p != null);
  if (reps.length === 0) return null;
  const dist = reps.reduce((a, r) => a + r.d, 0);
  return reps.reduce((a, r) => a + r.p! * r.d, 0) / dist;
}

/** Meter pro Herzschlag: Pace normiert auf HF, hoeher = effizienter. */
export function metersPerBeat(paceSec: number, hr: number): number {
  return 60_000 / paceSec / hr;
}

// ---------- Koerpergewicht (Regel 5: nur Wochenschnitte) ----------

export interface WeekAvg {
  monday: string;
  avg: number;
  n: number;
}

export function weeklyAverages(entries: { date: string; weight: number }[]): WeekAvg[] {
  const map = new Map<string, number[]>();
  for (const e of entries) {
    const k = mondayOf(e.date);
    map.set(k, [...(map.get(k) ?? []), e.weight]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monday, ws]) => ({ monday, avg: ws.reduce((a, b) => a + b, 0) / ws.length, n: ws.length }));
}

/** ISO-Kalenderwoche */
export function isoWeek(iso: string): number {
  const d = parseISO(iso);
  const thursday = new Date(d.getTime() + (3 - weekdayIndex(iso)) * DAY_MS);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1;
}
