"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

export interface WeightRow {
  t: number;
  date: string;
  weight?: number;
  avgPoint?: number;
  weekAvg: number;
  weekN: number;
  kw: number;
}

const de = (n: number, d = 1) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const dayLabel = (t: number) => {
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;
};

export default function WeightChart({ rows, ticks, band }: { rows: WeightRow[]; ticks: number[]; band: [number, number] }) {
  const values = rows.flatMap((r) => [r.weight, r.avgPoint]).filter((x): x is number => x != null);
  const lo = Math.floor(Math.min(...values, band[0]) * 2 - 1) / 2;
  const hi = Math.ceil(Math.max(...values, band[1]) * 2 + 1) / 2;

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-2">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--series-1)] opacity-40" aria-hidden />
          Tageswert
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden>
            <line x1="1" y1="5" x2="17" y2="5" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="9" cy="5" r="3" fill="var(--series-1)" />
          </svg>
          Wochenschnitt
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-surface-2" aria-hidden />
          Entscheidungszone {de(band[0])}-{de(band[1])} kg
        </li>
      </ul>
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <ReferenceArea
            y1={band[0]}
            y2={band[1]}
            fill="var(--surface-2)"
            fillOpacity={1}
            stroke="none"
          />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tickFormatter={dayLabel}
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            domain={[lo, hi]}
            tickCount={6}
            tickFormatter={(v: number) => de(v)}
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
            unit=""
          />
          <Tooltip content={WeightTooltip} cursor={{ stroke: "var(--axis)", strokeWidth: 1 }} />
          <Line
            dataKey="weight"
            name="Tageswert"
            stroke="none"
            isAnimationActive={false}
            dot={{ r: 3.5, fill: "var(--series-1)", fillOpacity: 0.35, stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
          <Line
            dataKey="avgPoint"
            name="Wochenschnitt"
            connectNulls
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            dot={{ r: 4.5, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}

function WeightTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as WeightRow;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 text-muted">{dayLabel(row.t)}</div>
      {row.weight != null && (
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--series-1)] opacity-40" />
          <strong className="tnum text-ink">{de(row.weight)} kg</strong>
          <span className="text-ink-2">Tageswert</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3 rounded bg-[var(--series-1)]" />
        <strong className="tnum text-ink">{de(row.weekAvg, 2)} kg</strong>
        <span className="text-ink-2">
          Schnitt KW {row.kw} ({row.weekN} {row.weekN === 1 ? "Messung" : "Messungen"})
        </span>
      </div>
    </div>
  );
}
