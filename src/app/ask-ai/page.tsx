"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthContext";
import { useChat, type ChatMessage } from "@/components/ChatContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserContext = {
  firstName: string | null;
  currentWeight: number | null;
  goalWeight: number | null;
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  weeklyPace: number | null;
  weightLost: number | null;
  caloriesConsumed: number;
  caloriesRemaining: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AskAIPage() {
  const { user } = useAuth();
  const { messages, setMessages } = useChat();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load user context ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !supabase) return;

    async function loadContext() {
      const { start, end } = todayRange();

      const [profileRes, weightRes, foodRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "first_name, current_weight, goal_weight, weekly_pace, daily_calories, daily_protein, daily_carbs, daily_fat"
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("weight_logs")
          .select("weight_lbs")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(1),
        supabase
          .from("food_logs")
          .select("calories")
          .eq("user_id", user.id)
          .gte("logged_at", start)
          .lt("logged_at", end),
      ]);

      const profile = profileRes.data;
      const latestWeight = weightRes.data?.[0]?.weight_lbs ?? null;
      const caloriesConsumed = (foodRes.data ?? []).reduce(
        (sum: number, row: { calories: number }) => sum + (row.calories || 0),
        0
      );

      const startingWeight = profile?.current_weight ?? null;
      const weightLost =
        startingWeight && latestWeight
          ? +(startingWeight - latestWeight).toFixed(1)
          : null;

      const dailyCalories = profile?.daily_calories ?? null;
      const caloriesRemaining =
        dailyCalories != null ? dailyCalories - caloriesConsumed : null;

      setUserContext({
        firstName: profile?.first_name ?? null,
        currentWeight: latestWeight ?? startingWeight,
        goalWeight: profile?.goal_weight ?? null,
        dailyCalories,
        dailyProtein: profile?.daily_protein ?? null,
        dailyCarbs: profile?.daily_carbs ?? null,
        dailyFat: profile?.daily_fat ?? null,
        weeklyPace: profile?.weekly_pace ?? null,
        weightLost,
        caloriesConsumed,
        caloriesRemaining,
      });
    }

    loadContext();
  }, [user]);

  // ── Scroll to top on mount ─────────────────────────────────────────────────

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ── Auto-scroll — only when there are messages ─────────────────────────────

  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Send message ───────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          userContext,
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Sorry, I couldn't get a response. Please try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went wrong. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-svh flex-col bg-slate-950 px-4 pt-4 pb-24">
      {/* Header */}
      <header className="mb-3 flex items-center gap-2 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20">
          <SparkleIcon />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Ask AI</h1>
          <p className="text-[10px] text-slate-400 leading-tight">Your personal fitness coach</p>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <p className="pt-2 text-center text-sm text-slate-400">
            Ask me anything about nutrition, weight loss, exercise, or food choices.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-sm bg-emerald-500 text-slate-950"
                  : "rounded-bl-sm bg-slate-800 text-slate-100 ring-1 ring-slate-700"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3 ring-1 ring-slate-700">
              <LoadingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="mt-2 flex items-end gap-2 rounded-2xl bg-slate-900 p-2 ring-1 ring-slate-800"
        style={{ position: 'sticky', bottom: '16px' }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach..."
          rows={1}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          style={{ maxHeight: 120 }}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 disabled:opacity-40 hover:bg-emerald-400 transition-colors"
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </form>

    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-emerald-400"
    >
      <path d="M12 3l1.5 5h5l-4 3 1.5 5-4-3-4 3 1.5-5-4-3h5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-400"
          style={{
            animation: "bounce 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
