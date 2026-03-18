"use client";

import { useState, useEffect, FormEvent } from "react";
import { Card } from "./Card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from "recharts";

type RangeKey = "7d" | "14d" | "1m" | "3m" | "all";

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "14d", label: "14 Days" },
  { key: "1m", label: "30 Days" },
  { key: "3m", label: "90 Days" },
  { key: "all", label: "All Time" },
];

type WeightPoint = { date: string; ts: number; weight: number };

type Profile = {
  current_weight: number | null;
  goal_weight: number | null;
  weekly_pace: number | null;
};

const DAY_MS = 86_400_000;

function getRangeStart(range: RangeKey): Date | null {
  const now = new Date();
  switch (range) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "14d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 13);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "1m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "all":
      return null;
  }
}

/**
 * Generate X-axis tick timestamps anchored to the actual data range.
 * Ticks are calendar-aligned starting from the first data point's date.
 */
function generateXTicks(firstTs: number, lastTs: number, range: RangeKey): number[] {
  const ticks: number[] = [];
  const startDay = new Date(firstTs);
  startDay.setHours(0, 0, 0, 0);
  const endGuard = lastTs + DAY_MS * 0.6; // slightly past last point

  if (range === "7d") {
    // One tick per day
    for (let i = 0; ; i++) {
      const d = new Date(startDay);
      d.setDate(d.getDate() + i);
      if (d.getTime() > endGuard) break;
      ticks.push(d.getTime());
    }
  } else if (range === "14d") {
    // Every 2 days
    for (let i = 0; ; i += 2) {
      const d = new Date(startDay);
      d.setDate(d.getDate() + i);
      if (d.getTime() > endGuard) break;
      ticks.push(d.getTime());
    }
  } else if (range === "1m") {
    // Every 5 days
    for (let i = 0; ; i += 5) {
      const d = new Date(startDay);
      d.setDate(d.getDate() + i);
      if (d.getTime() > endGuard) break;
      ticks.push(d.getTime());
    }
  } else if (range === "3m") {
    // Every 2 weeks
    for (let i = 0; ; i += 14) {
      const d = new Date(startDay);
      d.setDate(d.getDate() + i);
      if (d.getTime() > endGuard) break;
      ticks.push(d.getTime());
    }
  } else {
    // All time: 1st of each month
    const d = new Date(startDay.getFullYear(), startDay.getMonth(), 1);
    while (d.getTime() <= endGuard) {
      ticks.push(d.getTime());
      d.setMonth(d.getMonth() + 1);
    }
  }

  return ticks;
}

/**
 * Compute 6 evenly-spaced Y-axis ticks (5 intervals) from the data.
 * Steps are rounded to the nearest 0.5 or 1 lb.
 */
function computeYTicks(points: WeightPoint[]): { domain: [number, number]; ticks: number[] } {
  if (points.length === 0) {
    return { domain: [150, 250], ticks: [150, 160, 170, 180, 190, 200] };
  }

  const weights = points.map((p) => p.weight);
  const dataMin = Math.min(...weights);
  const dataMax = Math.max(...weights);
  const spread = dataMax - dataMin;

  // Padding: 10% of spread or minimum 2 lbs each side
  const pad = Math.max(2, spread * 0.1);
  const rawMin = dataMin - pad;
  const rawMax = dataMax + pad;

  // Round bounds to whole numbers
  const niceMin = Math.floor(rawMin);
  const niceMax = Math.ceil(rawMax);

  // 5 intervals → 6 tick values, step always a whole number (minimum 1)
  const rawStep = (niceMax - niceMin) / 5;
  const step = Math.max(1, Math.round(rawStep));

  const ticks: number[] = [];
  for (let i = 0; i < 6; i++) {
    ticks.push(Math.round(niceMin + i * step));
  }

  return {
    domain: [ticks[0], ticks[5]] as [number, number],
    ticks,
  };
}

function formatTickTs(ts: number, range: RangeKey): string {
  const d = new Date(ts);
  if (range === "all") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isDowntrend(points: WeightPoint[]): boolean {
  if (points.length < 2) return true;
  return points[points.length - 1].weight <= points[0].weight;
}

function fmtLbs(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${val.toFixed(1)} lbs`;
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: WeightPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400">{formatTooltipDate(point.payload.date)}</p>
      <p className="mt-0.5 font-semibold text-white">{point.value.toFixed(1)} lbs</p>
    </div>
  );
}

export function WeightStepsModule() {
  const { user } = useAuth();

  const [range, setRange] = useState<RangeKey>("1m");
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [allPoints, setAllPoints] = useState<WeightPoint[]>([]);
  const [rangePoints, setRangePoints] = useState<WeightPoint[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const [commentary, setCommentary] = useState<string | null>(null);
  const [loadingCommentary, setLoadingCommentary] = useState(false);

  // Load profile
  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from("profiles")
      .select("current_weight, goal_weight, weekly_pace")
      .eq("id", user.id)
      .single()
      .then(({ data }: { data: Profile | null }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  // Load all weight log data
  useEffect(() => {
    if (!user || !supabase) return;
    setLoadingChart(true);

    supabase
      .from("weight_logs")
      .select("weight_lbs, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true })
      .then(({ data }: { data: { weight_lbs: number; logged_at: string }[] | null }) => {
        if (!data) {
          setAllPoints([]);
          setLoadingChart(false);
          return;
        }

        const points: WeightPoint[] = data.map((row) => ({
          date: row.logged_at,
          ts: new Date(row.logged_at).getTime(),
          weight: row.weight_lbs,
        }));

        setAllPoints(points);

        if (points.length > 0) {
          const latest = points[points.length - 1].weight;
          setCurrentWeight(latest);
          setWeightInput(String(latest));
        }

        setLoadingChart(false);
      });
  }, [user, reloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter points to selected range
  useEffect(() => {
    const start = getRangeStart(range);
    if (!start) {
      setRangePoints(allPoints);
      return;
    }
    const startTs = start.getTime();
    setRangePoints(allPoints.filter((p) => p.ts >= startTs));
  }, [allPoints, range]);

  // Fetch AI commentary whenever the range points are ready
  useEffect(() => {
    if (rangePoints.length < 2 || !profile) {
      setCommentary(null);
      return;
    }

    let cancelled = false;

    const firstPoint = rangePoints[0];
    const lastPoint = rangePoints[rangePoints.length - 1];
    const fixedDaysMap: Record<RangeKey, number | null> = {
      "7d": 7, "14d": 14, "1m": 30, "3m": 90, "all": null,
    };
    const numDays = fixedDaysMap[range] ?? (Math.round((lastPoint.ts - firstPoint.ts) / DAY_MS) || 1);

    const periodChange = lastPoint.weight - firstPoint.weight;

    const avgW =
      rangePoints.reduce((s, p) => s + p.weight, 0) / rangePoints.length;

    const bestW = Math.min(...rangePoints.map((p) => p.weight));
    const bestPoint = rangePoints.find((p) => p.weight === bestW);
    const bestDayStr = bestPoint
      ? new Date(bestPoint.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null;

    const rangeLabelMap: Record<RangeKey, string> = {
      "7d": "Last 7 Days",
      "14d": "Last 14 Days",
      "1m": "Last 30 Days",
      "3m": "Last 90 Days",
      "all": "All Time",
    };

    setLoadingCommentary(true);
    setCommentary(null);

    fetch("/api/trend-commentary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentWeight: lastPoint.weight,
        startingWeight: profile.current_weight,
        goalWeight: profile.goal_weight,
        periodChange,
        avgWeight: avgW,
        bestWeight: bestW,
        bestDay: bestDayStr,
        numDays,
        weeklyPaceGoal: profile.weekly_pace,
        rangeLabel: rangeLabelMap[range],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setCommentary(data.commentary ?? null);
          setLoadingCommentary(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingCommentary(false);
      });

    return () => { cancelled = true; };
  }, [rangePoints, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabase || !weightInput) return;
    setSaving(true);
    setSavedMessage(null);

    const { error } = await supabase.from("weight_logs").insert({
      user_id: user.id,
      weight_lbs: Number(weightInput),
      logged_at: new Date().toISOString(),
    });

    if (!error) {
      setSavedMessage(`Saved — ${weightInput} lbs`);
      setReloadToken((t) => t + 1);
      setTimeout(() => setSavedMessage(null), 3000);
    }
    setSaving(false);
  }

  // Derived stats
  const startingWeight = profile?.current_weight ?? null;
  const goalWeight = profile?.goal_weight ?? null;
  const totalLost =
    startingWeight != null && currentWeight != null
      ? startingWeight - currentWeight
      : null;
  const lbsToGoal =
    currentWeight != null && goalWeight != null
      ? currentWeight - goalWeight
      : null;

  // Trend
  const trendDown = isDowntrend(rangePoints);
  const lineColor = trendDown ? "#10b981" : "#ef4444";

  // Period summary
  const avgWeight =
    rangePoints.length > 0
      ? rangePoints.reduce((s, p) => s + p.weight, 0) / rangePoints.length
      : null;

  const periodChange =
    rangePoints.length >= 2
      ? rangePoints[rangePoints.length - 1].weight - rangePoints[0].weight
      : null;

  const bestWeight =
    rangePoints.length > 0
      ? Math.min(...rangePoints.map((p) => p.weight))
      : null;

  const bestDay =
    bestWeight != null ? rangePoints.find((p) => p.weight === bestWeight) : null;

  // Y-axis: 6 evenly-spaced ticks computed from actual data, never auto-generated
  const { domain: yDomain, ticks: yTicks } = computeYTicks(rangePoints);

  // X-axis: domain anchored to actual data — no empty space before first or after last point
  const xDomainMin =
    rangePoints.length > 0 ? rangePoints[0].ts - DAY_MS * 0.5 : Date.now() - DAY_MS * 7;
  const xDomainMax =
    rangePoints.length > 0
      ? rangePoints[rangePoints.length - 1].ts + DAY_MS * 0.5
      : Date.now();

  const xTicks =
    rangePoints.length >= 2
      ? generateXTicks(rangePoints[0].ts, rangePoints[rangePoints.length - 1].ts, range)
          .filter((t) => t >= xDomainMin && t <= xDomainMax)
      : [];

  return (
    <>
      <header className="mt-2">
        <h1 className="text-xl font-semibold text-white">Progress</h1>
        <p className="text-xs text-slate-400">Track your weight over time.</p>
      </header>

      {/* Log weight */}
      <Card title="Log Today's Weight">
        <form className="flex gap-2" onSubmit={onSubmit}>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="lbs"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={saving || !user || !weightInput}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "…" : "Save"}
          </button>
        </form>
        {savedMessage && (
          <p className="mt-2 text-xs text-emerald-400">✓ {savedMessage}</p>
        )}
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Current Weight" value={fmtLbs(currentWeight)} />
        <StatCard label="Starting Weight" value={fmtLbs(startingWeight)} />
        <StatCard
          label="Total Lost"
          value={totalLost != null ? fmtLbs(totalLost) : "—"}
          valueClass={
            totalLost == null
              ? undefined
              : totalLost > 0
              ? "text-emerald-400"
              : totalLost < 0
              ? "text-red-400"
              : undefined
          }
        />
        <StatCard label="Goal Weight" value={fmtLbs(goalWeight)} />
        <StatCard
          label="Lbs to Goal"
          value={lbsToGoal != null ? fmtLbs(lbsToGoal) : "—"}
          valueClass={
            lbsToGoal == null
              ? undefined
              : lbsToGoal <= 0
              ? "text-emerald-400"
              : undefined
          }
          className="col-span-2"
        />
      </div>

      {/* Weight chart */}
      <Card title="Weight Trend">
        {/* Range toggles */}
        <div className="mb-4 flex gap-1.5 overflow-x-auto text-[11px]">
          {rangeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 font-medium transition-colors ${
                range === opt.key
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {loadingChart ? (
          <div className="flex h-52 items-center justify-center text-xs text-slate-500">
            Loading…
          </div>
        ) : rangePoints.length < 2 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-1 text-xs text-slate-500">
            <span className="text-2xl">📉</span>
            <span>Not enough data for this range yet.</span>
            <span className="text-slate-600">Log your weight to get started.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart
              data={rangePoints}
              margin={{ top: 8, right: 20, left: 10, bottom: 40 }}
            >
              {yTicks.map((tick) => (
                <ReferenceLine
                  key={tick}
                  y={tick}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              ))}
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={[xDomainMin, xDomainMax]}
                ticks={xTicks}
                tickFormatter={(ts: number) => formatTickTs(ts, range)}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                dy={4}
              />
              <YAxis
                domain={yDomain}
                ticks={yTicks}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}`}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke={lineColor}
                strokeWidth={2.5}
                dot={<Dot r={3} fill={lineColor} strokeWidth={0} />}
                activeDot={{ r: 5, fill: lineColor, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Trend summary */}
      {rangePoints.length >= 2 && (
        <Card title="Period Summary">
          <div className="space-y-2 text-sm">
            <SummaryRow
              label="Average weight"
              value={avgWeight != null ? `${avgWeight.toFixed(1)} lbs` : "—"}
            />
            <SummaryRow
              label="Total change"
              value={
                periodChange != null
                  ? `${periodChange < 0 ? "Down" : "Up"} ${Math.abs(periodChange).toFixed(1)} lbs`
                  : "—"
              }
              valueClass={
                periodChange == null
                  ? undefined
                  : periodChange < 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            />
            <SummaryRow
              label="Best day (lowest)"
              value={
                bestDay != null
                  ? `${bestWeight?.toFixed(1)} lbs on ${formatTooltipDate(bestDay.date)
                      .split(",")
                      .slice(0, 2)
                      .join(",")}`
                  : "—"
              }
              valueClass="text-emerald-400"
            />
          </div>
        </Card>
      )}

      {/* AI Trend Insight */}
      {rangePoints.length >= 2 && (
        <Card title="Trend Insight">
          {loadingCommentary ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg className="h-3.5 w-3.5 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Analyzing your trend…
            </div>
          ) : commentary ? (
            <p className="text-sm leading-relaxed text-slate-300">{commentary}</p>
          ) : null}
        </Card>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  valueClass,
  className,
}: {
  label: string;
  value: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-slate-800/60 px-4 py-3 ring-1 ring-slate-700/50 ${className ?? ""}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${valueClass ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium ${valueClass ?? "text-white"}`}>{value}</span>
    </div>
  );
}
