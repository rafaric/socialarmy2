# Skill Registry — socialarmy2

## User Skills

| Skill | Triggers |
|-------|----------|
| nextjs-best-practices | Next.js App Router, Server Components, data fetching, routing |
| framer-motion-animator | Framer Motion, animations, page transitions, micro-interactions |
| shadcn-ui-conventions | shadcn/ui components, retro-styled UI |
| branch-pr | Creating pull requests, PRs |
| issue-creation | GitHub issues, bug reports, feature requests |
| judgment-day | Adversarial review, dual review, "judgment day" |
| go-testing | Go tests, Bubbletea TUI testing |
| skill-creator | Creating new skills |

## Project Conventions

Source: `/Users/rafaric/.claude/CLAUDE.md`

### Key Rules
- Conventional commits, no AI attribution
- Never build after changes — typecheck only
- No cat/grep/find/sed — use dedicated tools
- Never agree without verification

### Compact Rules (inject into sub-agents)

```
STACK: Next.js 16 App Router, TypeScript, Bun, Supabase, React Query v5, Zustand v5, Framer Motion, Tailwind v4
PATTERNS:
- Data: useQuery/useMutation hooks in src/hooks/
- API: src/app/api/ — use admin client to bypass RLS for writes
- Auth: proxy.ts middleware, createClient() server-side
- Types: src/types/index.ts
COMMITS: conventional commits, no Co-Authored-By
TYPECHECK: run `bunx tsc --noEmit` after changes (never build)
TESTING: vitest + @testing-library/react, run `bun run test:run`
STRICT TDD: write tests before implementation
```
