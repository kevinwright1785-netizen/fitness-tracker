"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthContext";
import { calculateAge, calculateMacros, calculateTDEE, GoalType, ActivityLevel } from "@/lib/goals";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function OnboardingPage() {
  const { user, completeOnboarding } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [dob, setDob] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const dobDayRef = useRef<HTMLInputElement>(null);
  const dobYearRef = useRef<HTMLInputElement>(null);
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("8");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [goal, setGoal] = useState<GoalType>("maintain");
  const [currentWeight, setCurrentWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [weeklyPace, setWeeklyPace] = useState("1");
  const [activity, setActivity] = useState<ActivityLevel>("sedentary");
  const [saving, setSaving] = useState(false);
  const [saveAttempts, setSaveAttempts] = useState(0);
  const [fatalError, setFatalError] = useState(false);
  const [dailyCalories, setDailyCalories] = useState<number | null>(null);
  const [dailyProtein, setDailyProtein] = useState<number | null>(null);
  const [dailyCarbs, setDailyCarbs] = useState<number | null>(null);
  const [dailyFat, setDailyFat] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    if (step !== 6) return;

    async function syncSummary() {
      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_calories, daily_protein, daily_carbs, daily_fat")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && profile.daily_calories) {
        setDailyCalories(profile.daily_calories);
        setDailyProtein(profile.daily_protein);
        setDailyCarbs(profile.daily_carbs);
        setDailyFat(profile.daily_fat);
      } else {
        const { tdee, macros } = computeGoals();
        const summaryRecord = {
          id: user.id,
          daily_calories: tdee,
          daily_protein: macros.protein,
          daily_carbs: macros.carbs,
          daily_fat: macros.fat
        };
        console.log("[Onboarding] syncSummary inserting:", summaryRecord);
        const { data: sd, error: se } = await supabase
          .from("profiles")
          .insert(summaryRecord);
        console.log("[Onboarding] syncSummary insert response:", { data: sd, error: se });
        setDailyCalories(tdee);
        setDailyProtein(macros.protein);
        setDailyCarbs(macros.carbs);
        setDailyFat(macros.fat);
      }
    }

    syncSummary().catch((err) =>
      console.error("[Onboarding] syncSummary threw:", err)
    );
  }, [user, step]);

  useEffect(() => {
    if (dobMonth.length === 2 && dobDay.length === 2 && dobYear.length === 4) {
      setDob(`${dobYear}-${dobMonth}-${dobDay}`);
    } else {
      setDob("");
    }
  }, [dobMonth, dobDay, dobYear]);

  if (!user) {
    return null;
  }

  if (fatalError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
        <p className="text-sm text-slate-400">
          We weren&apos;t able to save your profile after several attempts. This
          can happen if your account was removed or a permissions issue occurred.
        </p>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          className="mt-2 rounded-2xl bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-400 ring-1 ring-red-500/40 hover:bg-red-500/20"
        >
          Start Over
        </button>
      </main>
    );
  }

  function nextStep() {
    if (step === 3 && goal === "maintain") {
      setStep(5);
    } else if (step === 4 && goal === "lose") {
      setStep(5);
    } else {
      setStep((s) => Math.min(6, s + 1) as Step);
    }
  }

  function prevStep() {
    if (step === 5 && goal === "maintain") {
      setStep(3);
    } else if (step === 5 && goal === "lose") {
      setStep(4);
    } else {
      setStep((s) => Math.max(1, s - 1) as Step);
    }
  }

  function computeGoals() {
    const heightCm =
      Number(heightFt) * 30.48 + Number(heightIn) * 2.54;
    const weightLbs =
      goal === "lose" && currentWeight
        ? Number(currentWeight)
        : goal === "maintain" && currentWeight
        ? Number(currentWeight)
        : 170;
    const age = dob ? calculateAge(dob) : 30;

    const tdee = calculateTDEE({
      gender,
      weightLbs,
      heightCm,
      age,
      activity,
      goal,
      weeklyPaceLbs: goal === "lose" ? Number(weeklyPace) : null
    });
    const macros = calculateMacros(tdee, goal);

    setDailyCalories(tdee);
    setDailyProtein(macros.protein);
    setDailyCarbs(macros.carbs);
    setDailyFat(macros.fat);

    return { tdee, macros };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    setSaving(true);

    const { tdee, macros } = computeGoals();

    const payload = {
      id: user.id,
      first_name: firstName || null,
      dob: dob || null,
      height_ft: Number(heightFt),
      height_in: Number(heightIn),
      gender,
      goal,
      current_weight: currentWeight ? Number(currentWeight) : null,
      goal_weight: goalWeight ? Number(goalWeight) : null,
      weekly_pace: goal === "lose" ? Number(weeklyPace) : null,
      activity_level: activity,
      daily_calories: tdee,
      daily_protein: macros.protein,
      daily_carbs: macros.carbs,
      daily_fat: macros.fat,
      onboarding_complete: true
    };

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    console.log("[Onboarding] getUser result:", { authUser, authError });
    if (!authUser) {
      console.error("[Onboarding] No authenticated user — aborting insert.");
      setSaving(false);
      return;
    }

    const record = { ...payload, id: authUser.id };
    console.log("[Onboarding] Inserting record:", JSON.stringify(record, null, 2));

    const { data: upsertData, error: upsertError } = await supabase
      .from("profiles")
      .upsert(record, { onConflict: "id" });

    console.log("[Onboarding] Upsert response:", { data: upsertData, error: upsertError });

    if (upsertError) {
      console.error("[Onboarding] Upsert failed:", {
        message: upsertError.message,
        code: (upsertError as any).code,
        details: (upsertError as any).details,
        hint: (upsertError as any).hint,
      });
      const attempts = saveAttempts + 1;
      setSaveAttempts(attempts);
      if (attempts >= 3) {
        setFatalError(true);
      }
      setSaving(false);
      return;
    }

    console.log("[Onboarding] Profile upserted successfully.");
    setSaving(false);
    completeOnboarding();
    router.replace("/");
  }

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        {step === 1 && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="mb-2 text-3xl font-semibold text-white">
              TrackRight
            </h1>
            <p className="mb-6 text-sm text-slate-400">
              A simple way to track food, weight, and progress.
            </p>
            <button
              type="button"
              onClick={nextStep}
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
            >
              Get Started
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Tell us about you
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Date of birth
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM"
                    maxLength={2}
                    value={dobMonth}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setDobMonth(val);
                      if (val.length === 2) dobDayRef.current?.focus();
                    }}
                    className="w-14 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-slate-500">/</span>
                  <input
                    ref={dobDayRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="DD"
                    maxLength={2}
                    value={dobDay}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setDobDay(val);
                      if (val.length === 2) dobYearRef.current?.focus();
                    }}
                    className="w-14 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-slate-500">/</span>
                  <input
                    ref={dobYearRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY"
                    maxLength={4}
                    value={dobYear}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setDobYear(val);
                    }}
                    className="w-20 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    Height
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {[4, 5, 6, 7].map((ft) => (
                        <option key={ft} value={ft}>
                          {ft} ft
                        </option>
                      ))}
                    </select>
                    <select
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i}>
                          {i} in
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) =>
                    setGender(e.target.value as "male" | "female" | "other")
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              What&apos;s your goal?
            </h2>
            <div className="space-y-3 text-sm">
              <button
                type="button"
                onClick={() => setGoal("maintain")}
                className={`w-full rounded-3xl border px-4 py-4 text-left ${
                  goal === "maintain"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="text-sm font-semibold text-white">
                  Maintain Weight
                </div>
                <p className="text-xs text-slate-400">
                  Keep your current weight steady.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setGoal("lose")}
                className={`w-full rounded-3xl border px-4 py-4 text-left ${
                  goal === "lose"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="text-sm font-semibold text-white">
                  Lose Weight
                </div>
                <p className="text-xs text-slate-400">
                  Aim for a steady, healthy loss.
                </p>
              </button>
            </div>
          </section>
        )}

        {step === 4 && goal === "lose" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Weight details
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Current weight (lbs)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Goal weight (lbs)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Weekly loss pace (lbs/week)
                </label>
                <div className="flex gap-2 overflow-x-auto text-[11px]">
                  {["0.5", "1", "1.5", "2"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setWeeklyPace(p)}
                      className={`whitespace-nowrap rounded-2xl px-3 py-2 ${
                        weeklyPace === p
                          ? "bg-emerald-500 text-slate-950 font-semibold"
                          : "bg-slate-900 text-slate-300"
                      }`}
                    >
                      {p} lbs/week
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Activity level
            </h2>
            <div className="space-y-3 text-sm">
              <button
                type="button"
                onClick={() => setActivity("sedentary")}
                className={`w-full rounded-3xl border px-4 py-3 text-left ${
                  activity === "sedentary"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="text-sm font-semibold text-white">
                  Sedentary
                </div>
                <p className="text-xs text-slate-400">
                  Little or no exercise.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setActivity("light")}
                className={`w-full rounded-3xl border px-4 py-3 text-left ${
                  activity === "light"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="text-sm font-semibold text-white">
                  Lightly Active
                </div>
                <p className="text-xs text-slate-400">
                  Light exercise 1-3 days/week.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setActivity("moderate")}
                className={`w-full rounded-3xl border px-4 py-3 text-left ${
                  activity === "moderate"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="text-sm font-semibold text-white">
                  Moderately Active
                </div>
                <p className="text-xs text-slate-400">
                  Moderate exercise 3-5 days/week.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setActivity("very")}
                className={`w-full rounded-3xl border px-4 py-3 text-left ${
                  activity === "very"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="text-sm font-semibold text-white">
                  Very Active
                </div>
                <p className="text-xs text-slate-400">
                  Hard exercise 6-7 days/week.
                </p>
              </button>
            </div>
          </section>
        )}

        {step === 6 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Your daily targets
            </h2>
            <p className="text-xs text-slate-400">
              Based on your info, here&apos;s what TrackRight suggests.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-3xl bg-slate-900 px-4 py-3">
                <p className="text-xs text-slate-400">Calories</p>
                <p className="text-lg font-semibold text-emerald-400">
                  {dailyCalories ?? "-"}{" "}
                  <span className="text-xs text-slate-400">/ day</span>
                </p>
              </div>
              <div className="rounded-3xl bg-slate-900 px-4 py-3">
                <p className="text-xs text-slate-400">Protein</p>
                <p className="text-lg font-semibold text-emerald-400">
                  {dailyProtein ?? "-"} g
                </p>
              </div>
              <div className="rounded-3xl bg-slate-900 px-4 py-3">
                <p className="text-xs text-slate-400">Carbs</p>
                <p className="text-lg font-semibold text-sky-400">
                  {dailyCarbs ?? "-"} g
                </p>
              </div>
              <div className="rounded-3xl bg-slate-900 px-4 py-3">
                <p className="text-xs text-slate-400">Fat</p>
                <p className="text-lg font-semibold text-amber-400">
                  {dailyFat ?? "-"} g
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-400">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="rounded-2xl px-3 py-2 text-xs font-medium text-slate-300"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < 6 && (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
            >
              Next
            </button>
          )}
          {step === 6 && (
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Let's Go!"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

