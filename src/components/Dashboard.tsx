"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FoodLogSection } from "@/components/FoodLogSection";
import { MacrosSection } from "@/components/MacrosSection";
import { WeightSection } from "@/components/WeightSection";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";

export function Dashboard() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [greeting, setGreeting] = useState("Good morning");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [dailyCalories, setDailyCalories] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      setShowSplash(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    async function loadProfile() {
      console.log("[Dashboard] Fetching profile for user:", user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, daily_calories")
        .eq("id", user.id)
        .maybeSingle();
      console.log("[Dashboard] Profile fetch result:", { data, error });
      if (data) {
        setFirstName(data.first_name);
        setDailyCalories(data.daily_calories);
      }
      timer = setTimeout(() => setShowSplash(false), 2000);
    }
    loadProfile();
    return () => clearTimeout(timer);
  }, [user]);

  return (
    <>
      {showSplash && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950">
          <div className="mx-6 rounded-3xl bg-slate-900 px-6 py-8 text-center ring-1 ring-slate-800">
            <p className="mb-1 text-xs uppercase tracking-wide text-emerald-400">
              TrackRight
            </p>
            <h1 className="mb-2 text-xl font-semibold text-white">
              {greeting} {firstName || ""}.
            </h1>
            <p className="text-sm text-slate-400">
              Your goal today is{" "}
              <span className="font-semibold text-emerald-400">
                {dailyCalories ?? "-"} calories
              </span>
              .
            </p>
          </div>
        </div>
      )}

      <header className="mt-2 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">TrackRight</h1>
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

