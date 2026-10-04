import Link from "next/link";
import { loadData } from "@/lib/data";
import {
  SESSION_LABELS,
  WEEKDAYS,
  addDays,
  blockWeek,
  effectiveExercise,
  formatDate,
  gapWarnings,
  isStrength,
  lastEntry,
  mondayOf,
  plannedSession,
  previousAnalysis,
  targetWeight,
} from "@/lib/coach";
import type { StrengthSession } from "@/lib/types";
import Checklist, { type ChecklistExercise } from "@/components/Checklist";
import RunCard from "@/components/RunCard";
import IssueList from "@/components/IssueList";

export const dynamic = "force-dynamic";

function todayBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

const STRENGTH: StrengthSession[] = ["upper_a", "lower", "upper_b"];

export default async function Page({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { plan, workouts, runs } = await loadData();
  const date = typeof sp.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : todayBerlin();
  const week = blockWeek(plan, date);
  const planned = plannedSession(plan, date);

  // Kraft-Einheit: geplante von heute, sonst die naechste geplante, per ?einheit ueberschreibbar
  let session: StrengthSession;
  if (typeof sp.einheit === "string" && STRENGTH.includes(sp.einheit as StrengthSession)) {
    session = sp.einheit as StrengthSession;
  } else if (isStrength(planned)) {
    session = planned;
  } else {
    let d = date;
    let s = plannedSession(plan, d);
    for (let i = 0; i < 7 && !isStrength(s); i++) {
      d = addDays(d, 1);
      s = plannedSession(plan, d);
    }
    session = isStrength(s) ? s : "upper_a";
  }

  const exercises: ChecklistExercise[] = plan.sessions[session].exercises.map((ex) => ({
    plan: effectiveExercise(plan, session, ex, week),
    target: targetWeight(plan, workouts, session, ex, date),
    last: lastEntry(workouts, session, ex.name, date),
    prev: previousAnalysis(plan, workouts, session, ex, date),
  }));
  const loggedToday = workouts.find((w) => w.date === date && w.session === session);

  const monday = mondayOf(date);
  const days = WEEKDAYS.map((label, i) => {
    const d = addDays(monday, i);
    const s = plannedSession(plan, d);
    const strengthDone = workouts.filter((w) => w.date === d).map((w) => SESSION_LABELS[w.session]);
    const runDone = runs.filter((r) => r.date === d && r.type !== "padel").map((r) => (r.type === "race" ? "Wettkampf" : r.type === "zone2" ? "Zone 2" : "Intervalle"));
    const padel = runs.some((r) => r.date === d && r.type === "padel");
    return { label, d, s, done: [...strengthDone, ...runDone], padel };
  });

  const runWeek = plan.running.weeks.find((w) => w.week === week);
  const runToday = runs.filter((r) => r.date === date && r.type !== "padel");
  const plannedGaps = gapWarnings(plan, workouts, runs, planned, date);
  const sessionGaps = session !== planned ? gapWarnings(plan, workouts, runs, session, date) : [];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-ink-2">
          {WEEKDAYS[days.findIndex((x) => x.d === date)]}, {formatDate(date, true)} · {plan.block.name} · Woche {week} von 8
          {week === plan.deload.week && " · Deload"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Heute: {SESSION_LABELS[planned]}</h1>
      </section>

      <section aria-label="Wochenübersicht" className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = day.d === date;
          return (
            <div
              key={day.d}
              className={`rounded-lg border px-1 py-2 text-center ${isToday ? "border-accent bg-surface" : "border-line bg-surface"}`}
            >
              <div className="text-xs font-medium">{day.label}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-muted">{shortLabel(day.s)}</div>
              <div className="mt-1 text-xs" aria-label={day.done.length ? `erledigt: ${day.done.join(", ")}` : "offen"}>
                {day.done.length ? <span className="text-good-ink">✓</span> : <span className="text-muted">·</span>}
                {day.padel && <span className="ml-0.5 text-[10px] text-ink-2">P</span>}
              </div>
            </div>
          );
        })}
      </section>
      <p className="-mt-4 text-xs text-muted">✓ erledigt · P Padel als Zusatzbelastung</p>

      {plannedGaps.length > 0 && <IssueList issues={plannedGaps} />}

      {(planned === "run_intervals" || planned === "run_zone2") && runWeek && (
        <RunCard plan={plan} type={planned} week={runWeek} done={runToday} />
      )}
      {planned === "rest_or_padel" && (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
          Pause oder Padel. Padel zählt als Zusatzbelastung: mindestens {plan.min_gaps_hours.padel_before_lower} h Abstand vor Lower.
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {isStrength(planned) ? "Checkliste" : "Krafteinheit loggen"}
          </h2>
          <div className="flex gap-1" role="tablist" aria-label="Einheit wählen">
            {STRENGTH.map((s) => (
              <Link
                key={s}
                href={`/?einheit=${s}${sp.datum ? `&datum=${date}` : ""}`}
                aria-selected={s === session}
                role="tab"
                className={`rounded-md border px-2.5 py-1 text-sm ${s === session ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2 hover:text-ink"}`}
              >
                {plan.sessions[s].label.replace(/ \(.*\)/, "")}
              </Link>
            ))}
          </div>
        </div>
        {sessionGaps.length > 0 && <IssueList issues={sessionGaps} />}
        <Checklist
          key={`${date}-${session}`}
          date={date}
          session={session}
          label={plan.sessions[session].label}
          week={week}
          bumpNote={plan.progression.volume_bump_note}
          exercises={exercises}
          alreadyLogged={loggedToday?.source === "app" ? loggedToday : null}
        />
      </section>
    </div>
  );
}

function shortLabel(s: string) {
  return (
    { upper_a: "Upper A", lower: "Lower", upper_b: "Upper B", rest_or_padel: "Pause", run_intervals: "Intervalle", run_zone2: "Zone 2" } as Record<string, string>
  )[s];
}
