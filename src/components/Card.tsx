import { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-3xl bg-slate-900/70 p-4 shadow-lg ring-1 ring-slate-800">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}
