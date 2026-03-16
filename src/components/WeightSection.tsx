"use client";

import { useEffect, useState, FormEvent } from "react";
import { Card } from "./Card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";

export function WeightSection() {
  const { user } = useAuth();
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [latest, setLatest] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    async function load() {
      const { data } = await supabase
        .from("weight_logs")
        .select("weight_lbs, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLatest(data[0].weight_lbs);
      }
    }
    load();
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabase || !weight) return;
    setSaving(true);
    const { error } = await supabase.from("weight_logs").insert({
      user_id: user.id,
      weight_lbs: Number(weight),
      logged_at: new Date().toISOString()
    });
    if (!error) {
      setLatest(Number(weight));
      setWeight("");
    }
    setSaving(false);
  }

  return (
    <Card title="Weight tracking">
      <form className="mb-3 flex gap-2" onSubmit={onSubmit}>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Today's weight"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={saving || !user}
          className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-white active:bg-slate-200 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Log"}
        </button>
      </form>

      <div className="space-y-1 text-xs text-slate-400">
        {latest !== null ? (
          <p>
            Last logged weight:{" "}
            <span className="font-semibold text-slate-100">
              {latest.toFixed(1)} lbs
            </span>
          </p>
        ) : (
          <p>No weight logged yet for this account.</p>
        )}
        <p>
          On iPhone, you can install this PWA to your home screen and quickly
          log your weight each morning.
        </p>
      </div>
    </Card>
  );
}

