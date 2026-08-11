# Toolchain

Day-to-day reference for the quality toolchain. Commands assume **pnpm** (pnpm
11); do not mix in npm/yarn.

## Quick start

```bash
pnpm install     # install dependencies
pnpm prepare     # install husky hooks (also runs automatically on install)
pnpm dev         # development server
```

## Scripts

| Script          | Runs                               |
| --------------- | ---------------------------------- |
| `dev`           | `next dev`                         |
| `build`         | `next build`                       |
| `start`         | `next start`                       |
| `lint`          | ESLint over the repo (flat config) |
| `lint:fix`      | ESLint with `--fix`                |
| `format`        | Prettier `--write .`               |
| `format:check`  | Prettier `--check .`               |
| `type-check`    | `tsc --noEmit`                     |
| `test`          | `vitest run`                       |
| `test:watch`    | `vitest` (watch mode)              |
| `test:coverage` | `vitest run --coverage` (v8)       |
| `test:e2e`      | `playwright test`                  |
| `prepare`       | `husky` (installs git hooks)       |

## Enforcement layers

1. **Editor (on save)** — VS Code runs Prettier + ESLint fix-on-save
   (`.vscode/settings.json`).
2. **Pre-commit** — Husky runs `lint-staged`: Prettier + ESLint `--fix` on
   staged files only. Type-check is deliberately left to pre-push/CI (per-file
   `tsc` is slow and not project-scoped).
3. **Commit message** — Husky's `commit-msg` hook runs commitlint
   (`.commitlintrc.js`).
4. **Pre-push** — Husky's `pre-push` hook runs `pnpm type-check`.
5. **CI** — `.github/workflows/ci.yml` runs the full gate on push to `main` and
   every PR: lint → type-check → test (with coverage) → build, plus a Playwright
   E2E job. Concurrency cancels superseded runs.

## Tests

- Vitest 4, jsdom environment, React plugin; tests live in
  `tests/**/*.test.{ts,tsx}`.
- Playwright E2E lives in `e2e/` and runs against `next start` on port 3100
  (build with `pnpm build` first).

## Troubleshooting

| Symptom                      | Fix                                                          |
| ---------------------------- | ------------------------------------------------------------ |
| Hooks not running            | Run `pnpm prepare` to reinstall husky hooks                  |
| Commit rejected              | Follow `type(scope): subject`; see `git-workflow.md`         |
| Prettier reformats on commit | Expected — lint-staged writes formatting on staged files     |
| New ESLint rule needed       | Add it to the `project/strict` block in `eslint.config.mjs`  |
| CI fails, passes locally     | Reinstall with `pnpm install --frozen-lockfile`; use Node 22 |
