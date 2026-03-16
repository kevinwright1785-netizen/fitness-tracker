"use client";

import { BottomNav } from "@/components/BottomNav";
import { WeightStepsModule } from "@/components/WeightStepsModule";

export default function WeightStepsPage() {
  return (
    <>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <WeightStepsModule />
      </main>
      <BottomNav />
    </>
  );
}

