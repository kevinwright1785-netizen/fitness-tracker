import { FoodLogSection } from "@/components/FoodLogSection";
import { BottomNav } from "@/components/BottomNav";

export default function LogPage() {
  return (
    <>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <header className="mt-2">
          <h1 className="text-xl font-bold text-white">Log Food</h1>
          <p className="text-xs text-slate-400">Add what you ate today.</p>
        </header>
        <FoodLogSection />
      </main>
      <BottomNav />
    </>
  );
}
