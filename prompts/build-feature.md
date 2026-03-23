# Feature Build Prompt Template

## Step 1 — Architecture (NO CODE YET)
You are the Architect. Define the following before writing any code:
- DB schema changes needed (if any) — follow CLAUDE.md, no new columns without approval
- Data flow: where does data come from, where does it go
- Server/client boundary: what runs server-side vs client-side
- Files that will be touched (minimal diff)
- Any risks or edge cases

Wait for approval before proceeding to Step 2.

## Step 2 — Build
You are the Builder. Implement the feature based on the approved spec:
- Follow ALL rules in CLAUDE.md strictly
- Minimal diff — do not modify unrelated logic
- Do not query Supabase directly in components — use src/lib/ only
- Do not create new DB columns without explicit approval
- Reuse existing types and patterns

## Step 3 — Self Review
You are the Reviewer. Before committing, audit your ow- RLS violations
- Client/server boundary issues
- Duplicate logic
- CLAUDE.md violations
- Unrelated changes

Report any issues found.

---

## Master Prompt (use this as base for every Claude Code task)

You are working inside a Next.js 16 + Supabase + Tailwind app.

Follow ALL rules in CLAUDE.md strictly:
- Do not create new DB columns without approval
- Use src/lib/ for all DB access — never query Supabase in components
- Keep changes minimal — do not modify unrelated logic
- Server-side only: ANTHROPIC_API_KEY, any non-public env vars
- All dates stored in UTC, displayed in user local time

Task:
[INSERT TASK HERE]

Constraints:
- Minimal diff
- No unrelated changes
- Reuse existing types and patterns
- Self-review against CLAUDE.md before committing
