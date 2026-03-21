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
  source: "OFF";
};

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "query parameter required" }, { status: 400 });
  }

  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(query)}` +
    `&action=process&json=1&page_size=10` +
    `&sort_by=unique_scans_n` +
    `&tagtype_0=countries&tag_contains_0=contains&tag_0=united-states`;

  const offRes = await fetch(url, {
    headers: { "User-Agent": "TrackRight/1.0 (fitness tracker app)" },
    next: { revalidate: 300 }, // cache identical queries for 5 minutes on the server
  });

  if (!offRes.ok) {
    return NextResponse.json({ error: "Open Food Facts request failed", status: offRes.status }, { status: 502 });
  }

  const data = await offRes.json() as { products?: OFFProduct[] };
  const products = data.products ?? [];

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
        source: "OFF",
      };
    });

  return NextResponse.json({ results });
}
