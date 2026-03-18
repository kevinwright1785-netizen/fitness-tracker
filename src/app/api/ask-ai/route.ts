import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a personal fitness and nutrition coach inside the TrackRight app. You have access to the user's personal data and should give specific, personalized advice. Keep responses concise and conversational — 2-4 sentences max unless a detailed answer is truly needed. Be encouraging but honest. You can answer questions about nutrition, weight loss, exercise, food choices, and general wellness. Never give medical advice — recommend consulting a doctor for medical concerns.`;

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const body = await req.json();
    const { messages, userContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    // Build a context preamble from user data
    const contextLines: string[] = [];
    if (userContext) {
      const {
        firstName,
        currentWeight,
        goalWeight,
        dailyCalories,
        dailyProtein,
        dailyCarbs,
        dailyFat,
        weeklyPace,
        weightLost,
        caloriesConsumed,
        caloriesRemaining,
      } = userContext;

      if (firstName) contextLines.push(`User's name: ${firstName}`);
      if (currentWeight != null) contextLines.push(`Current weight: ${currentWeight} lbs`);
      if (goalWeight != null) contextLines.push(`Goal weight: ${goalWeight} lbs`);
      if (weightLost != null) contextLines.push(`Total weight lost so far: ${weightLost} lbs`);
      if (weeklyPace != null) contextLines.push(`Weekly pace goal: lose ${weeklyPace} lbs/week`);
      if (dailyCalories != null) contextLines.push(`Daily calorie goal: ${dailyCalories} cal`);
      if (dailyProtein != null) contextLines.push(`Daily protein goal: ${dailyProtein}g`);
      if (dailyCarbs != null) contextLines.push(`Daily carbs goal: ${dailyCarbs}g`);
      if (dailyFat != null) contextLines.push(`Daily fat goal: ${dailyFat}g`);
      if (caloriesConsumed != null) contextLines.push(`Calories consumed today: ${caloriesConsumed}`);
      if (caloriesRemaining != null) contextLines.push(`Calories remaining today: ${caloriesRemaining}`);
    }

    const systemWithContext = contextLines.length > 0
      ? `${SYSTEM_PROMPT}\n\nUser's current data:\n${contextLines.join("\n")}`
      : SYSTEM_PROMPT;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: systemWithContext,
      messages,
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return NextResponse.json({ reply: text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ask-ai] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
