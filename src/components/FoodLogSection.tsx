import { Card } from "./Card";

export function FoodLogSection() {
  return (
    <Card title="Food log">
      <form className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Food (e.g. Chicken breast)"
            className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Protein"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Carbs"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Fats"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          type="button"
          className="mt-1 w-full rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 active:bg-emerald-500"
        >
          Add food
        </button>
      </form>

      <div className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
        <p className="text-slate-500">
          Your recent foods will appear here once Supabase is wired up.
        </p>
      </div>
    </Card>
  );
}

