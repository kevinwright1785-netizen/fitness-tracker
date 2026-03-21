import { NextRequest, NextResponse } from "next/server";

type SearchFood = {
  id: string;
  name: string;
  brand: string;
  servingLabel: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "FatSecret" | "USDA";
};

type FatSecretFood = {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
};

type USDAFood = {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: { nutrientId: number; value: number }[];
};

// In-memory token cache — FatSecret tokens last 24 hours
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getFatSecretToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("FatSecret credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });

  if (!res.ok) {
    throw new Error(`FatSecret token request failed: ${res.status}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  console.log("[food-search] FatSecret token obtained, expires_in:", data.expires_in);
  return tokenCache.token;
}

// Parse FatSecret food_description:
// "Per 1 serving (28g) - Calories: 150kcal | Fat: 8.00g | Carbs: 18.00g | Protein: 2.00g"
function parseFatSecretDescription(desc: string): {
  servingLabel: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
} | null {
  try {
    const servingMatch = desc.match(/^Per\s+(.+?)\s+-/);
    const calMatch     = desc.match(/Calories:\s*([\d.]+)kcal/i);
    const fatMatch     = desc.match(/Fat:\s*([\d.]+)g/i);
    const carbsMatch   = desc.match(/Carbs:\s*([\d.]+)g/i);
    const proteinMatch = desc.match(/Protein:\s*([\d.]+)g/i);
    if (!calMatch) return null;
    return {
      servingLabel: servingMatch?.[1] ?? "1 serving",
      cal:     Math.round(parseFloat(calMatch[1])),
      fat:     +(parseFloat(fatMatch?.[1]     ?? "0")).toFixed(1),
      carbs:   +(parseFloat(carbsMatch?.[1]   ?? "0")).toFixed(1),
      protein: +(parseFloat(proteinMatch?.[1] ?? "0")).toFixed(1),
    };
  } catch {
    return null;
  }
}

async function searchFatSecret(query: string, token: string): Promise<SearchFood[]> {
  const url = new URL("https://platform.fatsecret.com/rest/server.api");
  url.searchParams.set("method", "foods.search");
  url.searchParams.set("search_expression", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("max_results", "10");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[food-search] FatSecret search HTTP error:", res.status, body);
    throw new Error(`FatSecret search failed: ${res.status}`);
  }

  const data = await res.json() as {
    foods?: { food?: FatSecretFood | FatSecretFood[] };
    error?: { message: string };
  };
  console.log("[food-search] FatSecret raw response:", JSON.stringify(data).slice(0, 500));

  if (data.error) {
    console.error("[food-search] FatSecret API error:", data.error.message);
    throw new Error(data.error.message);
  }

  const rawFoods = data.foods?.food;
  if (!rawFoods) {
    console.log("[food-search] FatSecret returned no foods (data.foods?.food is empty)");
    return [];
  }

  // API returns a single object when there's only one result
  const foods = Array.isArray(rawFoods) ? rawFoods : [rawFoods];
  console.log("[food-search] FatSecret raw food count:", foods.length);

  const result = foods
    .map((food): SearchFood | null => {
      const parsed = food.food_description
        ? parseFatSecretDescription(food.food_description)
        : null;
      if (!parsed) {
        console.log("[food-search] FatSecret failed to parse description for:", food.food_name, "|", food.food_description);
        return null;
      }
      return {
        id:           `fs-${food.food_id}`,
        name:         food.food_name,
        brand:        food.brand_name ?? "",
        servingLabel: parsed.servingLabel,
        cal:          parsed.cal,
        protein:      parsed.protein,
        carbs:        parsed.carbs,
        fat:          parsed.fat,
        source:       "FatSecret",
      };
    })
    .filter((f): f is SearchFood => f !== null);
  console.log("[food-search] FatSecret parsed result count:", result.length, "of", foods.length);
  return result;
}

// USDA nutrient IDs
const NUT_ENERGY  = 1008;
const NUT_PROTEIN = 1003;
const NUT_CARBS   = 1005;
const NUT_FAT     = 1004;

function getNutrient(food: USDAFood, id: number): number {
  return food.foodNutrients.find(n => n.nutrientId === id)?.value ?? 0;
}

async function searchUSDA(query: string): Promise<SearchFood[]> {
  const apiKey = process.env.NEXT_PUBLIC_USDA_API_KEY ?? "DEMO_KEY";
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=25&api_key=${apiKey}`
  );
  if (!res.ok) return [];
  const data = await res.json() as { foods?: USDAFood[] };
  return (data.foods ?? []).map((food): SearchFood => {
    const mult  = food.servingSize && food.servingSize > 0 ? food.servingSize / 100 : 1;
    const label = food.householdServingFullText
      ?? (food.servingSize ? `${food.servingSize} ${food.servingSizeUnit ?? "g"}` : "100g");
    return {
      id:           `usda-${food.fdcId}`,
      name:         food.description,
      brand:        food.brandName ?? food.brandOwner ?? "",
      servingLabel: label,
      cal:          Math.round(getNutrient(food, NUT_ENERGY)  * mult),
      protein:      +(getNutrient(food, NUT_PROTEIN) * mult).toFixed(1),
      carbs:        +(getNutrient(food, NUT_CARBS)   * mult).toFixed(1),
      fat:          +(getNutrient(food, NUT_FAT)     * mult).toFixed(1),
      source:       "USDA",
    };
  });
}

// Score results by how many query words appear in the food name vs brand.
// Name matches are weighted 2x so name-specific results rank above brand-only matches.
// Items where every query word matches (anywhere) sort to the top.
function rankResults(results: SearchFood[], query: string): SearchFood[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return results;
  return results
    .map(food => {
      const nameLower  = food.name.toLowerCase();
      const brandLower = food.brand.toLowerCase();
      let nameMatches = 0;
      let brandOnlyMatches = 0;
      for (const word of words) {
        if (nameLower.includes(word))       nameMatches++;
        else if (brandLower.includes(word)) brandOnlyMatches++;
      }
      const allMatch = nameMatches + brandOnlyMatches === words.length;
      // Primary sort: all words matched; secondary: weighted name+brand score
      return { food, score: (allMatch ? 1000 : 0) + nameMatches * 2 + brandOnlyMatches };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ food }) => food);
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "query parameter required" }, { status: 400 });
  }

  console.log("[food-search] query:", query);
  try {
    const token     = await getFatSecretToken();
    console.log("[food-search] token obtained (cached or fresh)");
    const fsResults = await searchFatSecret(query, token);
    console.log("[food-search] FatSecret returned", fsResults.length, "usable results");

    if (fsResults.length >= 5) {
      console.log("[food-search] using FatSecret results only");
      return NextResponse.json({ results: rankResults(fsResults, query) });
    }

    // Fewer than 5 FatSecret results — supplement with USDA
    console.log("[food-search] FatSecret < 5 results, supplementing with USDA");
    try {
      const usdaResults = await searchUSDA(query);
      console.log("[food-search] USDA returned", usdaResults.length, "results");
      const seen  = new Set(fsResults.map(f => `${f.name.toLowerCase()}|${f.brand.toLowerCase()}`));
      const extra = usdaResults.filter(f => !seen.has(`${f.name.toLowerCase()}|${f.brand.toLowerCase()}`));
      console.log("[food-search] returning", fsResults.length, "FatSecret +", extra.length, "USDA results");
      return NextResponse.json({ results: rankResults([...fsResults, ...extra], query) });
    } catch (usdaErr) {
      console.error("[food-search] USDA fallback error:", usdaErr instanceof Error ? usdaErr.message : usdaErr);
      return NextResponse.json({ results: rankResults(fsResults, query) });
    }
  } catch (err) {
    console.error("[food-search] FatSecret failed, falling back to USDA. Error:", err instanceof Error ? err.message : err);
    try {
      const usdaResults = await searchUSDA(query);
      console.log("[food-search] USDA fallback returned", usdaResults.length, "results");
      return NextResponse.json({ results: rankResults(usdaResults, query) });
    } catch (usdaErr) {
      console.error("[food-search] USDA fallback also failed:", usdaErr instanceof Error ? usdaErr.message : usdaErr);
      return NextResponse.json({ results: [] });
    }
  }
}
