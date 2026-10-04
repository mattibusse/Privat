import type { Issue } from "@/lib/coach";

const STYLE = {
  error: { icon: "✕", label: "Fehler", color: "var(--critical)" },
  warn: { icon: "!", label: "Warnung", color: "var(--warning)" },
  info: { icon: "i", label: "Hinweis", color: "var(--muted)" },
} as const;

export default function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {issues.map((it, i) => {
        const s = STYLE[it.level];
        return (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
            <span
              aria-label={s.label}
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
              style={{ background: s.color }}
            >
              {s.icon}
            </span>
            <span>{it.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
