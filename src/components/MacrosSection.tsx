import { Card } from "./Card";

export function MacrosSection() {
  return (
    <Card title="Today's macros">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Calories</span>
          <span className="font-semibold text-emerald-400">0 / 2,000 calories</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800">
          <div className="h-full w-0 rounded-full bg-emerald-500" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center">
            <p className="font-semibold text-emerald-400">Protein</p>
            <p>0 / 150 g</p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center">
            <p className="font-semibold text-sky-400">Carbs</p>
            <p>0 / 200 g</p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center">
            <p className="font-semibold text-amber-400">Fats</p>
            <p>0 / 60 g</p>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          These values are placeholders. Once Supabase is connected, they will
          be calculated from your logged foods.
        </p>
      </div>
    </Card>
  );
}

