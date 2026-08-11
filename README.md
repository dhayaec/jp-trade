# Next.js Starter Template

A lean, fully-wired quality toolchain for a new Next.js App Router project.
Extracted from a production app so every config below is verified working —
nothing here references tools that are not installed.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS 4 + shadcn/ui (`components.json` included)
- **Data:** PostgreSQL + Prisma 7 (schema placeholder included)
- **Tooling:** pnpm 11, flat ESLint, Prettier, husky + commitlint + lint-staged,
  Vitest (unit), Playwright (E2E), GitHub Actions CI

## Toolchain at a glance

| Concern          | Tool           | Config file                               | Runs on                |
| ---------------- | -------------- | ----------------------------------------- | ---------------------- |
| Linting          | ESLint 9       | `eslint.config.mjs`                       | save / pre-commit / CI |
| Formatting       | Prettier 3     | `.prettierrc`, `.prettierignore`          | save / pre-commit / CI |
| Type checking    | tsc            | `tsconfig.json`                           | pre-push / CI          |
| Unit tests       | Vitest 4       | `vitest.config.mts`, `tests/`             | pre-push / CI          |
| Commit messages  | commitlint     | `.commitlintrc.js`                        | commit-msg hook        |
| Staged-file lint | lint-staged    | `.lintstagedrc.js`                        | pre-commit hook        |
| Git hooks        | Husky 9        | `.husky/{pre-commit,commit-msg,pre-push}` | commit / push          |
| CI               | GitHub Actions | `.github/workflows/ci.yml`                | push to main / PR      |

## Getting started

```bash
pnpm install     # installs deps + husky hooks (via `prepare`)
pnpm dev         # http://localhost:3000
```

Copy `.env.example` to `.env` and fill in what your app needs.

## Quality gates

```bash
pnpm lint           # ESLint
pnpm type-check     # tsc --noEmit
pnpm test           # Vitest, single run
pnpm test:coverage  # Vitest with v8 coverage
pnpm build          # production build
pnpm test:e2e       # Playwright (build first)
```

Commits must follow `type(scope): subject` (enforced by commitlint). See
`CLAUDE.md` and `.claude/guidelines/` for the full rules: git workflow, code
conventions, and toolchain reference. `branch-protection-rules.md` has the
recommended GitHub branch protection matching the `quality` CI check.

## Use as a template

Either click **Use this template** on the GitHub repo, or copy the repository
and re-init:

```bash
git clone <this-repo> my-new-project
cd my-new-project
rm -rf .git && git init && git add -A && git commit -m "chore(tooling): bootstrap"
```

Then rename the package in `package.json`, drop the placeholder
`prisma/schema.prisma`, `src/`, `tests/`, and `e2e/` samples as your app takes
shape, and set up the secrets your app needs (CI env in
`.github/workflows/ci.yml`).

## Structure

```
.claude/
  guidelines/          # generic project rules (git workflow, conventions, toolchain)
  settings.json        # Claude Code settings (personal ones go in settings.local.json, gitignored)
.github/workflows/     # CI
.husky/                # git hooks
.vscode/               # editor settings + recommended extensions
prisma/                # schema placeholder (Prisma 7)
src/app/               # minimal App Router scaffold
src/lib/               # cn() helper (shadcn)
tests/                 # Vitest setup + smoke test
e2e/                   # Playwright smoke spec
```

## Notes

- `.env.example` is a generic starting point; real env vars are app-specific.
- `.claude/settings.local.json` is gitignored — put machine- or user-specific
  Claude settings there, not in the shared `settings.json`.
- Line endings are LF (`.gitattributes`); on Windows keep `core.autocrlf` off or
  use `git add --renormalize .` if status shows phantom changes.
