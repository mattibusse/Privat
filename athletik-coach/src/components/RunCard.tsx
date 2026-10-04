import type { Plan, Run, RunWeek } from "@/lib/types";
import { formatDate } from "@/lib/coach";

export default function RunCard({
  plan,
  type,
  week,
  done,
}: {
  plan: Plan;
  type: "run_intervals" | "run_zone2";
  week: RunWeek;
  done: Run[];
}) {
  const r = plan.running;
  const s = r.intervals_structure;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{type === "run_zone2" ? "Zone-2-Lauf" : "Intervalle"}</h2>
        <span className="text-sm text-muted">Woche {week.week} · {week.dates}</span>
      </div>

      {type === "run_zone2" ? (
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Umfang" value={`${week.zone2_km} km`} />
          <Stat label="Pace" value={r.zone2.pace} />
          <Stat label="HF-Obergrenze" value={`${r.zone2.hr_max} bpm`} sub={`Bereich ${r.zone2.hr_range[0]}-${r.zone2.hr_range[1]}`} />
        </dl>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          <Step n={1} title={`Einlaufen ${s.warmup_km.toLocaleString("de-DE")} km`} detail={`${s.warmup_pace} /km, nicht schneller`} />
          <Step n={2} title={`${s.strides} Steigerungen`} detail="locker, volle Erholung" />
          <Step n={3} title={week.intervals} detail={`Trabpausen ${s.recovery_pace} /km, nicht stehen`} strong />
          <Step n={4} title="Auslaufen" detail={`${s.cooldown_pace} /km, gesamt ca. ${s.total_km} km`} />
        </ol>
      )}

      {done.length > 0 && (
        <div className="mt-4 border-t border-line pt-3 text-sm">
          {done.map((run, i) => (
            <div key={i}>
              <p>
                <span className="text-good-ink">✓</span> Erledigt am {formatDate(run.date)}: {run.distance_km?.toLocaleString("de-DE")} km in {run.time ?? run.moving_time},{" "}
                Ø {run.avg_pace} /km, Ø HF {run.avg_hr}
              </p>
              {run.coach_verdict && <p className="mt-1 text-ink-2">{run.coach_verdict}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-ink-2">{sub}</dd>}
    </div>
  );
}

function Step({ n, title, detail, strong }: { n: number; title: string; detail: string; strong?: boolean }) {
  return (
    <li className="flex gap-3">
      <span className="tnum w-4 text-muted">{n}</span>
      <div>
        <div className={strong ? "font-semibold" : ""}>{title}</div>
        <div className="text-ink-2">{detail}</div>
      </div>
    </li>
  );
}
