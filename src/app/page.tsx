import { Dashboard } from "@/components/Dashboard";
import { BottomNav } from "@/components/BottomNav";

export default function HomePage() {
  return (
    <>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <Dashboard />
      </main>
      <BottomNav />
    </>
  );
}

