"use client";

import { useState, useEffect, FormEvent } from "react";
import { Card } from "./Card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";

type RangeKey = "7d" | "14d" | "30d" | "365d";

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "14d", label: "Last 14 days" },
  { key: "30d", label: "Last month" },
  { key: "365d", label: "Last year" }
];

type Point = { date: string; value: number };

function rangeToDays(range: RangeKey): number {
  switch (range) {
    case "7d":
      return 7;
    case "14d":
      return 14;
    case "30d":
      return 30;
    case "365d":
      return 365;
  }
}

export function WeightStepsModule() {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("7d");
  const [weightInput, setWeightInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [weightPoints, setWeightPoints] = useState<Point[]>([]);
  const [stepPoints, setStepPoints] = useState<Point[]>([]);

  useEffect(() => {
    if (!user || !supabase) return;
    const days = rangeToDays(range);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);

    async function load() {
      const [weightsRes, stepsRes] = await Promise.all([
        supabase
          .from("weight_logs")
          .select("weight_lbs, logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", from.toISOString())
          .lte("logged_at", to.toISOString())
          .order("logged_at", { ascending: true }),
        supabase
          .from("steps_logs")
          .select("steps, created_at")
          .eq("user_id", user.id)
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString())
          .order("created_at", { ascending: true })
      ]);

      if (weightsRes.data) {
        setWeightPoints(
          weightsRes.data.map((row: any) => ({
            date: row.logged_at,
            value: row.weight_lbs
          }))
        );
      }
      if (stepsRes.data) {
        setStepPoints(
          stepsRes.data.map((row: any) => ({
            date: row.created_at,
            value: row.steps
          }))
        );
      }
    }

    load();
  }, [user, range]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabase) return;
    if (!weightInput && !stepsInput) return;
    setSaving(true);

    const promises: Promise<any>[] = [];
    if (weightInput) {
      promises.push(
        supabase.from("weight_logs").insert({
          user_id: user.id,
          weight_lbs: Number(weightInput),
          logged_at: new Date().toISOString()
        })
      );
    }
    if (stepsInput) {
      promises.push(
        supabase.from("steps_logs").insert({
          user_id: user.id,
          steps: Number(stepsInput)
        })
      );
    }

    await Promise.all(promises);
    setWeightInput("");
    setStepsInput("");
    setSaving(false);

    const currentRange = range;
    setRange(currentRange);
  }

  function renderBars(points: Point[]) {
    if (!points.length) {
      return (
        <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
          No data in this range yet.
        </div>
      );
    }
    const max = Math.max(...points.map((p) => p.value)) || 1;
    return (
      <div className="flex h-full items-end gap-1 px-2 pb-2">
        {points.map((p, idx) => (
          <div
            key={`${p.date}-${idx}`}
            className="flex-1 rounded-t-full bg-emerald-500/80"
            style={{ height: `${(p.value / max) * 100}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="mt-2">
        <h1 className="text-xl font-semibold text-white">Weight & Steps</h1>
        <p className="text-xs text-slate-400">
          Log your weight and steps, then see simple trends.
        </p>
      </header>

      <Card title="Today">
        <form
          className="grid grid-cols-2 gap-2 text-sm"
          onSubmit={onSubmit}
        >
          <input
            type="number"
            inputMode="decimal"
            placeholder="Weight (lbs)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Steps"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={saving || !user}
            className="col-span-2 mt-1 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </Card>

      <Card title="Trends">
        <div className="mb-3 flex gap-1 overflow-x-auto text-[11px]">
          {rangeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={`whitespace-nowrap rounded-2xl px-3 py-1 ${
                range === opt.key
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : "bg-slate-900 text-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs text-slate-300">Weight</p>
            <div className="h-32 rounded-2xl bg-slate-900/70 ring-1 ring-slate-800">
              {renderBars(weightPoints)}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-300">Steps</p>
            <div className="h-32 rounded-2xl bg-slate-900/70 ring-1 ring-slate-800">
              {renderBars(stepPoints)}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900/80 p-3 text-xs text-slate-300 ring-1 ring-slate-800">
            <p className="mb-1 text-[11px] font-semibold text-emerald-400">
              AI trend summary
            </p>
            <p>
              This section can call the Anthropic API with your weight and steps
              data to generate a short summary for the selected range.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

