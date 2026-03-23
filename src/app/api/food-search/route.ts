import { NextRequest, NextResponse } from "next/server";

type OFFProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: string | number;
  nutriments?: Record<string, number>;
};

type SearchFood = {
  id: string;
  name: string;
  brand: string;
  servingLabel: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const OFF_TIMEOUT_MS = 3000;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "query parameter required" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);

  try {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl` +
      `?search_terms=${encodeURIComponent(query)}` +
      `&action=process&json=1&page_size=10` +
      `&sort_by=unique_scans_n` +
      `&tagtype_0=countries&tag_contains_0=contains&tag_0=united-states`;

    console.log("[food-search] fetching OFF:", url);

    const offRes = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TrackRight/1.0 (fitness tracker app)" },
    });

    console.log("[food-search] OFF response status:", offRes.status, offRes.ok);

    if (!offRes.ok) {
      console.warn("[food-search] OFF non-OK, returning empty");
      return NextResponse.json({ results: [] });
    }

    const data = await offRes.json() as { products?: OFFProduct[] };
    const products = data.products ?? [];
    console.log("[food-search] OFF returned", products.length, "products");

    const results: SearchFood[] = products
      .filter(p => p.product_name)
      .map(p => {
        const n = p.nutriments ?? {};
        const servingQty = parseFloat(String(p.serving_quantity ?? "")) || 100;
        const mult = servingQty / 100;
        return {
          id: `off-${String(p.code ?? p.product_name)}`,
          name: String(p.product_name ?? ""),
          brand: String(p.brands ?? ""),
          servingLabel: String(p.serving_size ?? `${servingQty}g`),
          cal: Math.round((n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0) * mult),
          protein: +((n.proteins_100g ?? n.proteins ?? 0) * mult).toFixed(1),
          carbs: +((n.carbohydrates_100g ?? n.carbohydrates ?? 0) * mult).toFixed(1),
          fat: +((n.fat_100g ?? n.fat ?? 0) * mult).toFixed(1),
        };
      });

    console.log("[food-search] returning", results.length, "mapped results");
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[food-search] OFF timed out after", OFF_TIMEOUT_MS, "ms");
    } else {
      console.error("[food-search] OFF error:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ results: [] });
  } finally {
    clearTimeout(timeout);
  }
}
