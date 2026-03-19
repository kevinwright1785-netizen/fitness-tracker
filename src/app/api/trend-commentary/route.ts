import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("[trend-commentary] ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const body = await req.json();
    console.log("[trend-commentary] Request body:", JSON.stringify(body));

    const {
      currentWeight,
      startingWeight,
      goalWeight,
      periodChange,
      avgWeight,
      bestWeight,
      bestDay,
      numDays,
      weeklyPaceGoal,
      rangeLabel,
    } = body;

    const weeklyChange =
      numDays > 0 && periodChange != null
        ? (periodChange / numDays) * 7
        : null;

    const lines: string[] = [
      `Time period: ${rangeLabel} (${numDays} days)`,
      currentWeight != null ? `Current weight: ${currentWeight.toFixed(1)} lbs` : null,
      startingWeight != null ? `Starting weight: ${startingWeight.toFixed(1)} lbs` : null,
      goalWeight != null ? `Goal weight: ${goalWeight.toFixed(1)} lbs` : null,
      periodChange != null
        ? `Change this period: ${periodChange > 0 ? "+" : ""}${periodChange.toFixed(1)} lbs`
        : null,
      weeklyChange != null
        ? `Average weekly change: ${weeklyChange > 0 ? "+" : ""}${weeklyChange.toFixed(1)} lbs/week`
        : null,
      avgWeight != null ? `Average weight this period: ${avgWeight.toFixed(1)} lbs` : null,
      bestWeight != null && bestDay
        ? `Lowest weight: ${bestWeight.toFixed(1)} lbs on ${bestDay}`
        : null,
      weeklyPaceGoal != null ? `User's weekly pace goal: lose ${weeklyPaceGoal} lbs/week` : null,
    ].filter((l): l is string => l != null);

    const prompt = `You are a supportive fitness coach giving a brief trend update to someone tracking their weight loss. Based on this data, write 2-3 sentences of commentary. Be conversational, encouraging but honest.

Rules:
- Always open by referencing the specific time period by name (e.g. "Over the last 7 days…" or "Looking at the last 30 days…"). Never write a generic opening.
- All stats you mention (change, average, best day) must come from this specific time period, not all-time data.
- If they're ahead of their weekly pace goal, celebrate it. If behind, encourage without being harsh.
- If goal weight is provided, mention how close they are or estimate weeks remaining at their current pace.
- Never use bullet points or lists — write natural flowing sentences only.

Data:
${lines.join("\n")}`;

    console.log("[trend-commentary] Calling Anthropic API...");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    console.log("[trend-commentary] Anthropic response stop_reason:", response.stop_reason);

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return NextResponse.json({ commentary: text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[trend-commentary] Error message:", message);
    console.error("[trend-commentary] Error stack:", stack);
    console.error("[trend-commentary] Full error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
