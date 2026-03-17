# TrackRight — Claude Code Standards

## Project Overview
TrackRight is a fitness tracking PWA built with Next.js, TypeScript, Tailwind CSS, and Supabase. Target users are US-based. All measurements use imperial units (lbs, feet/inches).

## Tech Stack
- Next.js 16 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Supabase (auth + database)
- Deployed on Vercel

## Coding Standards

### General
- Always use TypeScript strictly — no `any` types unless absolutely necessary
- Always handle errors gracefully — never let the app crash silently
- Always show user-friendly error messages, never raw error objects
- Never repeat code — create reusable components for anything used more than once
- Keep components small and focused — one component, one job
- Always use environment variables for secrets — never hardcode keys

### Security
- Never expose secret keys in code or logs
- Never put real values in .env.example — placeholders only
- Always validate user input before saving to database
- Always check authentication before any data operation
- Never trust client-side data — validate on the server

### Database
- Always use Supabase RLS — every table must have policies
- Always filter by user_id for any data query
- Always handle null/empty states gracefully
- Use upsert instead of insert where duplicate conflicts are possible

### UI/UX
- Dark mode throughout — maintain existing color scheme
- Mobile first — always design for iPhone screen sizes first
- Minimum 44px tap targets for all buttons
- Always show loading states when fetching data
- Always show success/error feedback after user actions
- All measurements in imperial units (lbs, feet, inches)

### Performance
- Never fetch data you don't need — only select required columns
- Avoid duplicate API calls
- Always cancel subscriptions and event listeners on unmount

### Code Organization
- Pages go in src/app/
- Reusable components go in src/components/
- Database queries go in src/lib/
- Helper functions go in src/utils/
- Types go in src/types/

## Database Schema
- profiles — user settings, goals, TDEE calculations
- food_logs — daily food entries (resets at midnight local time)
- weight_logs — ongoing weight entries
- steps_logs — daily step counts (replaces, does not sum)

## Known Patterns
- Steps replace daily total, never sum
- Calories reset at midnight local time per user
- TDEE recalculates when weight, goal, or activity level changes
- onboarding_complete flag gates dashboard access
- Greeting splash shows once per session via sessionStorage
- .env is gitignored — never commit real keys
