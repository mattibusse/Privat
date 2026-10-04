export type StrengthSession = "upper_a" | "lower" | "upper_b";
export type SessionKey =
  | StrengthSession
  | "rest_or_padel"
  | "run_intervals"
  | "run_zone2";

export interface PlanExercise {
  name: string;
  sets: number;
  reps: [number, number];
  rir: number;
  rest_s: number;
  weight_kg: number;
  warmup?: string;
  note?: string;
}

export interface RunWeek {
  week: number;
  dates: string;
  intervals: string;
  zone2_km: number;
}

export interface Plan {
  block: {
    name: string;
    start: string;
    end: string;
    as_of: string;
    deload_week: number;
    test: { date: string; type: string; target_time: string };
  };
  week_structure: { day: string; session: SessionKey }[];
  min_gaps_hours: {
    lower_to_intervals: number;
    upper_a_to_upper_b: number;
    padel_before_lower: number;
    rest_days_per_week: number;
  };
  sessions: Record<StrengthSession, { label: string; exercises: PlanExercise[] }>;
  progression: {
    volume_bump_weeks: number[];
    volume_bump_note: string;
    [key: string]: unknown;
  };
  running: {
    intervals_structure: {
      warmup_km: number;
      warmup_pace: string;
      strides: number;
      recovery_pace: string;
      cooldown_pace: string;
      total_km: number;
    };
    zone2: { pace: string; hr_max: number; hr_range: [number, number] };
    weeks: RunWeek[];
    reference_paces: Record<string, string>;
  };
  nutrition: {
    kcal: number;
    decision_rule_2026_10_11: string;
    [key: string]: unknown;
  };
  deload: { week: number; strength: string; running: string };
}

export interface LoggedSet {
  kg: number | null;
  reps: number | null;
  rir?: number | null;
  warmup?: boolean;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
  note?: string;
  position?: number;
}

export interface Workout {
  date: string;
  session: StrengthSession;
  coach_verdict?: string;
  source?: "app";
  exercises: LoggedExercise[];
}

export interface IntervalRep {
  nr: number;
  distance_km: number;
  pace: string;
  end_hr?: number;
}

export interface Run {
  date: string;
  type: "race" | "intervals" | "zone2" | "padel";
  name?: string;
  distance_km?: number;
  time?: string;
  moving_time?: string;
  avg_pace?: string;
  avg_hr?: number;
  max_hr?: number;
  duration_min?: number;
  intervals?: IntervalRep[];
  splits?: string[];
  coach_verdict?: string;
  note?: string;
}

export interface Bodyweight {
  unit: string;
  protocol: string;
  entries: { date: string; weight: number; bodyfat_pct?: number }[];
  gaps?: string;
  status?: string;
}

export interface AppData {
  plan: Plan;
  workouts: Workout[];
  runs: Run[];
  bodyweight: Bodyweight;
}
