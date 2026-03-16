import { Card } from "./Card";

export function WeightSection() {
  return (
    <Card title="Weight tracking">
      <form className="mb-3 flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder="Today's weight"
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-white active:bg-slate-200"
        >
          Log
        </button>
      </form>

      <div className="space-y-1 text-xs text-slate-400">
        <p>Your recent weigh-ins will show here.</p>
        <p>
          On iPhone, you can install this PWA to your home screen and quickly
          log your weight each morning.
        </p>
      </div>
    </Card>
  );
}

