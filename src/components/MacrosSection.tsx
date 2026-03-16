"use client";

import { useEffect, useState } from "react";
import { Card } from "./Card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";

type Totals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Goals = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type Props = {
  refreshToken?: number;
};

export function MacrosSection({ refreshToken = 0 }: Props) {
  const { user } = useAuth();
  const [totals, setTotals] = useState<Totals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const [goals, setGoals] = useState<Goals>({
    calories: null,
    protein: null,
    carbs: null,
    fat: null
  });

  useEffect(() => {
    if (!user || !supabase) return;

    const now = new Date();
    const startLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const endLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    const start = startLocal.toISOString();
    const end = endLocal.toISOString();

    async function load() {
      console.log("[Macros] Loading totals", {
        userId: user.id,
        startLocal: startLocal.toString(),
        endLocal: endLocal.toString(),
        startIso: start,
        endIso: end
      });
      const { data: food } = await supabase
        .from("food_logs")
        .select("calories, protein, carbs, fat, user_id, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", start)
        .lt("logged_at", end);

      console.log("[Macros] Fetched food rows", food);

      if (food) {
        const totals = food.reduce(
          (acc, row: any) => {
            acc.calories += row.calories || 0;
            acc.protein += row.protein || 0;
            acc.carbs += row.carbs || 0;
            acc.fat += row.fat || 0;
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        setTotals(totals);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, height_inches, gender, goal_calories, goal_protein, goal_carbs, goal_fat, created_at"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        console.log("[Macros] Loaded profile goals", profile);
        setGoals({
          calories: profile.goal_calories,
          protein: profile.goal_protein,
          carbs: profile.goal_carbs,
          fat: profile.goal_fat
        });
      }
    }

    load();

    const channel = supabase
      .channel("food-logs-macros")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "food_logs",
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log("[Macros] Realtime INSERT received, reloading totals");
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshToken]);

  const caloriesPct =
    goals.calories && goals.calories > 0
      ? Math.min(100, (totals.calories / goals.calories) * 100)
      : 0;

  return (
    <Card title="Today's macros">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Calories</span>
          <span className="font-semibold text-emerald-400">
            {totals.calories.toFixed(0)}{" "}
            {goals.calories ? `/ ${goals.calories.toFixed(0)}` : ""} calories
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${caloriesPct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center">
            <p className="font-semibold text-emerald-400">Protein</p>
            <p>
              {totals.protein.toFixed(0)} g{" "}
              {goals.protein ? `/ ${goals.protein.toFixed(0)} g` : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center">
            <p className="font-semibold text-sky-400">Carbs</p>
            <p>
              {totals.carbs.toFixed(0)} g{" "}
              {goals.carbs ? `/ ${goals.carbs.toFixed(0)} g` : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center">
            <p className="font-semibold text-amber-400">Fats</p>
            <p>
              {totals.fat.toFixed(0)} g{" "}
              {goals.fat ? `/ ${goals.fat.toFixed(0)} g` : ""}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

