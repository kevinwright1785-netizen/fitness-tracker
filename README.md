## Fitness Tracker PWA

A simple fitness tracking Progressive Web App built with **Next.js**, **Tailwind CSS**, and **Supabase**. It focuses on:

- Food logging
- Macro tracking (calories, protein, carbs, fats)
- Weight tracking
- A mobile-first dashboard that is iPhone friendly

### Getting started

1. **Install dependencies**

```bash
npm install
```

2. **Set up Supabase**

- Create a new project in Supabase.
- Copy the project URL and anon key into a new `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit `.env` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

3. **Run the dev server**

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### PWA notes

- The app includes a `manifest.json` and mobile-friendly layout.
- On iPhone:
  - Open the site in Safari.
  - Tap the **Share** button.
  - Choose **Add to Home Screen** to install it like an app.

### Where to add real data

- Supabase client is set up in `src/lib/supabaseClient.ts`.
- You will:
  - Create tables in Supabase for food logs, macros, and weights.
  - Replace the placeholder text in:
    - `FoodLogSection` to save and show real logs.
    - `MacrosSection` to calculate macros from logs.
    - `WeightSection` to store and list weigh-ins.

