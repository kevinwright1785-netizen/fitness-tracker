"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthContext";
import { BottomNav } from "@/components/BottomNav";

export default function ProfilePage() {
  const { user } = useAuth();
  const [height, setHeight] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [goalCalories, setGoalCalories] = useState("");
  const [goalProtein, setGoalProtein] = useState("");
  const [goalCarbs, setGoalCarbs] = useState("");
  const [goalFat, setGoalFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select(
          "height, gender, goal_calories, goal_protein, goal_carbs, goal_fat"
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setHeight(data.height ? String(data.height) : "");
        setGender((data.gender as any) || "");
        setGoalCalories(data.goal_calories ? String(data.goal_calories) : "");
        setGoalProtein(data.goal_protein ? String(data.goal_protein) : "");
        setGoalCarbs(data.goal_carbs ? String(data.goal_carbs) : "");
        setGoalFat(data.goal_fat ? String(data.goal_fat) : "");
      }
    }
    load();
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabase) return;
    setSaving(true);
    setMessage(null);

    const payload = {
      user_id: user.id,
      height: height ? Number(height) : null,
      gender: gender || null,
      goal_calories: goalCalories ? Number(goalCalories) : null,
      goal_protein: goalProtein ? Number(goalProtein) : null,
      goal_carbs: goalCarbs ? Number(goalCarbs) : null,
      goal_fat: goalFat ? Number(goalFat) : null
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Profile saved.");
    }
    setSaving(false);
  }

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <header className="mt-2">
          <h1 className="text-xl font-semibold text-white">Profile</h1>
          <p className="text-xs text-slate-400">
            Set your height and macro goals.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs text-slate-300">
              Height (inches)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
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
              <label className="mb-1 block text-xs text-slate-300">
                Daily calories
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={goalCalories}
                onChange={(e) => setGoalCalories(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                Protein (g)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={goalProtein}
                onChange={(e) => setGoalProtein(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                Carbs (g)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={goalCarbs}
                onChange={(e) => setGoalCarbs(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                Fat (g)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={goalFat}
                onChange={(e) => setGoalFat(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {message && (
            <p className="text-xs text-emerald-400">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !user}
            className="mt-1 w-full rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </main>
      <BottomNav />
    </>
  );
}

