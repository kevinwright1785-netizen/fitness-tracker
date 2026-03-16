import { FoodLogSection } from "@/components/FoodLogSection";
import { MacrosSection } from "@/components/MacrosSection";
import { WeightSection } from "@/components/WeightSection";

export function Dashboard() {
  return (
    <>
      <header className="mt-2 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Fitness Tracker</h1>
          <p className="text-xs text-slate-400">
            Log food, track macros, and follow your weight.
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/40">
          PWA Ready
        </span>
      </header>

      <div className="mt-4 grid flex-1 grid-cols-1 gap-4">
        <MacrosSection />
        <FoodLogSection />
        <WeightSection />
      </div>
    </>
  );
}

