"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!supabase) {
      setError("Supabase is not configured yet.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.replace("/");
    }
    setLoading(false);
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Create account</h1>
        <p className="text-sm text-slate-400">
          Sign up with email and password to start tracking.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>
      <p className="text-xs text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-emerald-400">
          Log in
        </Link>
      </p>
    </main>
  );
}

