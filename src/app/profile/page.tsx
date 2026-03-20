"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthContext";
import { calculateMacros, calculateTDEE, GoalType, ActivityLevel, calculateAge } from "@/lib/goals";

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [dob, setDob] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [goal, setGoal] = useState<GoalType>("maintain");
  const [weeklyPace, setWeeklyPace] = useState("1");
  const [activity, setActivity] = useState<ActivityLevel>("sedentary");

  // Calculated / display-only
  const [dailyCalories, setDailyCalories] = useState("");
  const [dailyProtein, setDailyProtein] = useState("");
  const [dailyCarbs, setDailyCarbs] = useState("");
  const [dailyFat, setDailyFat] = useState("");

  // Editable weight goal
  const [goalWeight, setGoalWeight] = useState("");

  // Read-only weight stats
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [latestWeightLbs, setLatestWeightLbs] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    async function load() {
      const [profileRes, weightRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "first_name, dob, height_ft, height_in, gender, goal, current_weight, goal_weight, weekly_pace, activity_level, daily_calories, daily_protein, daily_carbs, daily_fat"
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("weight_logs")
          .select("weight_lbs")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(1),
      ]);

      const data = profileRes.data;
      if (data) {
        setFirstName(data.first_name || "");
        setDob(data.dob || "");
        setHeightFt(data.height_ft ? String(data.height_ft) : "");
        setHeightIn(data.height_in ? String(data.height_in) : "");
        setGender((data.gender as any) || "");
        setGoal((data.goal as GoalType) || "maintain");
        setWeeklyPace(data.weekly_pace ? String(data.weekly_pace) : "1");
        setActivity((data.activity_level as ActivityLevel) || "sedentary");
        setDailyCalories(data.daily_calories ? String(data.daily_calories) : "");
        setDailyProtein(data.daily_protein ? String(data.daily_protein) : "");
        setDailyCarbs(data.daily_carbs ? String(data.daily_carbs) : "");
        setDailyFat(data.daily_fat ? String(data.daily_fat) : "");
        setStartingWeight(data.current_weight ?? null);
        setGoalWeight(data.goal_weight ? String(data.goal_weight) : "");
      }

      if (weightRes.data?.[0]) {
        setLatestWeightLbs(weightRes.data[0].weight_lbs);
      }
    }
    load();
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabase) return;
    setSaving(true);
    setMessage(null);

    const heightCm = Number(heightFt || 0) * 30.48 + Number(heightIn || 0) * 2.54;
    // Use most recent weight log entry; fall back to starting weight if none exists
    const weightLbs = latestWeightLbs ?? startingWeight ?? 170;
    const age = dob ? calculateAge(dob) : 30;

    const tdee = calculateTDEE({
      gender: (gender || "male") as any,
      weightLbs,
      heightCm,
      age,
      activity,
      goal,
      weeklyPaceLbs: goal === "lose" ? Number(weeklyPace || "1") : null,
    });
    const macros = calculateMacros(tdee, goal);

    setDailyCalories(String(tdee));
    setDailyProtein(String(macros.protein));
    setDailyCarbs(String(macros.carbs));
    setDailyFat(String(macros.fat));

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        first_name: firstName || null,
        dob: dob || null,
        height_ft: heightFt ? Number(heightFt) : null,
        height_in: heightIn ? Number(heightIn) : null,
        gender: gender || null,
        goal,
        goal_weight: goalWeight ? Number(goalWeight) : null,
        weekly_pace: goal === "lose" ? Number(weeklyPace || "1") : null,
        activity_level: activity,
        daily_calories: tdee,
        daily_protein: macros.protein,
        daily_carbs: macros.carbs,
        daily_fat: macros.fat,
      },
      { onConflict: "id" }
    );

    setMessage(error ? error.message : "Profile saved.");
    setSaving(false);
  }

  const currentWeightDisplay = latestWeightLbs ?? startingWeight;

  // ── DOB helpers (three-select approach avoids iOS date input overflow) ────
  const dobParts = dob ? dob.split("-") : ["", "", ""];
  const dobYear  = dobParts[0] || "";
  const dobMonth = dobParts[1] || "";
  const dobDay   = dobParts[2] || "";

  function handleDobPart(year: string, month: string, day: string) {
    setDob(year && month && day ? `${year}-${month}-${day}` : "");
  }

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1923 }, (_, i) => currentYear - i);

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <header className="mt-2">
          <h1 className="text-xl font-semibold text-white">Profile</h1>
          <p className="text-xs text-slate-400">View and adjust your TrackRight goals.</p>
        </header>

        {/* Weight stats — read only */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Starting Weight", value: startingWeight },
            { label: "Current Weight", value: currentWeightDisplay },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-slate-900 px-3 py-3 ring-1 ring-slate-800">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="mt-1 text-base font-bold text-white">
                {value != null ? value.toFixed(1) : "—"}
              </p>
              <p className="text-[10px] text-slate-500">lbs</p>
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs text-slate-300">First name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">Date of birth</label>
            <div className="flex gap-2">
              <select
                value={dobMonth}
                onChange={(e) => handleDobPart(dobYear, e.target.value, dobDay)}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Month</option>
                {months.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
              <select
                value={dobDay}
                onChange={(e) => handleDobPart(dobYear, dobMonth, e.target.value)}
                className="w-20 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                  <option key={d} value={d}>{Number(d)}</option>
                ))}
              </select>
              <select
                value={dobYear}
                onChange={(e) => handleDobPart(e.target.value, dobMonth, dobDay)}
                className="w-24 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">Height</label>
            <div className="flex gap-2">
              <select
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">ft</option>
                {[4, 5, 6, 7].map((ft) => (
                  <option key={ft} value={ft}>{ft} ft</option>
                ))}
              </select>
              <select
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">in</option>
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>{i} in</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-300">Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as GoalType)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="maintain">Maintain weight</option>
                <option value="lose">Lose weight</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">Goal weight (lbs)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 185"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">Weekly pace (lbs/week)</label>
              <input
                type="number"
                inputMode="decimal"
                value={weeklyPace}
                onChange={(e) => setWeeklyPace(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">Activity level</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Lightly Active</option>
              <option value="moderate">Moderately Active</option>
              <option value="very">Very Active</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div className="rounded-2xl bg-slate-900 px-3 py-2">
              <p className="text-[11px] text-slate-400">Daily calories</p>
              <p className="text-sm font-semibold text-emerald-400">{dailyCalories || "—"} kcal</p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-3 py-2">
              <p className="text-[11px] text-slate-400">Protein</p>
              <p className="text-sm font-semibold text-emerald-400">{dailyProtein || "—"} g</p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-3 py-2">
              <p className="text-[11px] text-slate-400">Carbs</p>
              <p className="text-sm font-semibold text-sky-400">{dailyCarbs || "—"} g</p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-3 py-2">
              <p className="text-[11px] text-slate-400">Fat</p>
              <p className="text-sm font-semibold text-amber-400">{dailyFat || "—"} g</p>
            </div>
          </div>

          {message && <p className="text-xs text-emerald-400">{message}</p>}

          <button
            type="submit"
            disabled={saving || !user}
            className="mt-1 w-full rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>

        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          className="mt-2 w-full rounded-2xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-400 ring-1 ring-red-500/40 hover:bg-red-500/20"
        >
          Log Out
        </button>
      </main>

    </>
  );
}
