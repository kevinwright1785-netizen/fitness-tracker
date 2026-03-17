"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!supabase) {
      setError("Supabase is not configured yet.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else if (data.user?.identities?.length === 0) {
      setAlreadyConfirmed(true);
    } else {
      setConfirmedEmail(email);
    }
    setLoading(false);
  }

  if (alreadyConfirmed) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-4">
        <div className="rounded-3xl bg-slate-900 px-6 py-8 text-center ring-1 ring-slate-800">
          <p className="mb-3 text-3xl">✅</p>
          <h1 className="mb-2 text-xl font-semibold text-white">You&apos;re already confirmed!</h1>
          <p className="text-sm text-slate-400">
            <Link href="/login" className="font-semibold text-emerald-400">
              Click here to log in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  if (confirmedEmail) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-4">
        <div className="rounded-3xl bg-slate-900 px-6 py-8 text-center ring-1 ring-slate-800">
          <p className="mb-3 text-3xl">📬</p>
          <h1 className="mb-2 text-xl font-semibold text-white">Check your email!</h1>
          <p className="text-sm text-slate-400">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-emerald-400">{confirmedEmail}</span>.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Click the link to activate your account, then come back to log in.
          </p>
        </div>
        <p className="text-center text-xs text-slate-400">
          Already confirmed?{" "}
          <Link href="/login" className="font-semibold text-emerald-400">
            Log in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Create account</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sign up to start tracking your fitness.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <div className="rounded-2xl border border-slate-700 px-4 py-4 text-center">
        <p className="text-sm text-slate-400">Already have an account?</p>
        <Link
          href="/login"
          className="mt-2 flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-base font-semibold text-white hover:bg-slate-700"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}

