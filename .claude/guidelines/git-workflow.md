# Git Workflow

## Branches

Work in short-lived branches and merge to `main` via pull request:

- `feature/...` — new functionality
- `fix/...` — bug fixes
- `chore/...` — tooling, dependencies, housekeeping
- `perf/...`, `docs/...`, `refactor/...` — as the type implies

Branch from the latest `main`. Prefer squash merges to keep `main` history
linear and readable.

## Commits — Conventional Commits with a mandatory scope

commitlint (`.commitlintrc.js`) enforces the format:

```
type(scope): subject

optional body

optional footer
```

- **Scope is required** and must be kebab-case.
- Subject is lowercase, no trailing period, header ≤ 100 chars.
- Blank lines around body and footer; lines ≤ 100 chars.

Twelve types:
`feat fix docs style refactor perf test chore ci security a11y revert`.

Examples:

```
feat(auth): add OAuth2 login with Google    valid
fix(cart): resolve price rounding bug       valid
chore(tooling): wire up husky hooks         valid
feat: add login flow                        invalid (no scope)
Added new feature                           invalid (no type)
feat(api): Add endpoint                     invalid (uppercase subject)
```

## Hooks

| Hook         | Runs                                                          |
| ------------ | ------------------------------------------------------------- |
| `pre-commit` | `npx lint-staged` — Prettier + ESLint `--fix` on staged files |
| `commit-msg` | `npx --no -- commitlint --edit "$1"` — validates the message  |
| `pre-push`   | `pnpm type-check`                                             |

Bypass with `--no-verify` only in an emergency — it skips every check for that
single operation.

## Pull requests

- One logical change per PR; keep the title as the intended squash message.
- CI (`quality` + `e2e` jobs) must pass before merge.
- If the base branch has branch protection, no direct pushes to `main` — all
  changes land via PR. See `branch-protection-rules.md` for the recommended
  rule.

## Branch protection

`main` should require: PR reviews (1 approval), the `quality` status check, up
to date before merging, and block force pushes and deletions. The exact commands
are in `branch-protection-rules.md`.
