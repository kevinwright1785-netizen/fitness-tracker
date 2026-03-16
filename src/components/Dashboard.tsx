"use client";

import { useState } from "react";
import Link from "next/link";
import { FoodLogSection } from "@/components/FoodLogSection";
import { MacrosSection } from "@/components/MacrosSection";
import { WeightSection } from "@/components/WeightSection";

export function Dashboard() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <>
      <header className="mt-2 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Fitness Tracker</h1>
          <p className="text-xs text-slate-400">
            Log food, track macros, and follow your weight.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="rounded-2xl bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-slate-700"
          >
            Profile
          </Link>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/40">
            PWA Ready
          </span>
        </div>
      </header>

      <div className="mt-4 grid flex-1 grid-cols-1 gap-4">
        <MacrosSection refreshToken={refreshToken} />
        <FoodLogSection onLogged={() => setRefreshToken((v) => v + 1)} />
        <WeightSection />
      </div>
    </>
  );
}

