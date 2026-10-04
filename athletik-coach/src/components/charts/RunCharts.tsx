"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";

export type RunKind = "zone2" | "intervals" | "race";

export interface RunRow {
  t: number;
  date: string;
  kind: RunKind;
  /** Zone 2/Wettkampf: Durchschnitt, Intervalle: Arbeitspace */
  pace: number;
  avgPace: number;
  hr: number;
  mpb: number;
  zone2?: number;
  intervals?: number;
  race?: number;
  zone2Mpb?: number;
  intervalsMpb?: number;
  raceMpb?: number;
}

export const SERIES: { key: RunKind; label: string; color: string; shape: "circle" | "square" | "diamond" }[] = [
  { key: "zone2", label: "Zone 2", color: "var(--series-1)", shape: "circle" },
  { key: "intervals", label: "Intervalle", color: "var(--series-2)", shape: "square" },
  { key: "race", label: "Wettkampf", color: "var(--series-3)", shape: "diamond" },
];

const paceLabel = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};
const dayLabel = (t: number) => {
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;
};
const de = (n: number, d = 2) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

function Marker({ cx, cy, shape, color, r = 4.5 }: { cx?: number; cy?: number; shape: string; color: string; r?: number }) {
  if (cx == null || cy == null) return null;
  const common = { fill: color, stroke: "var(--surface)", strokeWidth: 2 };
  if (shape === "square") return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} {...common} />;
  if (shape === "diamond") return <path d={`M${cx},${cy - r - 1.5} L${cx + r + 1.5},${cy} L${cx},${cy + r + 1.5} L${cx - r - 1.5},${cy} Z`} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

export function Legend({ band }: { band?: string }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden>
            <line x1="1" y1="5" x2="17" y2="5" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
            <Marker cx={9} cy={5} shape={s.shape} color={s.color} r={3} />
          </svg>
          {s.label}
        </li>
      ))}
      {band && (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-surface-2" aria-hidden />
          {band}
        </li>
      )}
    </ul>
  );
}

function RunTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as RunRow;
  const s = SERIES.find((x) => x.key === row.kind)!;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-muted">
        <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
        {s.label} · {dayLabel(row.t)}
      </div>
      <div>
        <strong className="tnum text-ink">{paceLabel(row.pace)} /km</strong>{" "}
        <span className="text-ink-2">{row.kind === "intervals" ? "Arbeitspace" : "Ø Pace"}</span>
      </div>
      <div>
        <strong className="tnum text-ink">{row.hr} bpm</strong> <span className="text-ink-2">Ø HF</span>
      </div>
      <div>
        <strong className="tnum text-ink">{de(row.mpb)} m</strong> <span className="text-ink-2">pro Herzschlag</span>
      </div>
    </div>
  );
}

const axisProps = {
  stroke: "var(--axis)",
  tick: { fill: "var(--muted)", fontSize: 12 },
  tickLine: false,
} as const;

function Chart({
  rows,
  ticks,
  suffix,
  yDomain,
  yReversed,
  yFormat,
  yTicks,
  band,
}: {
  rows: RunRow[];
  ticks: number[];
  suffix: "" | "Mpb";
  yDomain: [number, number];
  yReversed?: boolean;
  yFormat: (v: number) => string;
  yTicks?: number[];
  band?: { y1: number; y2: number; label: string };
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          {band && (
            <ReferenceArea
              y1={band.y1}
              y2={band.y2}
              fill="var(--surface-2)"
              fillOpacity={1}
              stroke="none"
            />
          )}
          <XAxis dataKey="t" type="number" scale="time" domain={[ticks[0], ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={dayLabel} {...axisProps} />
          <YAxis domain={yDomain} reversed={yReversed} tickFormatter={yFormat} ticks={yTicks} tickCount={6} width={48} axisLine={false} {...axisProps} />
          <Tooltip content={RunTooltip} cursor={{ stroke: "var(--axis)", strokeWidth: 1 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              dataKey={`${s.key}${suffix}`}
              name={s.label}
              connectNulls
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              isAnimationActive={false}
              dot={(p: { cx?: number; cy?: number; value?: number | null; index?: number }) =>
                p.value == null ? <g key={`${s.key}-${p.index}`} /> : <Marker key={`${s.key}-${p.index}`} cx={p.cx} cy={p.cy} shape={s.shape} color={s.color} />
              }
              activeDot={(p: { cx?: number; cy?: number; index?: number }) => <Marker key={`a-${s.key}-${p.index}`} cx={p.cx} cy={p.cy} shape={s.shape} color={s.color} r={6} />}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaceChart({ rows, ticks, zone2Band }: { rows: RunRow[]; ticks: number[]; zone2Band: [number, number] }) {
  const v = rows.map((r) => r.pace);
  const lo = Math.floor((Math.min(...v, zone2Band[0]) - 10) / 30) * 30;
  const hi = Math.ceil((Math.max(...v, zone2Band[1]) + 10) / 30) * 30;
  const yTicks = Array.from({ length: (hi - lo) / 30 + 1 }, (_, i) => lo + i * 30);
  return <Chart rows={rows} ticks={ticks} suffix="" yDomain={[lo, hi]} yTicks={yTicks} yReversed yFormat={paceLabel} band={{ y1: zone2Band[0], y2: zone2Band[1], label: "Zone-2-Ziel" }} />;
}

export function EfficiencyChart({ rows, ticks }: { rows: RunRow[]; ticks: number[] }) {
  const v = rows.map((r) => r.mpb);
  const lo = Math.floor((Math.min(...v) - 0.02) * 20) / 20;
  const hi = Math.ceil((Math.max(...v) + 0.02) * 20) / 20;
  const yTicks = Array.from({ length: Math.round((hi - lo) * 20) + 1 }, (_, i) => Number((lo + i * 0.05).toFixed(2)));
  return <Chart rows={rows} ticks={ticks} suffix="Mpb" yDomain={[lo, hi]} yTicks={yTicks} yFormat={(x) => de(x)} />;
}
