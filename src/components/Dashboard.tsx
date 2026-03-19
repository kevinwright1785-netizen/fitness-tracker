"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  first_name: string | null;
  goal: string | null;
  daily_calories: number | null;
  daily_protein: number | null;
  daily_carbs: number | null;
  daily_fat: number | null;
  current_weight: number | null;
  streak_count: number | null;
  last_streak_date: string | null;
};

type Totals = { calories: number; protein: number; carbs: number; fat: number };

type CompletionResult = {
  grade: string;
  gradeColor: string;
  deficit: number; // positive = deficit, negative = surplus
  consumed: number;
  goal: number;
  headline: string;
  explanation: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function calcGrade(
  consumed: number,
  goal: number,
  totals: Totals,
  profile: Profile
): { grade: string; gradeColor: string; headline: string; explanation: string } {
  const isLose = (profile.goal ?? "lose") === "lose";
  const pctCal = goal > 0 ? consumed / goal : 0;
  const pctP   = profile.daily_protein ? totals.protein / profile.daily_protein : 0;
  const pctC   = profile.daily_carbs   ? totals.carbs   / profile.daily_carbs   : 0;
  const pctF   = profile.daily_fat     ? totals.fat     / profile.daily_fat     : 0;

  if (isLose) {
    // Over by more than 20% = F
    if (pctCal > 1.2)
      return { grade: "F", gradeColor: "text-rose-500", headline: "Over your calorie goal.", explanation: "Try to stay within your target for better results." };
    // Under 40% = F (too little food)
    if (pctCal < 0.4)
      return { grade: "F", gradeColor: "text-rose-500", headline: "Way too low today.", explanation: "Eating too little can slow your metabolism. Aim for a sustainable deficit." };
    // A: 80–100% of goal AND protein ≥ 80%
    if (pctCal >= 0.8 && pctCal <= 1.0 && pctP >= 0.8)
      return { grade: "A", gradeColor: "text-emerald-400", headline: "You hit your deficit today!", explanation: `Great calorie control. ${pctP >= 0.95 ? "Protein was excellent." : "Protein was strong."}` };
    // B: 70–100% of goal AND protein ≥ 60%, OR slightly over with strong protein
    if (pctCal >= 0.7 && pctCal <= 1.0 && pctP >= 0.6)
      return { grade: "B", gradeColor: "text-sky-400", headline: "Solid day!", explanation: "Good deficit. Bump protein a little closer to your goal for an A." };
    if (pctCal > 1.0 && pctCal <= 1.2 && pctP >= 0.8)
      return { grade: "B", gradeColor: "text-sky-400", headline: "Slightly over — but strong macros.", explanation: "A touch over on calories, but you nailed your protein." };
    // C: 60–100% of goal OR protein ≥ 40%
    if ((pctCal >= 0.6 && pctCal <= 1.0) || pctP >= 0.4)
      return { grade: "C", gradeColor: "text-yellow-400", headline: "Decent day.", explanation: pctP < 0.6 ? "Try to hit more of your protein goal tomorrow." : "Work on staying a bit closer to your calorie target." };
    // D: 40–70% of goal
    if (pctCal >= 0.4 && pctCal < 0.7)
      return { grade: "D", gradeColor: "text-orange-400", headline: "Too far under your goal.", explanation: "Sustainable deficits work better long-term — try to eat a bit more." };
    return { grade: "F", gradeColor: "text-rose-500", headline: "Rough day.", explanation: "Aim for 70–100% of your calorie goal with solid protein." };
  }

  // Maintain — symmetric window around goal
  const diff = Math.abs(consumed - goal);
  const macrosHit80 = pctP >= 0.8 && pctC >= 0.8 && pctF >= 0.8;
  const macrosHit60 = pctP >= 0.6 && pctC >= 0.6 && pctF >= 0.6;
  if (diff <= 100 && macrosHit80)
    return { grade: "A", gradeColor: "text-emerald-400", headline: "Perfect maintenance!", explanation: "Spot-on calories and great macro balance." };
  if (diff <= 200 && macrosHit60)
    return { grade: "B", gradeColor: "text-sky-400", headline: "Great day!", explanation: "Close to your calorie goal with solid macros." };
  if (diff <= 300)
    return { grade: "C", gradeColor: "text-yellow-400", headline: "Pretty good.", explanation: "Within range — try to tighten up macros tomorrow." };
  if (diff <= 500)
    return { grade: "D", gradeColor: "text-orange-400", headline: "A bit off today.", explanation: "Try to get closer to your calorie target." };
  return { grade: "F", gradeColor: "text-rose-500", headline: "Missed your target.", explanation: "Way off your calorie goal — get back on track tomorrow." };
}

// ─── Circular progress ring ───────────────────────────────────────────────────

function CalorieRing({
  consumed,
  goal,
  stepsCalories,
}: {
  consumed: number;
  goal: number;
  stepsCalories: number;
}) {
  const totalGoal = goal + stepsCalories;
  const remaining = totalGoal - consumed; // signed — negative means over goal
  const isOver = remaining < 0;
  const pct = totalGoal > 0 ? Math.min(1, consumed / totalGoal) : 0;

  const r = 88;
  const circ = 2 * Math.PI * r;
  // When over goal, fill the ring completely
  const dash = isOver ? circ : pct * circ;

  let ringColor = "#10b981"; // emerald
  if (isOver) ringColor = "#f43f5e"; // rose
  else if (remaining <= 200) ringColor = "#f59e0b"; // amber

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" className="-rotate-90">
          {/* track */}
          <circle cx="110" cy="110" r={r} fill="none" stroke="#1e293b" strokeWidth="16" />
          {/* progress */}
          <circle
            cx="110"
            cy="110"
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className="text-4xl font-bold tabular-nums"
            style={{ color: isOver ? "#f43f5e" : "white" }}
          >
            {isOver ? "-" : ""}{Math.abs(remaining).toFixed(0)}
          </span>
          <span className="text-xs text-slate-400">calories remaining</span>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        <span className="font-semibold text-white">{consumed.toFixed(0)}</span> consumed
        {" · "}
        <span className="font-semibold text-white">{totalGoal.toFixed(0)}</span> goal
      </p>
    </div>
  );
}

// ─── Fireworks animation ──────────────────────────────────────────────────────

function Fireworks() {
  useEffect(() => {
    const colors = ["#10b981", "#f59e0b", "#38bdf8", "#f472b6", "#a78bfa", "#ffffff"];

    function fire(x: number, y: number) {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x, y },
        colors,
        startVelocity: 28,
        gravity: 0.9,
        ticks: 180,
      });
    }

    // Three bursts staggered over ~2 seconds
    fire(0.3, 0.5);
    const t1 = setTimeout(() => fire(0.7, 0.4), 400);
    const t2 = setTimeout(() => fire(0.5, 0.55), 800);
    const t3 = setTimeout(() => fire(0.25, 0.35), 1200);
    const t4 = setTimeout(() => fire(0.75, 0.5), 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return null;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

// Show greeting if it hasn't been shown in the last 30 minutes.
// localStorage persists across PWA hard-closes on iPhone (unlike sessionStorage
// which iOS also sometimes persists). The timestamp lets us show the greeting
// on every genuine fresh launch without repeating it during tab-switching.
const GREETING_TIMEOUT_MS = 30 * 60 * 1000;

function shouldShowGreeting(): boolean {
  if (typeof window === "undefined") return false;
  const ts = localStorage.getItem("greetingShownAt");
  if (!ts) return true;
  return Date.now() - Number(ts) > GREETING_TIMEOUT_MS;
}

function markGreetingShown() {
  localStorage.setItem("greetingShownAt", String(Date.now()));
}

export function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // profile & data
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totals, setTotals] = useState<Totals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [latestWeightLbs, setLatestWeightLbs] = useState<number | null>(null);
  const [stepsToday, setStepsToday] = useState(0);
  // Show greeting on every fresh app launch (>30 min since last shown)
  const [showSplash, setShowSplash] = useState(() => shouldShowGreeting());
  const [splashFading, setSplashFading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
  const [showStepsInput, setShowStepsInput] = useState(false);
  const [stepsInput, setStepsInput] = useState("");
  const [savingSteps, setSavingSteps] = useState(false);
  const splashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load all data ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Wait for auth to resolve — don't suppress the splash while still loading
    if (authLoading) return;

    if (!user || !supabase) {
      markGreetingShown();
      setShowSplash(false);
      return;
    }

    async function load() {
      const { start, end } = todayRange();

      // Fetch core profile fields and the other data sources in parallel.
      // streak_count / last_streak_date are fetched separately because
      // they require a migration; if they don't exist yet the query will
      // error and we fall back to defaults rather than losing all profile data.
      const [profileRes, streakRes, foodRes, weightRes, stepsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "first_name, goal, daily_calories, daily_protein, daily_carbs, daily_fat, current_weight"
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("streak_count, last_streak_date")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("food_logs")
          .select("calories, protein, carbs, fat")
          .eq("user_id", user.id)
          .gte("logged_at", start)
          .lt("logged_at", end),
        supabase
          .from("weight_logs")
          .select("weight_lbs")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(1),
        supabase
          .from("steps_logs")
          .select("id, steps")
          .eq("user_id", user.id)
          .gte("logged_at", start)
          .lt("logged_at", end)
          .order("logged_at", { ascending: false })
          .limit(1),
      ]);

      if (profileRes.error) console.error("[Dashboard] profile fetch error:", profileRes.error);
      if (foodRes.error)    console.error("[Dashboard] food_logs fetch error:", foodRes.error);
      if (weightRes.error)  console.error("[Dashboard] weight_logs fetch error:", weightRes.error);
      if (stepsRes.error)   console.error("[Dashboard] steps_logs fetch error:", stepsRes.error);

      if (profileRes.data) {
        const streakData = streakRes.data ?? {};
        const lastStreakDate = (streakData as any).last_streak_date as string | null ?? null;
        const yesterday = yesterdayISO();

        // If the user didn't log food yesterday (or earlier), the streak is broken.
        let streakCount = (streakData as any).streak_count as number | null ?? null;
        if (lastStreakDate !== null && lastStreakDate < yesterday) {
          streakCount = 0;
          await supabase
            .from("profiles")
            .update({ streak_count: 0 })
            .eq("id", user!.id);
        }

        setProfile({
          ...(profileRes.data as Omit<Profile, "streak_count" | "last_streak_date">),
          streak_count: streakCount,
          last_streak_date: lastStreakDate,
        });
      }

      if (foodRes.data) {
        const t = foodRes.data.reduce(
          (acc: Totals, row: any) => ({
            calories: acc.calories + (row.calories || 0),
            protein: acc.protein + (row.protein || 0),
            carbs: acc.carbs + (row.carbs || 0),
            fat: acc.fat + (row.fat || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        setTotals(t);
      }

      if (weightRes.data?.[0]) setLatestWeightLbs(weightRes.data[0].weight_lbs);

      if (stepsRes.data?.[0]) setStepsToday(stepsRes.data[0].steps ?? 0);

      // Splash fade — record timestamp so tab-switching doesn't re-trigger
      markGreetingShown();
      splashTimer.current = setTimeout(() => {
        setSplashFading(true);
        setTimeout(() => setShowSplash(false), 500);
      }, 2000);
    }

    load();
    return () => {
      if (splashTimer.current) clearTimeout(splashTimer.current);
    };
  }, [user, authLoading]);

  // ── Streak update on food log ──────────────────────────────────────────────

  async function updateStreakOnFoodLog(userId: string) {
    if (!supabase) return;
    console.log("[Dashboard] updateStreakOnFoodLog called");

    // Re-fetch streak data to avoid stale closure issues
    const { data: streakData } = await supabase
      .from("profiles")
      .select("streak_count, last_streak_date")
      .eq("id", userId)
      .maybeSingle();

    console.log("[Dashboard] streak data from DB:", streakData);
    if (!streakData) return;

    const today = todayISO();
    const yesterday = yesterdayISO();
    const lastDate = (streakData as any).last_streak_date as string | null;

    if (lastDate === today) {
      console.log("[Dashboard] streak already counted for today, no update");
      return;
    }

    const newStreak = lastDate === yesterday
      ? ((streakData as any).streak_count as number ?? 0) + 1
      : 1;

    await supabase
      .from("profiles")
      .update({ streak_count: newStreak, last_streak_date: today })
      .eq("id", userId);

    setProfile((p) => p ? { ...p, streak_count: newStreak, last_streak_date: today } : p);
  }

  // ── Realtime food log updates ──────────────────────────────────────────────

  useEffect(() => {
    if (!user || !supabase) return;
    const { start, end } = todayRange();

    const channel = supabase
      .channel("dashboard-food-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "food_logs", filter: `user_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase
            .from("food_logs")
            .select("calories, protein, carbs, fat")
            .eq("user_id", user.id)
            .gte("logged_at", start)
            .lt("logged_at", end);
          if (data) {
            const t = data.reduce(
              (acc: Totals, row: any) => ({
                calories: acc.calories + (row.calories || 0),
                protein: acc.protein + (row.protein || 0),
                carbs: acc.carbs + (row.carbs || 0),
                fat: acc.fat + (row.fat || 0),
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );
            setTotals(t);
          }
          // Increment streak on first food log of the day
          await updateStreakOnFoodLog(user.id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Derived values ─────────────────────────────────────────────────────────

  // MFP-equivalent: ~151 cal for 5,000 steps at 223 lbs
  const stepsCalories = latestWeightLbs
    ? Math.round(stepsToday * 0.000135 * latestWeightLbs)
    : 0;
  const baseCalories = profile?.daily_calories ?? 0;
  const totalCaloriesAvailable = baseCalories + stepsCalories;

  // If no weight log exists yet, fall back to the starting weight from profile
  const displayWeight = latestWeightLbs ?? profile?.current_weight ?? null;
  const startingWeight = profile?.current_weight ?? null;
  const weightLost =
    startingWeight && latestWeightLbs
      ? +(startingWeight - latestWeightLbs).toFixed(1)
      : startingWeight
      ? 0
      : null;

  // ── Log Steps ─────────────────────────────────────────────────────────────

  async function handleLogSteps(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !supabase || !stepsInput) return;
    setSavingSteps(true);

    const { start, end } = todayRange();
    const steps = Number(stepsInput);

    // Check if an entry already exists for today
    const { data: existing } = await supabase
      .from("steps_logs")
      .select("id")
      .eq("user_id", user.id)
      .gte("logged_at", start)
      .lt("logged_at", end)
      .limit(1);

    const existingId = existing?.[0]?.id;
    const now = new Date().toISOString();

    const { error } = existingId
      ? await supabase
          .from("steps_logs")
          .update({ steps, logged_at: now })
          .eq("id", existingId)
      : await supabase
          .from("steps_logs")
          .insert({ user_id: user.id, steps, logged_at: now });

    if (!error) {
      setStepsToday(steps);
      setStepsInput("");
      setShowStepsInput(false);
    }
    setSavingSteps(false);
  }

  // ── Complete Today ─────────────────────────────────────────────────────────

  function handleCompleteToday() {
    if (!profile) return;
    const consumed = totals.calories;
    const goal = totalCaloriesAvailable;
    const { grade, gradeColor, headline, explanation } = calcGrade(consumed, goal, totals, profile);
    const deficit = goal - consumed;
    setCompletionResult({ grade, gradeColor, deficit, consumed, goal, headline, explanation });
    setShowCelebration(true);
  }

  function handleUndo() {
    setShowCelebration(false);
    setCompletionResult(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Splash ── */}
      {showSplash && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-slate-950"
          style={{ opacity: splashFading ? 0 : 1, transition: "opacity 0.5s ease" }}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            TrackRight
          </p>
          <h1 className="mb-2 text-3xl font-bold text-white">
            {greeting()}{profile?.first_name ? `, ${profile.first_name}` : ""}.
          </h1>
          <p className="text-base text-slate-400">
            Your goal today is{" "}
            <span className="font-semibold text-emerald-400">
              {totalCaloriesAvailable > 0 ? totalCaloriesAvailable : (profile?.daily_calories ?? "—")} cal
            </span>
          </p>
        </div>
      )}

      {/* ── Celebration overlay ── */}
      {showCelebration && completionResult && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/90 px-6">
          <Fireworks />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-slate-900 px-6 py-8 text-center ring-1 ring-slate-700">
            <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Day Complete!
            </p>
            <div className={`my-4 text-8xl font-black ${completionResult.gradeColor}`}>
              {completionResult.grade}
            </div>
            <p className="text-lg font-semibold text-white">
              {completionResult.headline}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {completionResult.explanation}
            </p>
            <p className="mt-3 text-xs text-slate-600">
              {completionResult.consumed.toFixed(0)} consumed · {completionResult.goal.toFixed(0)} goal
              {completionResult.deficit !== 0 && (
                <> · {completionResult.deficit > 0
                  ? `${completionResult.deficit.toFixed(0)} cal deficit`
                  : `${Math.abs(completionResult.deficit).toFixed(0)} cal surplus`}
                </>
              )}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCelebration(false)}
                className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Awesome!
              </button>
              <button
                onClick={handleUndo}
                className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800"
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main dashboard ── */}
      <div className="flex flex-col gap-4 pb-6">
        {/* A) Header */}
        <header className="flex items-center justify-between pt-2">
          <h1 className="text-xl font-bold text-white">TrackRight</h1>
          <div className="flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3 py-1.5 ring-1 ring-slate-700">
            <span className="text-base leading-none">🔥</span>
            <span className="text-sm font-bold text-white">
              {profile?.streak_count ?? 0}
            </span>
            <span className="text-xs text-slate-400">day streak</span>
          </div>
        </header>

        {/* B) Calorie ring — taps to Log Food */}
        <section
          className="rounded-3xl bg-slate-900 px-4 py-6 ring-1 ring-slate-800 cursor-pointer hover:ring-slate-600 transition-colors"
          onClick={() => router.push("/log")}
          role="button"
          aria-label="Go to food log"
        >
          <CalorieRing
            consumed={totals.calories}
            goal={baseCalories}
            stepsCalories={stepsCalories}
          />
        </section>

        {/* C) Macros row */}
        <section className="grid grid-cols-3 gap-2">
          {(
            [
              {
                label: "Protein",
                value: totals.protein,
                goal: profile?.daily_protein ?? 0,
                color: "bg-sky-500",
                text: "text-sky-400",
              },
              {
                label: "Carbs",
                value: totals.carbs,
                goal: profile?.daily_carbs ?? 0,
                color: "bg-yellow-400",
                text: "text-yellow-400",
              },
              {
                label: "Fat",
                value: totals.fat,
                goal: profile?.daily_fat ?? 0,
                color: "bg-rose-500",
                text: "text-rose-400",
              },
            ] as const
          ).map(({ label, value, goal, color, text }) => {
            const remaining = Math.max(0, goal - value);
            const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
            return (
              <div
                key={label}
                className="flex flex-col gap-2 rounded-2xl bg-slate-900 px-3 py-3 ring-1 ring-slate-800"
              >
                <p className={`text-xs font-semibold ${text}`}>{label}</p>
                <p className="text-xl font-bold text-white leading-none">
                  {remaining.toFixed(0)}
                  <span className="ml-0.5 text-xs font-normal text-slate-500">g left</span>
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">{value.toFixed(0)} / {goal}g</p>
              </div>
            );
          })}
        </section>

        {/* D) Today's stats row — both cards tap to Progress */}
        <section className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push("/progress")}
            className="rounded-2xl bg-slate-900 px-4 py-4 ring-1 ring-slate-800 text-left hover:ring-slate-600 transition-colors"
          >
            <p className="text-xs font-medium text-slate-400">Current Weight</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {displayWeight != null ? displayWeight.toFixed(1) : "—"}
              {displayWeight != null && (
                <span className="ml-1 text-sm font-normal text-slate-400">lbs</span>
              )}
            </p>
          </button>
          <button
            onClick={() => router.push("/progress")}
            className="rounded-2xl bg-slate-900 px-4 py-4 ring-1 ring-slate-800 text-left hover:ring-slate-600 transition-colors"
          >
            <p className="text-xs font-medium text-slate-400">Total Lost</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {weightLost !== null ? Math.abs(weightLost).toFixed(1) : "—"}
              {weightLost !== null && (
                <span className="ml-1 text-sm font-normal text-slate-400">lbs</span>
              )}
            </p>
            {weightLost !== null && weightLost > 0 && (
              <p className="mt-0.5 text-[10px] text-emerald-400">▼ lost so far</p>
            )}
            {weightLost === 0 && (
              <p className="mt-0.5 text-[10px] text-slate-500">start logging to track</p>
            )}
          </button>
        </section>

        {/* E) Exercise calories */}
        <section className="rounded-2xl bg-slate-900 px-4 py-4 ring-1 ring-slate-800">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Calorie Budget
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-slate-500">Base</p>
              <p className="text-base font-bold text-white">{baseCalories}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Steps earned</p>
              <p className="text-base font-bold text-emerald-400">+{stepsCalories}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Total</p>
              <p className="text-base font-bold text-white">{totalCaloriesAvailable}</p>
            </div>
          </div>
          {showStepsInput ? (
            <form onSubmit={handleLogSteps} className="mt-3 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Steps today"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                autoFocus
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={savingSteps || !stepsInput}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {savingSteps ? "…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setShowStepsInput(false); setStepsInput(""); }}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-base">👟</span>
                <span className="text-sm font-semibold text-white">
                  {stepsToday.toLocaleString()} steps today
                </span>
              </div>
              <button
                onClick={() => setShowStepsInput(true)}
                className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-600"
              >
                Log Steps
              </button>
            </div>
          )}
        </section>

        {/* F) Complete Today */}
        <button
          onClick={handleCompleteToday}
          className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98] transition-transform"
        >
          Complete Today ✓
        </button>
      </div>
    </>
  );
}
