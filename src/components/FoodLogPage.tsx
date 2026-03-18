"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type FoodEntry = {
  id: string;
  food_name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  meal_type: MealType | null;
  serving_qty: number | null;
  logged_at: string;
};

type SavedMeal = {
  id: string;
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type USDAFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: Array<{ nutrientId?: number; value?: number }>;
};

type SheetMode = "options" | "manual" | "search" | "barcode" | "saved";

type LogPayload = {
  food_name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  serving_qty: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MEALS: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch",     label: "Lunch"     },
  { type: "dinner",    label: "Dinner"    },
  { type: "snack",     label: "Snack"     },
];

const NUT_ENERGY  = 1008;
const NUT_PROTEIN = 1003;
const NUT_CARBS   = 1005;
const NUT_FAT     = 1004;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function getNutrient(food: USDAFood, id: number) {
  return food.foodNutrients.find(n => n.nutrientId === id)?.value ?? 0;
}


// ─── Streak update ────────────────────────────────────────────────────────────

async function pushStreakUpdate(userId: string) {
  if (!supabase) return;
  const today = todayISO();
  const { data } = await supabase
    .from("profiles")
    .select("streak_count, last_streak_date")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return;
  const last = (data as any).last_streak_date as string | null;
  if (last === today) return;
  const newStreak = last === yesterdayISO() ? ((data as any).streak_count ?? 0) + 1 : 1;
  await supabase
    .from("profiles")
    .update({ streak_count: newStreak, last_streak_date: today })
    .eq("id", userId);
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-1 text-slate-400 hover:text-slate-200">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

// ─── Edit Food Modal ──────────────────────────────────────────────────────────

function EditFoodModal({
  entry,
  onSave,
  onClose,
}: {
  entry: FoodEntry;
  onSave: (id: string, data: LogPayload) => Promise<void>;
  onClose: () => void;
}) {
  // Derive per-1-serving base values so the stepper always scales correctly.
  // If serving_qty was saved we can back-calculate; otherwise treat stored values as 1×.
  const savedQty = entry.serving_qty && entry.serving_qty > 0 ? entry.serving_qty : 1;
  const base = useRef({
    calories: entry.calories / savedQty,
    protein:  (entry.protein ?? 0) / savedQty,
    carbs:    (entry.carbs   ?? 0) / savedQty,
    fat:      (entry.fat     ?? 0) / savedQty,
  });

  const [name,     setName]     = useState(entry.food_name);
  const [qty,      setQty]      = useState(savedQty);
  const [calories, setCalories] = useState(String(entry.calories));
  const [protein,  setProtein]  = useState(entry.protein  != null ? String(entry.protein)  : "");
  const [carbs,    setCarbs]    = useState(entry.carbs    != null ? String(entry.carbs)    : "");
  const [fat,      setFat]      = useState(entry.fat      != null ? String(entry.fat)      : "");
  const [saving,   setSaving]   = useState(false);

  function applyQty(q: number) {
    const b = base.current;
    setQty(q);
    setCalories(String(Math.round(b.calories * q)));
    if (b.protein)  setProtein(String(+(b.protein  * q).toFixed(1)));
    if (b.carbs)    setCarbs(String(+(b.carbs    * q).toFixed(1)));
    if (b.fat)      setFat(String(+(b.fat      * q).toFixed(1)));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(entry.id, {
      food_name:   name.trim() || entry.food_name,
      calories:    Math.round(Number(calories) || 0),
      protein:     protein ? Number(protein) : null,
      carbs:       carbs   ? Number(carbs)   : null,
      fat:         fat     ? Number(fat)     : null,
      serving_qty: qty,
    });
    setSaving(false);
  }

  const inputCls = "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none";

  const content = (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-white">Edit Entry</h3>
        <button onClick={onClose} aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto max-h-[calc(75vh-5rem)] md:max-h-[calc(80vh-5rem)] space-y-4 pb-2">
        {/* Food name */}
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Food name" className={inputCls} />

        {/* Quantity stepper */}
        <div className="rounded-2xl bg-slate-800 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-slate-400">Quantity <span className="text-slate-600">(scales all values)</span></p>
          <div className="flex items-center gap-4 pr-2">
            <button onClick={() => applyQty(Math.max(0.25, +(qty - 0.25).toFixed(2)))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xl font-bold text-white hover:bg-slate-600">
              −
            </button>
            <input
              type="number"
              inputMode="decimal"
              value={qty}
              onChange={e => {
                const parsed = parseFloat(e.target.value);
                if (!isNaN(parsed) && parsed > 0) applyQty(+parsed.toFixed(2));
              }}
              onBlur={e => {
                const parsed = parseFloat(e.target.value);
                if (isNaN(parsed) || parsed <= 0) applyQty(1);
              }}
              className="flex-1 bg-transparent text-center text-2xl font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => applyQty(+(qty + 0.25).toFixed(2))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-white hover:bg-slate-600 mr-1">
              +
            </button>
          </div>
        </div>

        {/* Editable nutrition fields */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Calories *</label>
            <input type="number" inputMode="decimal" value={calories}
              onChange={e => setCalories(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Protein (g)</label>
            <input type="number" inputMode="decimal" value={protein}
              onChange={e => setProtein(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Carbs (g)</label>
            <input type="number" inputMode="decimal" value={carbs}
              onChange={e => setCarbs(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Fat (g)</label>
            <input type="number" inputMode="decimal" value={fat}
              onChange={e => setFat(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-700 py-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/70" onClick={onClose} />

      {/* Mobile: bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-slate-900 px-4 pt-4 ring-1 ring-slate-700 md:hidden"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700" />
        {content}
      </div>

      {/* Desktop: centered dialog */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center md:flex">
        <div className="w-full max-w-[500px] rounded-3xl bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-700">
          {content}
        </div>
      </div>
    </>
  );
}

// ─── Swipeable food item ──────────────────────────────────────────────────────

function FoodItem({
  entry,
  onDelete,
  onEdit,
}: {
  entry: FoodEntry;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX   = useRef(0);
  const wasSwipe = useRef(false);
  const REVEAL = 72;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Mobile: swipe-to-delete zone (hidden on desktop) */}
      <div className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center rounded-r-xl bg-rose-500 md:hidden">
        <button onClick={onDelete}
          className="flex h-full w-full items-center justify-center text-xs font-bold text-white"
          aria-label={`Delete ${entry.food_name}`}>
          Delete
        </button>
      </div>

      {/* Foreground row */}
      <div
        className="relative flex min-h-[44px] cursor-pointer items-center justify-between bg-slate-800 px-3 py-2.5 group"
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset === 0 || offset === -REVEAL ? "transform 0.2s ease" : "none",
        }}
        onTouchStart={e => {
          startX.current = e.touches[0].clientX;
          wasSwipe.current = false;
        }}
        onTouchMove={e => {
          const delta = e.touches[0].clientX - startX.current;
          if (Math.abs(delta) > 6) wasSwipe.current = true;
          if (delta < 0) setOffset(Math.max(delta, -REVEAL));
        }}
        onTouchEnd={() => {
          if (!wasSwipe.current) return;
          setOffset(offset < -REVEAL / 2 ? -REVEAL : 0);
        }}
        onClick={() => {
          if (wasSwipe.current) { wasSwipe.current = false; return; }
          if (offset !== 0) { setOffset(0); } else { onEdit(); }
        }}
      >
        <span className="flex-1 truncate pr-3 text-sm text-slate-100">{entry.food_name}</span>
        <span className="shrink-0 text-sm font-semibold text-white">{entry.calories} cal</span>

        {/* Desktop: trash button — always visible on hover, hidden on mobile */}
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${entry.food_name}`}
          className="ml-3 hidden shrink-0 rounded-lg p-1.5 text-slate-600 opacity-0 transition-opacity hover:bg-rose-500/20 hover:text-rose-400 group-hover:opacity-100 md:flex"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Meal Section ─────────────────────────────────────────────────────────────

function MealSection({
  meal,
  entries,
  expanded,
  onToggle,
  onAddFood,
  onDelete,
  onEdit,
}: {
  meal: typeof MEALS[number];
  entries: FoodEntry[];
  expanded: boolean;
  onToggle: () => void;
  onAddFood: () => void;
  onDelete: (id: string) => void;
  onEdit: (entry: FoodEntry) => void;
}) {
  const cal   = entries.reduce((s, e) => s + e.calories, 0);
  const prot  = entries.reduce((s, e) => s + (e.protein ?? 0), 0);
  const carbs = entries.reduce((s, e) => s + (e.carbs ?? 0), 0);
  const fat   = entries.reduce((s, e) => s + (e.fat ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
      {/* Header — always visible, full tap target */}
      <button
        onClick={onToggle}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="flex-1 text-sm font-semibold text-white">{meal.label}</span>
        <span className={`mr-2 text-sm font-bold ${cal > 0 ? "text-emerald-400" : "text-slate-600"}`}>
          {cal > 0 ? `${cal} cal` : "Empty"}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="space-y-3 border-t border-slate-800 px-4 pb-4 pt-3">
          {/* Macro row */}
          {cal > 0 && (
            <div className="flex gap-5 text-xs text-slate-400">
              <span>Protein <span className="font-semibold text-sky-400">{prot.toFixed(0)}g</span></span>
              <span>Carbs <span className="font-semibold text-yellow-400">{carbs.toFixed(0)}g</span></span>
              <span>Fat <span className="font-semibold text-rose-400">{fat.toFixed(0)}g</span></span>
            </div>
          )}

          {/* Food items */}
          {entries.length > 0 && (
            <div className="flex flex-col gap-1">
              {entries.map(e => (
                <FoodItem key={e.id} entry={e} onDelete={() => onDelete(e.id)} onEdit={() => onEdit(e)} />
              ))}
            </div>
          )}

          {/* Add food button */}
          <button
            onClick={onAddFood}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-3 text-sm font-semibold text-emerald-400 hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" className="h-4 w-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Food
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Manual Entry ─────────────────────────────────────────────────────────────

function ManualEntry({
  mealLabel,
  onSave,
  onBack,
}: {
  mealLabel: string;
  onSave: (data: LogPayload) => Promise<void>;
  onBack: () => void;
}) {
  const [name,    setName]   = useState("");
  const [cal,     setCal]    = useState("");
  const [prot,    setProt]   = useState("");
  const [carbs,   setCarbs]  = useState("");
  const [fat,     setFat]    = useState("");
  const [saving,  setSaving] = useState(false);
  const [error,   setError]  = useState<string | null>(null);

  const inputCls = "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Food name is required."); return; }
    if (!cal)         { setError("Calories is required.");  return; }
    setSaving(true);
    await onSave({
      food_name:   name.trim(),
      calories:    Number(cal),
      protein:     prot  ? Number(prot)  : null,
      carbs:       carbs ? Number(carbs) : null,
      fat:         fat   ? Number(fat)   : null,
      serving_qty: 1,
    });
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h3 className="text-base font-bold text-white">Manual Entry — {mealLabel}</h3>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input type="text" placeholder="Food name *" value={name}
          onChange={e => setName(e.target.value)} className={inputCls} autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" inputMode="decimal" placeholder="Calories *" value={cal}
            onChange={e => setCal(e.target.value)} className={inputCls} />
          <input type="number" inputMode="decimal" placeholder="Protein (g)" value={prot}
            onChange={e => setProt(e.target.value)} className={inputCls} />
          <input type="number" inputMode="decimal" placeholder="Carbs (g)" value={carbs}
            onChange={e => setCarbs(e.target.value)} className={inputCls} />
          <input type="number" inputMode="decimal" placeholder="Fat (g)" value={fat}
            onChange={e => setFat(e.target.value)} className={inputCls} />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-60">
          {saving ? "Saving…" : "Add to Log"}
        </button>
      </form>
    </div>
  );
}

// ─── Unified food search ───────────────────────────────────────────────────────

type SearchFood = {
  id: string;
  name: string;
  brand: string;
  servingLabel: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "USDA" | "OFF";
};

async function searchOFF(query: string): Promise<SearchFood[]> {
  const res = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&action=process&json=1&page_size=10&sort_by=unique_scans_n&tagtype_0=countries&tag_contains_0=contains&tag_0=united-states`
  );
  const data = await res.json();
  const products: Record<string, unknown>[] = data.products ?? [];
  return products
    .filter(p => p.product_name)
    .map((p): SearchFood => {
      const n = (p.nutriments ?? {}) as Record<string, number>;
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
}

async function searchUSDA(query: string): Promise<SearchFood[]> {
  const apiKey = process.env.NEXT_PUBLIC_USDA_API_KEY ?? "DEMO_KEY";
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=25&api_key=${apiKey}`
  );
  const data = await res.json();
  const foods: USDAFood[] = data.foods ?? [];
  return foods.map((food): SearchFood => {
    const mult = (food.servingSize && food.servingSize > 0) ? food.servingSize / 100 : 1;
    const label = food.householdServingFullText
      ?? (food.servingSize ? `${food.servingSize} ${food.servingSizeUnit ?? "g"}` : "100g");
    return {
      id: `usda-${food.fdcId}`,
      name: food.description,
      brand: food.brandName ?? food.brandOwner ?? "",
      servingLabel: label,
      cal: Math.round(getNutrient(food, NUT_ENERGY) * mult),
      protein: +(getNutrient(food, NUT_PROTEIN) * mult).toFixed(1),
      carbs: +(getNutrient(food, NUT_CARBS) * mult).toFixed(1),
      fat: +(getNutrient(food, NUT_FAT) * mult).toFixed(1),
      source: "USDA",
    };
  });
}


// ─── Food Search ───────────────────────────────────────────────────────────────

function USDASearch({
  mealLabel,
  onSave,
  onBack,
}: {
  mealLabel: string;
  onSave: (data: LogPayload) => Promise<void>;
  onBack: () => void;
}) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<SearchFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected,  setSelected]  = useState<SearchFood | null>(null);
  const [qty,       setQty]       = useState(1);
  const [rawQty,    setRawQty]    = useState("1");
  const [saving,    setSaving]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseRef = useRef({ cal: 0, protein: 0, carbs: 0, fat: 0 });

  // Scaled nutrition fields
  const cal     = Math.round(baseRef.current.cal     * qty);
  const protein = +(baseRef.current.protein * qty).toFixed(1);
  const carbs   = +(baseRef.current.carbs   * qty).toFixed(1);
  const fat     = +(baseRef.current.fat     * qty).toFixed(1);

  function selectFood(food: SearchFood) {
    baseRef.current = { cal: food.cal, protein: food.protein, carbs: food.carbs, fat: food.fat };
    setSelected(food);
    setQty(1);
    setRawQty("1");
  }

  function changeQty(v: number) {
    setQty(v);
    setRawQty(String(v));
  }

  async function doSearch(q: string) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    setResults([]);
    try {
      // Show OFF results immediately
      const offFoods = await searchOFF(q);
      setResults(offFoods);
      // Only fetch USDA if OFF came back thin
      if (offFoods.length < 5) {
        const usdaFoods = await searchUSDA(q);
        const seen = new Set(offFoods.map(f => `${f.name.toLowerCase()}|${f.brand.toLowerCase()}`));
        const extra = usdaFoods.filter(f => !seen.has(`${f.name.toLowerCase()}|${f.brand.toLowerCase()}`));
        if (extra.length > 0) setResults([...offFoods, ...extra]);
      }
    } catch {
      // leave whatever was already shown
    }
    setSearching(false);
  }

  function onQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 500);
  }

  async function confirmFood() {
    if (!selected) return;
    setSaving(true);
    const name = selected.brand ? `${selected.name} (${selected.brand})` : selected.name;
    await onSave({ food_name: name, calories: cal, protein, carbs, fat, serving_qty: qty });
    setSaving(false);
  }

  // Detail view
  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => setSelected(null)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{selected.name}</p>
            {selected.brand && <p className="truncate text-xs text-slate-400">{selected.brand}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${selected.source === "USDA" ? "bg-blue-900 text-blue-300" : "bg-slate-700 text-slate-300"}`}>
            {selected.source}
          </span>
        </div>

        <div className="rounded-2xl bg-slate-800 px-4 py-3 space-y-2">
          <p className="text-xs text-slate-400">Serving: {selected.servingLabel}</p>
          <div className="flex items-center gap-4 pr-2">
            <button onClick={() => changeQty(Math.max(0.25, +(qty - 0.25).toFixed(2)))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xl font-bold text-white">−</button>
            <input type="number" inputMode="decimal" value={rawQty}
              onChange={e => {
                setRawQty(e.target.value);
                const p = parseFloat(e.target.value);
                if (!isNaN(p) && p > 0) setQty(+p.toFixed(2));
              }}
              onBlur={e => {
                const p = parseFloat(e.target.value);
                if (!isNaN(p) && p > 0) changeQty(+p.toFixed(2));
                else setRawQty(String(qty));
              }}
              className="flex-1 bg-transparent text-center text-2xl font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => changeQty(+(qty + 0.25).toFixed(2))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-white mr-1">+</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {([
            { label: "Calories", value: String(cal),       color: "text-white"      },
            { label: "Protein",  value: `${protein}g`,     color: "text-sky-400"    },
            { label: "Carbs",    value: `${carbs}g`,       color: "text-yellow-400" },
            { label: "Fat",      value: `${fat}g`,         color: "text-rose-400"   },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-slate-800 py-2 px-1">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <button onClick={confirmFood} disabled={saving}
          className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-60">
          {saving ? "Saving…" : `Add to ${mealLabel}`}
        </button>
      </div>
    );
  }

  // Search results view
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h3 className="text-base font-bold text-white">Search — {mealLabel}</h3>
      </div>
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="search" placeholder="Search foods…" value={query}
          onChange={onQueryChange} autoFocus
          className="w-full rounded-2xl border border-slate-700 bg-slate-800 py-3 pl-9 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
      </div>
      {searching && (
        <div className="flex items-center justify-center gap-2 py-1">
          <svg className="h-4 w-4 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-xs text-slate-400">Searching…</span>
        </div>
      )}
      <div className="max-h-[40vh] space-y-1 overflow-y-auto">
        {results.map(food => (
          <button key={food.id} onClick={() => selectFood(food)}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-xl bg-slate-800 px-3 py-3 text-left hover:bg-slate-700">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{food.name}</p>
              {food.brand && <p className="truncate text-xs text-slate-400">{food.brand}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${food.source === "USDA" ? "bg-blue-900 text-blue-300" : "bg-slate-700 text-slate-300"}`}>
              {food.source}
            </span>
            <span className="shrink-0 text-sm font-bold text-emerald-400">{food.cal} cal</span>
          </button>
        ))}
        {!searching && query && results.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">No results found</p>
        )}
      </div>
    </div>
  );
}

// ─── Barcode Scanner ──────────────────────────────────────────────────────────

// Scanned product shape (shared by USDA and Open Food Facts lookups)
type OFFProduct = {
  name: string;
  brand: string;
  servingLabel: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: "USDA" | "Open Food Facts";
};

// Returns the first numeric value from `obj` for the given keys, or 0.
function pickNutrient(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = parseFloat(String(obj[key]));
    if (!isNaN(v)) return v;
  }
  return 0;
}

// ── USDA barcode lookup (primary) ─────────────────────────────────────────────
// USDA branded-food nutrient values are per 100g — must scale by servingSize / 100.
async function lookupBarcodeUSDA(barcode: string): Promise<OFFProduct | null> {
  const apiKey = process.env.NEXT_PUBLIC_USDA_API_KEY ?? "DEMO_KEY";
  const res  = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&api_key=${apiKey}`
  );
  const data = await res.json();
  console.log("[Barcode USDA] raw response for", barcode, data);

  const foods: USDAFood[] = data.foods ?? [];
  // Require an exact UPC/GTIN match — search may return fuzzy results
  const food = foods.find(f => f.gtinUpc === barcode) ?? null;
  if (!food) {
    console.log("[Barcode USDA] no exact gtinUpc match, falling back to OFF");
    return null;
  }

  // Nutrient values are per 100g — scale to per-serving using servingSize
  const multiplier = (food.servingSize && food.servingSize > 0) ? food.servingSize / 100 : 1;
  const serving    = food.householdServingFullText
    ?? (food.servingSize ? `${food.servingSize} ${food.servingSizeUnit ?? "g"}` : "1 serving");

  const rawCal     = getNutrient(food, NUT_ENERGY);
  const rawProtein = getNutrient(food, NUT_PROTEIN);
  const rawCarbs   = getNutrient(food, NUT_CARBS);
  const rawFat     = getNutrient(food, NUT_FAT);

  const calories = rawCal     * multiplier;
  const protein  = rawProtein * multiplier;
  const carbs    = rawCarbs   * multiplier;
  const fat      = rawFat     * multiplier;

  console.log("[Barcode USDA] match:", food.description);
  console.log("[Barcode USDA] servingSize:", food.servingSize, food.servingSizeUnit, "| multiplier:", multiplier);
  console.log("[Barcode USDA] raw per-100g  — cal:", rawCal, "| protein:", rawProtein, "| carbs:", rawCarbs, "| fat:", rawFat);
  console.log("[Barcode USDA] per-serving   — cal:", Math.round(calories), "| protein:", +protein.toFixed(1), "| carbs:", +carbs.toFixed(1), "| fat:", +fat.toFixed(1));

  return {
    name:         food.description,
    brand:        food.brandName ?? food.brandOwner ?? "",
    servingLabel: `per serving (${serving})`,
    cal:          Math.round(calories),
    protein:      +protein.toFixed(1),
    carbs:        +carbs.toFixed(1),
    fat:          +fat.toFixed(1),
    source:       "USDA" as const,
  };
}

// ── Open Food Facts barcode lookup (fallback) ─────────────────────────────────
async function lookupBarcodeOFF(barcode: string): Promise<OFFProduct | null> {
  const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  // serving_quantity is the serving size in grams (e.g. 33 for a 33g serving).
  // All _100g nutriment values need to be scaled by (serving_quantity / 100).
  const servingGrams = parseFloat(String(p.serving_quantity));
  const multiplier   = (!isNaN(servingGrams) && servingGrams > 0) ? servingGrams / 100 : 1;
  const sLabel       = p.serving_size ?? (multiplier !== 1 ? `${servingGrams}g` : "100 g");

  console.log("[Barcode OFF] raw nutriments for", barcode, n);
  console.log("[Barcode OFF] serving_quantity:", p.serving_quantity, "| multiplier:", multiplier);

  // calories: per-100g × multiplier, then kJ fallback
  const cal = (() => {
    const kcal = pickNutrient(n, "energy-kcal_100g", "energy-kcal");
    if (kcal > 0) return kcal * multiplier;
    const kj = pickNutrient(n, "energy_100g", "energy");
    return kj > 0 ? (kj / 4.184) * multiplier : 0;
  })();

  return {
    name:         p.product_name ?? p.abbreviated_product_name ?? "Unknown product",
    brand:        p.brands ?? "",
    servingLabel: `per serving (${sLabel})`,
    cal:          Math.round(cal),
    protein:      +( pickNutrient(n, "proteins_100g", "proteins", "protein_100g", "protein")      * multiplier).toFixed(1),
    carbs:        +( pickNutrient(n, "carbohydrates_100g", "carbohydrates", "carbohydrate_100g") * multiplier).toFixed(1),
    fat:          +( pickNutrient(n, "fat_100g", "fat")                                          * multiplier).toFixed(1),
    source:       "Open Food Facts" as const,
  };
}

function BarcodeScanner({
  mealLabel,
  onSave,
  onBack,
}: {
  mealLabel: string;
  onSave: (data: LogPayload) => Promise<void>;
  onBack: () => void;
}) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const didScan     = useRef(false);

  type ScanStatus = "scanning" | "searching" | "found" | "pick" | "notfound" | "error";
  const [status,    setStatus]    = useState<ScanStatus>("scanning");
  const [product,   setProduct]   = useState<OFFProduct | null>(null);
  const [alternate, setAlternate] = useState<OFFProduct | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [errMsg,    setErrMsg]    = useState("");

  // Editable fields — populated (and re-populated by stepper) when status === "found"
  const [name,    setName]    = useState("");
  const [servings, setServings] = useState(1);
  const [rawQty,  setRawQty]  = useState("1");
  const [cal,     setCal]     = useState("");
  const [prot,    setProt]    = useState("");
  const [carbs,   setCarbs]   = useState("");
  const [fat,     setFat]     = useState("");

  // Per-1-serving base values so the stepper always scales from the original scan
  const baseRef = useRef({ cal: 0, prot: 0, carbs: 0, fat: 0 });

  function initFromProduct(p: OFFProduct) {
    baseRef.current = { cal: p.cal, prot: p.protein, carbs: p.carbs, fat: p.fat };
    setName(p.brand ? `${p.name} (${p.brand})` : p.name);
    setServings(1);
    setRawQty("1");
    setCal(String(p.cal));
    setProt(String(p.protein));
    setCarbs(String(p.carbs));
    setFat(String(p.fat));
  }

  function applyQty(q: number) {
    const b = baseRef.current;
    setServings(q);
    setRawQty(String(q));
    setCal(String(Math.round(b.cal * q)));
    if (b.prot  > 0) setProt(String(+(b.prot  * q).toFixed(1)));
    if (b.carbs > 0) setCarbs(String(+(b.carbs * q).toFixed(1)));
    if (b.fat   > 0) setFat(String(+(b.fat   * q).toFixed(1)));
  }

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat }, { default: DecodeHintType }] =
          await Promise.all([
            import("@zxing/browser"),
            import("@zxing/browser"),
            import("@zxing/library/esm/core/DecodeHintType"),
          ]);

        const hints = new Map();
        hints.set(DecodeHintType, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);

        const reader   = new BrowserMultiFormatReader(hints);
        const devices  = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = devices.length > 0 ? devices[devices.length - 1].deviceId : undefined;

        if (cancelled || !videoRef.current) return;

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          async (result) => {
            if (cancelled || didScan.current) return;
            if (!result) return;
            didScan.current = true;
            controls.stop();

            const barcode = result.getText();
            setStatus("searching");
            try {
              // Query both databases in parallel for best coverage
              const [usdaRes, offRes] = await Promise.allSettled([
                lookupBarcodeUSDA(barcode),
                lookupBarcodeOFF(barcode),
              ]);
              if (cancelled) return;

              const usda = usdaRes.status === "fulfilled" ? usdaRes.value : null;
              const off  = offRes.status  === "fulfilled" ? offRes.value  : null;

              if (!usda && !off) { setStatus("notfound"); return; }

              if (usda && off) {
                // If calorie values differ by more than 20%, let the user pick a source
                const diff = Math.abs(usda.cal - off.cal) / Math.max(usda.cal, off.cal, 1);
                if (diff > 0.2) {
                  setProduct(usda);
                  setAlternate(off);
                  setStatus("pick");
                  return;
                }
                // Values agree — prefer USDA
                initFromProduct(usda);
                setProduct(usda);
              } else {
                const chosen = usda ?? off!;
                initFromProduct(chosen);
                setProduct(chosen);
              }
              setStatus("found");
            } catch {
              if (!cancelled) {
                setErrMsg("Failed to look up product. Check your connection.");
                setStatus("error");
              }
            }
          }
        );
        controlsRef.current = controls;
      } catch {
        if (!cancelled) {
          setErrMsg("Camera access denied or unavailable.");
          setStatus("error");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []);

  async function confirmFood() {
    setSaving(true);
    await onSave({
      food_name:   name.trim() || "Unknown product",
      calories:    Math.round(Number(cal)  || 0),
      protein:     prot  ? +Number(prot).toFixed(1)  : null,
      carbs:       carbs ? +Number(carbs).toFixed(1) : null,
      fat:         fat   ? +Number(fat).toFixed(1)   : null,
      serving_qty: servings,
    });
    setSaving(false);
  }

  const inputCls = "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none";

  const SourceCard = ({ p, label }: { p: OFFProduct; label: string }) => (
    <button
      onClick={() => { initFromProduct(p); setProduct(p); setStatus("found"); }}
      className="flex-1 rounded-2xl bg-slate-800 p-4 text-left ring-1 ring-slate-700 hover:bg-slate-700 hover:ring-emerald-500 transition-colors"
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-bold text-white">{p.cal} cal</p>
      <p className="mt-0.5 text-xs text-slate-400">P {p.protein}g · C {p.carbs}g · F {p.fat}g</p>
    </button>
  );

  // ── Pick source: two databases returned significantly different values ─────
  if (status === "pick" && product && alternate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{product.name}</p>
            {product.brand && <p className="truncate text-xs text-slate-400">{product.brand}</p>}
          </div>
        </div>
        <p className="text-sm text-amber-400">Two sources found with different values — choose one:</p>
        <div className="flex gap-3">
          <SourceCard p={product}   label="USDA" />
          <SourceCard p={alternate} label="Open Food Facts" />
        </div>
      </div>
    );
  }

  // ── Found: editable fields + serving stepper ──────────────────────────────
  if (status === "found" && product) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{product.name}</p>
            {product.brand && <p className="truncate text-xs text-slate-400">{product.brand}</p>}
          </div>
        </div>

        {/* Source + serving label */}
        {product.source && (
          <p className="text-[11px] text-slate-500">
            Data from {product.source} · {product.servingLabel}
          </p>
        )}

        {/* Editable food name */}
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Food name"
          className={inputCls}
        />

        {/* Serving stepper */}
        <div className="rounded-2xl bg-slate-800 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-slate-400">Servings</p>
          <div className="flex items-center gap-4 pr-2">
            <button onClick={() => applyQty(Math.max(0.25, +(servings - 0.25).toFixed(2)))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xl font-bold text-white hover:bg-slate-600">−</button>
            <input
              type="number" inputMode="decimal" value={rawQty}
              onChange={e => {
                setRawQty(e.target.value);
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) applyQty(+v.toFixed(2));
              }}
              onBlur={e => {
                const v = parseFloat(e.target.value);
                if (isNaN(v) || v <= 0) applyQty(1);
              }}
              className="flex-1 bg-transparent text-center text-2xl font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => applyQty(+(servings + 0.25).toFixed(2))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-white hover:bg-slate-600 mr-1">+</button>
          </div>
        </div>

        {/* Editable nutrition fields */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Calories *</label>
            <input type="number" inputMode="decimal" value={cal}
              onChange={e => setCal(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Protein (g)</label>
            <input type="number" inputMode="decimal" value={prot}
              onChange={e => setProt(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Carbs (g)</label>
            <input type="number" inputMode="decimal" value={carbs}
              onChange={e => setCarbs(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="pl-1 text-xs text-slate-400">Fat (g)</label>
            <input type="number" inputMode="decimal" value={fat}
              onChange={e => setFat(e.target.value)} className={inputCls} />
          </div>
        </div>

        <button onClick={confirmFood} disabled={saving}
          className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-60">
          {saving ? "Saving…" : `Add to ${mealLabel}`}
        </button>
      </div>
    );
  }

  // ── Scanner / status views ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h3 className="text-base font-bold text-white">Scan Barcode — {mealLabel}</h3>
      </div>

      {/* Camera viewport */}
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />

        {status === "scanning" && (
          <>
            {/* Corner brackets */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative h-36 w-64">
                {/* TL */}<span className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
                {/* TR */}<span className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
                {/* BL */}<span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
                {/* BR */}<span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-emerald-400 rounded-br-sm" />
                {/* Animated scan line */}
                <div className="absolute inset-x-0 h-0.5 bg-emerald-400 opacity-80 animate-scan" />
              </div>
            </div>
          </>
        )}

        {status === "searching" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75">
            <p className="text-sm font-semibold text-white">Looking up product…</p>
          </div>
        )}
      </div>

      {status === "scanning" && (
        <p className="text-center text-sm text-slate-400">Point camera at a barcode</p>
      )}

      {status === "notfound" && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-amber-400">Product not found — try manual entry</p>
          <button onClick={onBack}
            className="w-full rounded-2xl border border-slate-700 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">
            Go Back
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-rose-400">{errMsg}</p>
          <button onClick={onBack}
            className="w-full rounded-2xl bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700">
            Go Back
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Saved Meals ──────────────────────────────────────────────────────────────

function SavedMealsView({
  mealLabel,
  onSave,
  onBack,
}: {
  mealLabel: string;
  onSave: (data: LogPayload) => Promise<void>;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [meals,   setMeals]   = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user || !supabase) return;
      const { data } = await supabase
        .from("saved_meals")
        .select("id, name, calories, protein, carbs, fat")
        .eq("user_id", user.id)
        .order("name");
      setMeals((data as SavedMeal[]) ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h3 className="text-base font-bold text-white">Saved Meals — {mealLabel}</h3>
      </div>
      {loading && <p className="py-4 text-center text-sm text-slate-400">Loading…</p>}
      {!loading && meals.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No saved meals yet.</p>
      )}
      <div className="max-h-[45vh] space-y-1 overflow-y-auto">
        {meals.map(meal => (
          <button
            key={meal.id}
            onClick={() => onSave({ food_name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, serving_qty: 1 })}
            className="flex min-h-[56px] w-full items-center justify-between rounded-xl bg-slate-800 px-4 py-3 text-left hover:bg-slate-700"
          >
            <span className="flex-1 truncate text-sm font-medium text-white">{meal.name}</span>
            <span className="ml-3 shrink-0 text-sm font-bold text-emerald-400">{meal.calories} cal</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Add Food Bottom Sheet ────────────────────────────────────────────────────

function AddFoodSheet({
  meal,
  onClose,
  onSaved,
}: {
  meal: typeof MEALS[number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user }  = useAuth();
  const [mode, setMode] = useState<SheetMode>("options");

  async function handleSave(data: LogPayload) {
    if (!user || !supabase) return;
    const { error } = await supabase.from("food_logs").insert({
      user_id:    user.id,
      meal_type:  meal.type,
      logged_at:  new Date().toISOString(),
      ...data,
    });
    if (error) {
      console.error("[FoodLog] insert error:", error);
      return;
    }
    await pushStreakUpdate(user.id);
    onSaved();
    onClose();
  }

  const options: { id: SheetMode; icon: string; label: string; sub: string }[] = [
    { id: "search",  icon: "🔍", label: "Search",       sub: "USDA database"  },
    { id: "barcode", icon: "📷", label: "Barcode",      sub: "Scan a product" },
    { id: "manual",  icon: "✏️", label: "Manual Entry", sub: "Enter yourself" },
    { id: "saved",   icon: "⭐", label: "Saved Meals",  sub: "Quick-add meals" },
  ];

  const content = (
    <>
      {/* Header row: title + close button */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-white">Add to {meal.label}</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" className="h-4 w-4">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto pb-2
        max-h-[calc(75vh-4rem)]
        md:max-h-[calc(80vh-4rem)]">
        {mode === "options" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {options.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className="flex min-h-[88px] flex-col items-start gap-1 rounded-2xl bg-slate-800 px-4 py-3.5 text-left hover:bg-slate-700"
                >
                  <span className="text-2xl leading-none">{opt.icon}</span>
                  <span className="mt-1 text-sm font-semibold text-white">{opt.label}</span>
                  <span className="text-[11px] text-slate-400">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "manual"  && <ManualEntry    mealLabel={meal.label} onSave={handleSave} onBack={() => setMode("options")} />}
        {mode === "search"  && <USDASearch      mealLabel={meal.label} onSave={handleSave} onBack={() => setMode("options")} />}
        {mode === "barcode" && <BarcodeScanner  mealLabel={meal.label} onSave={handleSave} onBack={() => setMode("options")} />}
        {mode === "saved"   && <SavedMealsView  mealLabel={meal.label} onSave={handleSave} onBack={() => setMode("options")} />}
      </div>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-slate-950/70" onClick={onClose} />

      {/* Mobile: bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-slate-900 px-4 pt-4 ring-1 ring-slate-700 md:hidden"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700" />
        {content}
      </div>

      {/* Desktop: centered modal */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center md:flex">
        <div className="w-full max-w-[500px] rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-700 shadow-2xl max-h-[80vh] flex flex-col">
          {content}
        </div>
      </div>
    </>
  );
}

// ─── Daily Totals ─────────────────────────────────────────────────────────────

function DailyTotals({ entries }: { entries: FoodEntry[] }) {
  const cal   = entries.reduce((s, e) => s + e.calories, 0);
  const prot  = entries.reduce((s, e) => s + (e.protein  ?? 0), 0);
  const carbs = entries.reduce((s, e) => s + (e.carbs    ?? 0), 0);
  const fat   = entries.reduce((s, e) => s + (e.fat      ?? 0), 0);

  return (
    <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Today&apos;s Total
      </p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {([
          { label: "Calories", value: String(cal),           color: "text-white"      },
          { label: "Protein",  value: `${prot.toFixed(0)}g`, color: "text-sky-400"    },
          { label: "Carbs",    value: `${carbs.toFixed(0)}g`,color: "text-yellow-400" },
          { label: "Fat",      value: `${fat.toFixed(0)}g`,  color: "text-rose-400"   },
        ] as const).map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function FoodLogPage() {
  const { user } = useAuth();
  const [entries,       setEntries]       = useState<FoodEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [expandedMeal,  setExpandedMeal]  = useState<MealType | null>(null);
  const [sheetMeal,     setSheetMeal]     = useState<typeof MEALS[number] | null>(null);
  const [editingEntry,  setEditingEntry]  = useState<FoodEntry | null>(null);

  const loadEntries = useCallback(async () => {
    if (!user || !supabase) return;
    const { start, end } = todayRange();
    const { data, error } = await supabase
      .from("food_logs")
      .select("id, food_name, calories, protein, carbs, fat, meal_type, serving_qty, logged_at")
      .eq("user_id", user.id)
      .gte("logged_at", start)
      .lt("logged_at", end)
      .order("logged_at", { ascending: true });
    if (error) console.error("[FoodLog] load error:", error);
    setEntries((data as FoodEntry[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleDelete(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("food_logs").delete().eq("id", id);
    if (!error) setEntries(prev => prev.filter(e => e.id !== id));
  }

  async function handleSaveEdit(id: string, data: LogPayload) {
    if (!supabase) return;
    const { error } = await supabase
      .from("food_logs")
      .update(data)
      .eq("id", id);
    if (!error) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
      setEditingEntry(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 pb-6">
        {/* Header */}
        <header className="pt-2">
          <h1 className="text-xl font-bold text-white">Food Log</h1>
          <p className="text-xs text-slate-400">{todayLabel()}</p>
        </header>

        {/* Meal sections */}
        {MEALS.map(meal => (
          <MealSection
            key={meal.type}
            meal={meal}
            entries={entries.filter(e => (e.meal_type ?? "snack") === meal.type)}
            expanded={expandedMeal === meal.type}
            onToggle={() => setExpandedMeal(prev => prev === meal.type ? null : meal.type)}
            onAddFood={() => { setExpandedMeal(meal.type); setSheetMeal(meal); }}
            onDelete={handleDelete}
            onEdit={setEditingEntry}
          />
        ))}

        {/* Daily totals */}
        <DailyTotals entries={entries} />
      </div>

      {/* Add food sheet */}
      {sheetMeal && (
        <AddFoodSheet
          meal={sheetMeal}
          onClose={() => setSheetMeal(null)}
          onSaved={loadEntries}
        />
      )}

      {/* Edit food modal */}
      {editingEntry && (
        <EditFoodModal
          entry={editingEntry}
          onSave={handleSaveEdit}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </>
  );
}
