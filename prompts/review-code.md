# Code Review Prompt Template

You are the Reviewer. Audit the following code/feature against these criteria:

## Security
- [ ] No API keys or secrets exposed client-side
- [ ] RLS policies in plaor all Supabase queries
- [ ] No user data accessible without auth check

## Architecture
- [ ] No Supabase queries directly in components (must use src/lib/)
- [ ] Server/client boundaries respected
- [ ] No duplicate logic

## CLAUDE.md Compliance
- [ ] No undocumented new DB columns
- [ ] Timezone handling correct (UTC stored, local displayed)
- [ ] No unrelated code modified

## Code Quality
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] Types used correctly, no 'any'
- [ ] Components under 300 lines where possible

Report all violations with file name and line number.
