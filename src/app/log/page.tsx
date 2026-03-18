import { FoodLogPage } from "@/components/FoodLogPage";
import { BottomNav } from "@/components/BottomNav";

export default function LogPage() {
  return (
    <>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <FoodLogPage />
      </main>
      <BottomNav />
    </>
  );
}
