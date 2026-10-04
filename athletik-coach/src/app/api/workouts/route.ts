import { saveWorkout } from "@/lib/data";
import type { LoggedExercise, Workout } from "@/lib/types";

const SESSIONS = ["upper_a", "lower", "upper_b"];
const isNum = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0;

export async function POST(request: Request) {
  let body: Workout;
  try {
    body = await request.json();
  } catch {
    return new Response("Ungültiges JSON", { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body?.date ?? "") || !SESSIONS.includes(body.session) || !Array.isArray(body.exercises)) {
    return new Response("Datum, Einheit oder Übungen fehlen", { status: 400 });
  }
  const exercises: LoggedExercise[] = [];
  for (const ex of body.exercises) {
    if (typeof ex?.name !== "string" || !ex.name.trim() || !Array.isArray(ex.sets)) {
      return new Response("Übung ohne Namen oder Sätze", { status: 400 });
    }
    const sets = ex.sets.map((s) => ({
      kg: s.kg,
      reps: s.reps,
      ...(s.rir != null ? { rir: s.rir } : {}),
    }));
    if (!sets.every((s) => isNum(s.kg) && isNum(s.reps) && (s.rir == null || isNum(s.rir)))) {
      return new Response(`Ungültige Satzwerte bei ${ex.name}`, { status: 400 });
    }
    exercises.push({ name: ex.name.trim(), sets });
  }
  await saveWorkout({ date: body.date, session: body.session, source: "app", exercises });
  return Response.json({ ok: true });
}
