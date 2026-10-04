import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { AppData, Bodyweight, Plan, Run, Workout } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf8")) as T;
}

export async function loadData(): Promise<AppData> {
  const [plan, workouts, runs, bodyweight] = await Promise.all([
    readJson<Plan>("plan.json"),
    readJson<Workout[]>("workouts.json"),
    readJson<Run[]>("runs.json"),
    readJson<Bodyweight>("bodyweight.json"),
  ]);
  // Ohne as_of gilt der Plan als Stand der letzten manuell uebernommenen Einheit
  if (!plan.block.as_of) {
    plan.block.as_of = workouts.filter((w) => w.source !== "app").reduce((d, w) => (w.date > d ? w.date : d), plan.block.start);
  }
  return { plan, workouts, runs, bodyweight };
}

/** Ersetzt eine per App geloggte Einheit am selben Tag oder haengt sie an. */
export async function saveWorkout(workout: Workout): Promise<void> {
  const file = path.join(DATA_DIR, "workouts.json");
  const workouts = JSON.parse(await fs.readFile(file, "utf8")) as Workout[];
  const rest = workouts.filter(
    (w) => !(w.source === "app" && w.date === workout.date && w.session === workout.session),
  );
  rest.push(workout);
  rest.sort((a, b) => a.date.localeCompare(b.date));
  await fs.writeFile(file, compactJson(rest) + "\n", "utf8");
}

/** JSON im Stil der Ausgangsdaten: alles, was in eine Zeile passt, bleibt einzeilig. */
function inline(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  if (v && typeof v === "object") {
    const parts = Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`);
    return parts.length ? `{ ${parts.join(", ")} }` : "{}";
  }
  return JSON.stringify(v);
}

function compactJson(v: unknown, indent = 0): string {
  const one = inline(v);
  if (indent > 0 && indent + one.length <= 240) return one;
  if (!v || typeof v !== "object") return one;
  const pad = " ".repeat(indent + 2);
  const end = " ".repeat(indent);
  if (Array.isArray(v)) return `[\n${v.map((x) => pad + compactJson(x, indent + 2)).join(",\n")}\n${end}]`;
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return `{\n${entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${compactJson(x, indent + 2)}`).join(",\n")}\n${end}}`;
}
