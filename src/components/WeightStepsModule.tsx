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
  { key: "365d", label: "Last year" },
];

type Point = { date: string; value: number };

function rangeToDays(range: RangeKey): number {
  switch (range) {
    case "7d": return 7;
    case "14d": return 14;
    case "30d": return 30;
    case "365d": return 365;
  }
}

export function WeightStepsModule() {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("7d");
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [weightPoints, setWeightPoints] = useState<Point[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  // Pre-fill with most recent weight_logs entry
  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from("weight_logs")
      .select("weight_lbs")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .limit(1)
      .then(({ data }: { data: any }) => {
        if (data?.[0]) setWeightInput(String(data[0].weight_lbs));
      });
  }, [user]);

  // Load weight chart data
  useEffect(() => {
    if (!user || !supabase) return;
    const days = rangeToDays(range);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);

    supabase
      .from("weight_logs")
      .select("weight_lbs, logged_at")
      .eq("user_id", user.id)
      .gte("logged_at", from.toISOString())
      .lte("logged_at", to.toISOString())
      .order("logged_at", { ascending: true })
      .then(({ data }: { data: any }) => {
        if (data) {
          setWeightPoints(
            data.map((row: any) => ({ date: row.logged_at, value: row.weight_lbs }))
          );
        }
      });
  }, [user, range, reloadToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabase || !weightInput) return;
    setSaving(true);
    setSavedMessage(null);

    const { error } = await supabase.from("weight_logs").insert({
      user_id: user.id,
      weight_lbs: Number(weightInput),
      logged_at: new Date().toISOString(),
    });

    if (!error) {
      setSavedMessage(`Weight saved as ${weightInput} lbs`);
      setReloadToken((t) => t + 1);
    }
    setSaving(false);
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
    const min = Math.min(...points.map((p) => p.value));
    // Use a floor so small changes are visible (show relative to min - 5 lbs)
    const floor = Math.max(0, min - 5);
    const range_ = max - floor || 1;
    return (
      <div className="flex h-full items-end gap-1 px-2 pb-2">
        {points.map((p, idx) => (
          <div
            key={`${p.date}-${idx}`}
            className="flex-1 rounded-t-full bg-emerald-500/80"
            style={{ height: `${((p.value - floor) / range_) * 100}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="mt-2">
        <h1 className="text-xl font-semibold text-white">Progress</h1>
        <p className="text-xs text-slate-400">Log your weight and track your trend.</p>
      </header>

      <Card title="Log Today's Weight">
        <form className="space-y-2" onSubmit={onSubmit}>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Weight (lbs)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={saving || !user || !weightInput}
            className="w-full rounded-2xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Weight"}
          </button>
        </form>
        {savedMessage && (
          <p className="mt-2 text-xs text-emerald-400">✓ {savedMessage}</p>
        )}
      </Card>

      <Card title="Weight Trend">
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
        <div className="h-40 rounded-2xl bg-slate-900/70 ring-1 ring-slate-800">
          {renderBars(weightPoints)}
        </div>
      </Card>
    </>
  );
}
