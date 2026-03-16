"use client";

import { useState } from "react";
import { Card } from "./Card";

type RangeKey = "7d" | "14d" | "30d" | "365d" | "custom";

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "14d", label: "Last 14 days" },
  { key: "30d", label: "Last month" },
  { key: "365d", label: "Last year" },
  { key: "custom", label: "Custom" }
];

export function WeightStepsModule() {
  const [range, setRange] = useState<RangeKey>("7d");

  return (
    <>
      <header className="mt-2">
        <h1 className="text-xl font-semibold text-white">Weight & Steps</h1>
        <p className="text-xs text-slate-400">
          Log your weight and steps, then see simple trends.
        </p>
      </header>

      <Card title="Today">
        <form className="grid grid-cols-2 gap-2 text-sm">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Weight (lbs)"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Steps"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            className="col-span-2 mt-1 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
          >
            Save
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
              {/* Placeholder for responsive weight chart */}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-300">Steps</p>
            <div className="h-32 rounded-2xl bg-slate-900/70 ring-1 ring-slate-800">
              {/* Placeholder for responsive steps chart */}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900/80 p-3 text-xs text-slate-300 ring-1 ring-slate-800">
            <p className="mb-1 text-[11px] font-semibold text-emerald-400">
              AI trend summary
            </p>
            <p>
              Once the Anthropic API key is configured, this section will show a
              short summary of how your weight and steps are trending for the
              selected range.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

