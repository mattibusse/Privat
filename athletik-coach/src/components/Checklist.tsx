"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeExercise,
  formatDate,
  recommend,
  type Action,
  type Analysis,
  type HistoryEntry,
  type Target,
} from "@/lib/coach";
import type { LoggedSet, PlanExercise, StrengthSession, Workout } from "@/lib/types";
import IssueList from "./IssueList";

export interface ChecklistExercise {
  plan: PlanExercise & { bumped: boolean; deload: boolean };
  target: Target;
  last: HistoryEntry | null;
  prev: Analysis | null;
}

interface SetRow {
  kg: string;
  reps: string;
  rir: string;
  done: boolean;
}
interface ExRow {
  name: string;
  sets: SetRow[];
}

const de = (n: number) => n.toLocaleString("de-DE");
const num = (s: string): number | null => {
  const t = s.replace(",", ".").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
// Zeitquelle ausserhalb der Komponente, nur in Event-Handlern und Effekten genutzt
const clock = () => Date.now();
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

function initialRows(exercises: ChecklistExercise[], logged: Workout | null): ExRow[] {
  return exercises.map((ex) => {
    const l = logged?.exercises.find((e) => e.name === ex.plan.name);
    if (l) {
      return {
        name: l.name,
        sets: l.sets.map((s) => ({ kg: s.kg == null ? "" : de(s.kg), reps: s.reps == null ? "" : String(s.reps), rir: s.rir == null ? "" : de(s.rir), done: true })),
      };
    }
    return {
      name: ex.plan.name,
      sets: Array.from({ length: ex.plan.sets }, () => ({ kg: de(ex.target.weight), reps: "", rir: "", done: false })),
    };
  });
}

function toLogged(row: ExRow): LoggedSet[] {
  return row.sets
    .map((s) => ({ kg: num(s.kg), reps: num(s.reps), rir: num(s.rir) }))
    .filter((s) => s.kg != null && s.reps != null)
    .map((s) => (s.rir == null ? { kg: s.kg, reps: s.reps } : s));
}

export default function Checklist(props: {
  date: string;
  session: StrengthSession;
  label: string;
  week: number;
  bumpNote: string;
  exercises: ChecklistExercise[];
  alreadyLogged: Workout | null;
}) {
  const { date, session, exercises, alreadyLogged } = props;
  const router = useRouter();
  const draftKey = `athletik-draft-${date}-${session}`;
  const [rows, setRows] = useState<ExRow[]>(() => initialRows(exercises, alreadyLogged));
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [timer, setTimer] = useState<{ end: number; total: number; label: string } | null>(null);
  const [now, setNow] = useState(clock);
  const beeped = useRef(false);

  // Entwurf aus dem Browser laden (nur Komfort, die Datei in data/ ist die Quelle)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw && !alreadyLogged) setRows(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, [draftKey, alreadyLogged]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(rows));
    } catch {}
  }, [rows, hydrated, draftKey]);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(clock()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const remaining = timer ? Math.max(0, (timer.end - now) / 1000) : 0;
  useEffect(() => {
    if (!timer || remaining > 0 || beeped.current) return;
    beeped.current = true;
    try {
      navigator.vibrate?.([200, 100, 200]);
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      o.frequency.value = 880;
      o.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.25);
    } catch {}
  }, [timer, remaining]);

  const evaluations = useMemo(
    () =>
      rows.map((row, i) => {
        const ex = exercises[i];
        const a = analyzeExercise(ex.plan, toLogged(row));
        return { a, r: recommend(ex.plan, a, ex.prev, ex.target.weight) };
      }),
    [rows, exercises],
  );

  const update = (ei: number, si: number, patch: Partial<SetRow>) =>
    setRows((rs) => rs.map((r, i) => (i !== ei ? r : { ...r, sets: r.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })));

  const toggleDone = (ei: number, si: number) => {
    const s = rows[ei].sets[si];
    const done = !s.done;
    update(ei, si, { done });
    const isLastOverall = ei === rows.length - 1 && si === rows[ei].sets.length - 1;
    if (done && !isLastOverall) {
      const rest = exercises[ei].plan.rest_s;
      beeped.current = false;
      const start = clock();
      setNow(start);
      setTimer({ end: start + rest * 1000, total: rest, label: `${rows[ei].name}, nach Satz ${si + 1}` });
    }
  };

  const addSet = (ei: number) =>
    setRows((rs) =>
      rs.map((r, i) => {
        if (i !== ei) return r;
        const last = r.sets[r.sets.length - 1];
        return { ...r, sets: [...r.sets, { kg: last?.kg ?? "", reps: "", rir: "", done: false }] };
      }),
    );
  const removeSet = (ei: number) => setRows((rs) => rs.map((r, i) => (i !== ei || r.sets.length <= 1 ? r : { ...r, sets: r.sets.slice(0, -1) })));
  const rename = (ei: number, name: string) => setRows((rs) => rs.map((r, i) => (i === ei ? { ...r, name } : r)));

  const doneSets = rows.reduce((a, r) => a + r.sets.filter((s) => s.done).length, 0);
  const totalSets = rows.reduce((a, r) => a + r.sets.length, 0);

  async function save() {
    setSaveState("saving");
    const body: Workout = {
      date,
      session,
      source: "app",
      exercises: rows.map((r) => ({ name: r.name.trim(), sets: toLogged(r) })).filter((e) => e.sets.length > 0),
    };
    try {
      const res = await fetch("/api/workouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      setSaveState("saved");
      router.refresh();
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-2">
        <span>
          {props.label} · {doneSets}/{totalSets} Sätze
        </span>
        {alreadyLogged && <span className="text-good-ink">✓ für {formatDate(date)} gespeichert</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
      </div>

      {exercises.map((ex, ei) => (
        <ExerciseCard
          key={ex.plan.name + ei}
          index={ei}
          ex={ex}
          row={rows[ei]}
          evaluation={evaluations[ei]}
          bumpNote={props.bumpNote}
          onChange={(si, patch) => update(ei, si, patch)}
          onToggle={(si) => toggleDone(ei, si)}
          onAdd={() => addSet(ei)}
          onRemove={() => removeSet(ei)}
          onRename={(n) => rename(ei, n)}
        />
      ))}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-semibold">Empfehlung für nächste Woche</h3>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line first:border-t-0">
                <td className="py-1.5 pr-2 text-ink-2">{row.name}</td>
                <td className="py-1.5 text-right">
                  <ActionBadge action={evaluations[i].r.action} />
                  <span className="ml-2 font-medium">{evaluations[i].r.action === "none" ? "offen" : evaluations[i].r.headline}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saveState === "saving" || doneSets === 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-40"
          >
            {saveState === "saving" ? "Speichert …" : alreadyLogged ? "Änderungen speichern" : "Einheit speichern"}
          </button>
          <span className="text-sm text-ink-2" role="status">
            {saveState === "saved" && "In data/workouts.json gespeichert."}
            {saveState === "error" && "Speichern fehlgeschlagen."}
          </span>
        </div>
      </section>

      {timer && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-ink-2">Pause · {timer.label}</div>
              <div className="tnum text-2xl font-semibold" aria-live="polite">
                {remaining > 0 ? mmss(remaining) : "Los geht's"}
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-accent" style={{ width: `${(1 - remaining / timer.total) * 100}%` }} />
              </div>
            </div>
            <button onClick={() => setTimer({ ...timer, end: timer.end + 30_000, total: timer.total + 30 })} className="rounded-md border border-line px-3 py-2 text-sm">
              +30 s
            </button>
            <button onClick={() => setTimer(null)} className="rounded-md border border-line px-3 py-2 text-sm">
              Stopp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ACTION_STYLE: Record<Action, { label: string; icon: string; color: string }> = {
  increase: { label: "Erhöhen", icon: "↑", color: "var(--good)" },
  hold: { label: "Halten", icon: "=", color: "var(--axis)" },
  decrease: { label: "Senken", icon: "↓", color: "var(--serious)" },
  fix: { label: "Korrigieren", icon: "!", color: "var(--critical)" },
  none: { label: "Offen", icon: "·", color: "var(--surface-2)" },
};

function ActionBadge({ action }: { action: Action }) {
  const s = ACTION_STYLE[action];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
      {s.icon} {s.label}
    </span>
  );
}

function ExerciseCard({
  index,
  ex,
  row,
  evaluation,
  bumpNote,
  onChange,
  onToggle,
  onAdd,
  onRemove,
  onRename,
}: {
  index: number;
  ex: ChecklistExercise;
  row: ExRow;
  evaluation: { a: Analysis; r: ReturnType<typeof recommend> };
  bumpNote: string;
  onChange: (si: number, patch: Partial<SetRow>) => void;
  onToggle: (si: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onRename: (n: string) => void;
}) {
  const p = ex.plan;
  const [editName, setEditName] = useState(false);
  const allDone = row.sets.every((s) => s.done);
  const otherDevice = row.name.trim() !== p.name;
  const lastWorking = ex.last?.sets.filter((s) => !s.warmup) ?? [];
  const { a, r } = evaluation;

  return (
    <article className={`rounded-xl border bg-surface p-4 ${allDone ? "border-good/50" : "border-line"}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">
            <span className="tnum mr-1.5 text-muted">{index + 1}</span>
            {row.name}
            {allDone && <span className="ml-2 text-good-ink" aria-label="erledigt">✓</span>}
          </h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {p.sets} × {p.reps[0]}-{p.reps[1]} Wdh. · RIR {de(p.rir)}
            {p.deload && "-4"} · Pause {mmss(p.rest_s)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-semibold">{p.weight_kg === 0 && ex.target.weight === 0 ? "KG" : `${de(ex.target.weight)} kg`}</div>
          <div className="text-xs text-muted">
            {ex.target.stepUp ? "+1 Stufe · " : ""}
            {ex.target.source === "plan" ? "Plan" : `aus ${formatDate(ex.target.from!)}`}
          </div>
        </div>
      </header>

      <div className="mt-2 space-y-1 text-xs text-ink-2">
        {p.bumped && <p className="font-medium text-ink">Volumenwoche: 4 statt 3 Sätze ({bumpNote}).</p>}
        {p.deload && <p className="font-medium text-ink">Deload: gleiche Gewichte, 2 Sätze, RIR 3-4.</p>}
        {p.warmup && <p>Aufwärmen: {p.warmup}</p>}
        {p.note && <p>Hinweis: {p.note}</p>}
        {ex.last && ex.last.comparable && (
          <p>
            Letztes Mal {formatDate(ex.last.date)}: {lastWorking.map((s) => `${de(s.kg ?? 0)}×${s.reps ?? "?"}${s.rir != null ? ` @${de(s.rir)}` : ""}`).join(" · ")}
          </p>
        )}
        {ex.last && !ex.last.comparable && (
          <p>
            Letzter Eintrag {formatDate(ex.last.date)} an anderem Gerät ({ex.last.name}), nicht vergleichbar.
          </p>
        )}
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] gap-2 px-0.5 text-xs text-muted">
          <span>Satz</span>
          <span>kg</span>
          <span>Wdh.</span>
          <span>RIR</span>
          <span className="sr-only">erledigt</span>
        </div>
        {row.sets.map((s, si) => (
          <div key={si} className="mt-1.5 grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2">
            <span className="tnum pl-1 text-sm text-ink-2">{si + 1}</span>
            <NumInput label={`Satz ${si + 1} Gewicht`} value={s.kg} onChange={(v) => onChange(si, { kg: v })} placeholder={de(ex.target.weight)} />
            <NumInput label={`Satz ${si + 1} Wiederholungen`} value={s.reps} onChange={(v) => onChange(si, { reps: v })} placeholder={`${p.reps[0]}-${p.reps[1]}`} />
            <NumInput label={`Satz ${si + 1} RIR`} value={s.rir} onChange={(v) => onChange(si, { rir: v })} placeholder={si === 0 ? "2" : de(p.rir)} />
            <button
              onClick={() => onToggle(si)}
              disabled={!s.done && s.reps.trim() === ""}
              aria-pressed={s.done}
              aria-label={`Satz ${si + 1} ${s.done ? "erledigt" : "abhaken"}`}
              className={`h-10 rounded-lg border text-lg ${s.done ? "border-good bg-good text-white" : "border-line text-muted hover:text-ink disabled:opacity-40"}`}
            >
              ✓
            </button>
          </div>
        ))}
        <div className="mt-2 flex gap-2 text-xs">
          <button onClick={onAdd} className="rounded-md border border-line px-2 py-1 text-ink-2 hover:text-ink">
            + Satz
          </button>
          <button onClick={onRemove} className="rounded-md border border-line px-2 py-1 text-ink-2 hover:text-ink">
            − Satz
          </button>
          <button onClick={() => setEditName((v) => !v)} className="ml-auto rounded-md px-2 py-1 text-ink-2 hover:text-ink">
            Gerät ändern
          </button>
        </div>
        {editName && (
          <label className="mt-2 block text-xs text-ink-2">
            Übung / Gerät
            <input
              value={row.name}
              onChange={(e) => onRename(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-page px-2 py-1.5 text-sm text-ink"
            />
          </label>
        )}
      </div>

      {(a.working.length > 0 || otherDevice) && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {otherDevice && <IssueList issues={[{ level: "info", text: "Anderes Gerät als im Plan. Wird getrennt gespeichert und nicht mit Planwerten verglichen." }]} />}
          <IssueList issues={a.issues} />
          {a.working.length > 0 && a.issues.every((i) => i.level === "info") && (
            <p className="text-sm text-good-ink">✓ Sauber ausgeführt: Gewicht konstant, keine Einbrüche.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ActionBadge action={r.action} />
            <span className="font-medium">Nächste Woche: {r.headline}</span>
          </div>
          <p className="text-xs text-ink-2">{r.reason}</p>
        </div>
      )}
    </article>
  );
}

function NumInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="tnum h-10 w-full min-w-0 rounded-lg border border-line bg-page px-2 text-center text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
    />
  );
}
