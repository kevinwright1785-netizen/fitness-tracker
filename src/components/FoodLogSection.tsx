"use client";

import { useState, FormEvent } from "react";
import { Card } from "./Card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Mode = "search" | "barcode" | "manual";

type Props = {
  onLogged?: () => void;
};

export function FoodLogSection({ onLogged }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("manual");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabase) return;
    setError(null);
    if (!name.trim()) {
      setError("Food name is required.");
      return;
    }
    if (!calories) {
      setError("Calories is required.");
      return;
    }
    setSaving(true);

    const payload = {
      user_id: user.id,
      food_name: name.trim(),
      calories: Number(calories),
      protein: protein ? Number(protein) : null,
      carbs: carbs ? Number(carbs) : null,
      fat: fat ? Number(fat) : null,
      serving_size: null,
      serving_qty: null,
      source: mode,
      logged_at: new Date().toISOString()
    };

    console.log("[FoodLog] Saving food payload", payload);
    const { error } = await supabase.from("food_logs").insert(payload);
    if (error) {
      console.error("[FoodLog] Error saving food", error);
      setError(error.message);
    } else {
      console.log("[FoodLog] Saved food successfully");
      setName("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      onLogged?.();

      // Update streak — must run here because Dashboard may not be mounted
      console.log("[FoodLog] updateStreakOnFoodLog called");
      const today = todayISO();
      const yesterday = yesterdayISO();
      const { data: streakData } = await supabase
        .from("profiles")
        .select("streak_count, last_streak_date")
        .eq("id", user.id)
        .maybeSingle();
      console.log("[FoodLog] streak data from DB:", streakData);
      if (streakData) {
        const lastDate = (streakData as any).last_streak_date as string | null;
        if (lastDate === today) {
          console.log("[FoodLog] streak already counted for today, no update");
        } else {
          const newStreak = lastDate === yesterday ? ((streakData as any).streak_count ?? 0) + 1 : 1;
          await supabase
            .from("profiles")
            .update({ streak_count: newStreak, last_streak_date: today })
            .eq("id", user.id);
          console.log("[FoodLog] streak updated →", newStreak, "| last_streak_date:", today);
        }
      }
    }
    setSaving(false);
  }

  return (
    <Card title="Food log">
      <div className="mb-2 flex gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex-1 rounded-2xl px-3 py-1 ${
            mode === "search"
              ? "bg-emerald-500 text-slate-950 font-semibold"
              : "bg-slate-900 text-slate-300"
          }`}
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setMode("barcode")}
          className={`flex-1 rounded-2xl px-3 py-1 ${
            mode === "barcode"
              ? "bg-emerald-500 text-slate-950 font-semibold"
              : "bg-slate-900 text-slate-300"
          }`}
        >
          Barcode
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 rounded-2xl px-3 py-1 ${
            mode === "manual"
              ? "bg-emerald-500 text-slate-950 font-semibold"
              : "bg-slate-900 text-slate-300"
          }`}
        >
          Manual
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          required
          placeholder={
            mode === "manual"
              ? "Food name"
              : "Food name or scan result"
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <div className="grid grid-cols-4 gap-2">
          <input
            type="number"
            inputMode="decimal"
            required
            placeholder="Calories"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Protein"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Carbs"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Fat"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={saving || !user}
          className="mt-1 w-full rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add food"}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-slate-500">
        All three options save here; search and barcode modes can pre-fill these
        fields once you connect the external APIs.
      </p>
    </Card>
  );
}

