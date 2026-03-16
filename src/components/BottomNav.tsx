"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isWeight = pathname === "/weight-steps";

  return (
    <nav className="mt-auto flex gap-2 rounded-3xl bg-slate-900/80 p-2 text-[11px] text-slate-300 ring-1 ring-slate-800">
      <Link
        href="/"
        className={`flex-1 rounded-2xl px-3 py-2 text-center ${
          isHome ? "bg-emerald-500 text-slate-950 font-semibold" : "bg-transparent"
        }`}
      >
        Dashboard
      </Link>
      <Link
        href="/weight-steps"
        className={`flex-1 rounded-2xl px-3 py-2 text-center ${
          isWeight ? "bg-emerald-500 text-slate-950 font-semibold" : "bg-transparent"
        }`}
      >
        Weight & Steps
      </Link>
    </nav>
  );
}

