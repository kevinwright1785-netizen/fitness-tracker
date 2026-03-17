"use client";

import { WeightStepsModule } from "@/components/WeightStepsModule";
import { BottomNav } from "@/components/BottomNav";

export default function ProgressPage() {
  return (
    <>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <WeightStepsModule />
      </main>
      <BottomNav />
    </>
  );
}
