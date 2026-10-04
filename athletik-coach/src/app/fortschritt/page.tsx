import type { Metadata } from "next";
import { loadData } from "@/lib/data";
import {
  addDays,
  formatDate,
  intervalWorkPace,
  isoWeek,
  metersPerBeat,
  mondayOf,
  paceToSec,
  parseISO,
  secToPace as paceLabel,
  weeklyAverages,
} from "@/lib/coach";
import WeightChart, { type WeightRow } from "@/components/charts/WeightChart";
import { EfficiencyChart, Legend, PaceChart, type RunRow } from "@/components/charts/RunCharts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fortschritt · Athletik Coach" };

const t = (iso: string) => parseISO(iso).getTime();
const de = (n: number, d = 1) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Montage von der Woche des ersten bis nach dem letzten Datum, als Achsen-Ticks */
function mondayTicks(dates: string[]): number[] {
  const sorted = [...dates].sort();
  const out: number[] = [];
  for (let d = mondayOf(sorted[0]); d <= addDays(mondayOf(sorted[sorted.length - 1]), 7); d = addDays(d, 7)) out.push(t(d));
  return out;
}

export default async function Fortschritt() {
  const { plan, runs, bodyweight } = await loadData();

  // ---- Gewicht: Tageswerte nur als Kontext, bewertet wird der Wochenschnitt (Regel 5)
  const weeks = weeklyAverages(bodyweight.entries);
  const byMonday = new Map(weeks.map((w) => [w.monday, w]));
  const rowsMap = new Map<string, WeightRow>();
  const base = (date: string): WeightRow => {
    const w = byMonday.get(mondayOf(date))!;
    return { t: t(date), date, weekAvg: w.avg, weekN: w.n, kw: isoWeek(date) };
  };
  for (const e of bodyweight.entries) rowsMap.set(e.date, { ...base(e.date), weight: e.weight });
  for (const w of weeks) {
    const mid = addDays(w.monday, 3);
    rowsMap.set(mid, { ...(rowsMap.get(mid) ?? base(mid)), avgPoint: Number(w.avg.toFixed(2)) });
  }
  const weightRows = [...rowsMap.values()].sort((a, b) => a.t - b.t);
  const weightTicks = mondayTicks(bodyweight.entries.map((e) => e.date));
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const delta = prev ? cur.avg - prev.avg : null;

  // ---- Laufen
  const runRows: RunRow[] = runs
    .filter((r) => r.type !== "padel" && r.avg_hr && r.avg_pace)
    .map((r) => {
      const kind = r.type as RunRow["kind"];
      const avgPace = paceToSec(r.avg_pace)!;
      const pace = kind === "intervals" ? intervalWorkPace(r) ?? avgPace : avgPace;
      const mpb = metersPerBeat(avgPace, r.avg_hr!);
      return { t: t(r.date), date: r.date, kind, pace, avgPace, hr: r.avg_hr!, mpb, [kind]: pace, [`${kind}Mpb`]: mpb };
    })
    .sort((a, b) => a.t - b.t);
  const runTicks = mondayTicks(runRows.map((r) => r.date));
  const z2 = plan.running.zone2.pace.split("-").map((p) => paceToSec(p)!) as [number, number];
  const zone2Runs = runRows.filter((r) => r.kind === "zone2");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Fortschritt</h1>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Körpergewicht</h2>
          <p className="text-sm text-ink-2">Wochenschnitt als Linie, Tageswerte nur zur Einordnung. Bewertet wird der Trend über Wochen.</p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Tile label={`Schnitt KW ${isoWeek(cur.monday)}`} value={`${de(cur.avg, 2)} kg`} sub={`${cur.n} von 7 Tagen`} />
          {prev && <Tile label={`Schnitt KW ${isoWeek(prev.monday)}`} value={`${de(prev.avg, 2)} kg`} sub={`${prev.n} von 7 Tagen`} />}
          {delta != null && (
            <Tile label="Veränderung" value={`${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${de(Math.abs(delta), 2)} kg`} sub="zur Vorwoche" />
          )}
        </dl>
        <div className="rounded-xl border border-line bg-surface p-3">
          <WeightChart rows={weightRows} ticks={weightTicks} band={[82.8, 83.0]} />
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="font-medium">Entscheidungsregel 11.10.</p>
          <p className="mt-1 text-ink-2">{plan.nutrition.decision_rule_2026_10_11}</p>
          <p className="mt-2 text-ink-2">
            Tendenz mit aktuellem Schnitt {de(cur.avg, 2)} kg:{" "}
            <strong className="text-ink">
              {cur.avg >= 83 ? "auf 2300 kcal senken" : cur.avg < 82.8 ? "unverändert" : "Grenzbereich, Regel greift nicht eindeutig"}
            </strong>
            . Endgültig erst nach 7 vollständigen Messtagen.
          </p>
          {bodyweight.gaps && <p className="mt-2 text-xs text-muted">Lücken: {bodyweight.gaps}</p>}
        </div>
        <DataTable
          caption="Wochenschnitte als Tabelle"
          head={["KW", "Woche ab", "Schnitt", "Messungen"]}
          rows={weeks.map((w) => [String(isoWeek(w.monday)), formatDate(w.monday), `${de(w.avg, 2)} kg`, String(w.n)])}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Laufpace</h2>
          <p className="text-sm text-ink-2">Zone 2 und Wettkampf: Ø Pace. Intervalle: Pace der Arbeitsabschnitte. Oben ist schneller.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="mb-2 px-1">
            <Legend band={`Zone-2-Ziel ${plan.running.zone2.pace}`} />
          </div>
          <PaceChart rows={runRows} ticks={runTicks} zone2Band={z2} />
        </div>

        <div className="pt-2">
          <h3 className="font-semibold">Pace bei gleicher HF</h3>
          <p className="text-sm text-ink-2">
            Meter pro Herzschlag aus Ø Pace und Ø HF der ganzen Einheit. Steigt der Wert bei gleichem Lauftyp, läufst du bei gleicher HF schneller.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="mb-2 px-1">
            <Legend />
          </div>
          <EfficiencyChart rows={runRows} ticks={runTicks} />
        </div>
        {zone2Runs.length >= 2 && (
          <p className="text-sm text-ink-2">
            Zone 2: {formatDate(zone2Runs[0].date)} {paceLabel(zone2Runs[0].avgPace)} /km bei {zone2Runs[0].hr} bpm, {formatDate(zone2Runs[zone2Runs.length - 1].date)}{" "}
            {paceLabel(zone2Runs[zone2Runs.length - 1].avgPace)} /km bei {zone2Runs[zone2Runs.length - 1].hr} bpm. Erst ab 3-4 Läufen mit ähnlicher Temperatur und Strecke als Trend lesen.
          </p>
        )}
        <DataTable
          caption="Läufe als Tabelle"
          head={["Datum", "Typ", "Pace", "Ø HF", "m/Schlag"]}
          rows={runRows.map((r) => [
            formatDate(r.date),
            r.kind === "zone2" ? "Zone 2" : r.kind === "race" ? "Wettkampf" : "Intervalle",
            paceLabel(r.pace),
            String(r.hr),
            de(r.mpb, 2),
          ])}
        />
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-nowrap text-lg font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-ink-2">{sub}</dd>}
    </div>
  );
}

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="rounded-xl border border-line bg-surface p-3 text-sm">
      <summary className="cursor-pointer text-ink-2">{caption}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="tnum w-full">
          <thead>
            <tr className="text-left text-xs text-muted">
              {head.map((h) => (
                <th key={h} className="py-1 pr-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {r.map((c, j) => (
                  <td key={j} className="py-1 pr-3">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
