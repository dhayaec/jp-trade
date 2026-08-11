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
pnpm lint          # ESLint (flat config)
pnpm type-check    # tsc --noEmit
pnpm test          # Vitest unit tests
pnpm test:coverage # Vitest with v8 coverage
pnpm test:e2e      # Playwright (requires `pnpm build` first)
```

CI runs lint → type-check → test → build on every push to `main` and PR
(`.github/workflows/ci.yml`).

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
