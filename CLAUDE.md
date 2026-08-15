# CLAUDE.md

Project rules for this repository (and for every project scaffolded from this
template). Full rules live in `.claude/guidelines/`; this file is the entry
point.

## Toolchain (pnpm only — never mix npm/yarn)

```bash
pnpm install     # install dependencies (runs `prepare` → husky hooks)
pnpm dev         # development server
pnpm build       # production build
pnpm start       # run the production build
```

Quality gates — all must pass before merging:

```bash
pnpm lint          # ESLint (flat config) — CI only
pnpm type-check    # tsc --noEmit — pre-push hook + CI
pnpm test          # Vitest unit tests
pnpm test:coverage # Vitest with v8 coverage
pnpm test:e2e      # Playwright — CI only (requires `pnpm build` first)
```

CI (`.github/workflows/ci.yml`) runs `quality` (lint → type-check → test) and
`build` in parallel, then `e2e` against the uploaded build artifact, then a
`gate` job that depends on all three. Set branch protection on the `gate` status
check to require all jobs to pass.

## Git workflow

- Short-lived branches: `feature/...`, `fix/...`, `chore/...`; merge to `main`
  via PR, prefer squash.
- Commits must be Conventional Commits with a **mandatory kebab-case scope**:
  `type(scope): subject` (see `.claude/guidelines/git-workflow.md`).
- `--no-verify` is an emergency-only exception.
- Branch protection on `main` requires the `quality` status check.

## Code conventions (summary)

- Strict TypeScript: no `any`, no unused vars, type-only imports.
- No `console.log`/`debugger` in application code (`console.warn`/`error` ok).
- Server-first rendering; validate all user input with Zod at the boundary;
  validate env vars at runtime.
- Run `pnpm format` before committing if your editor isn't wired to Prettier.

See `.claude/guidelines/code-conventions.md` and
`.claude/guidelines/toolchain.md` for details.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` (resolved from this file's directory; in
monorepos the `next` package may not be visible from the repo root) before
writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at
`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a
diff only re-creates the uncommitted change; committing it with your work keeps
the tree clean.

<!-- END:nextjs-agent-rules -->
