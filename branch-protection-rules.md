# GitHub Branch Protection

Recommended branch protection for `main`. CI produces exactly one status check,
the `quality` job from `.github/workflows/ci.yml`, so that is the check to
require.

## Enforce on `main`

### Via the GitHub CLI

```bash
gh api repos/:owner/:repo/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["quality"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"required_approving_review_count":1}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

### Via the web UI

1. Repository → Settings → Branches → _Add branch protection rule_.
2. Branch name pattern: `main`.
3. Require pull request reviews before merging (1 approval).
4. Require status checks to pass → select `quality`.
5. Require branches to be up to date before merging.
6. Block force pushes and deletions.

## What the `quality` check runs

`pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`. See
`.github/workflows/ci.yml`.

## Optional: CODEOWNERS

A `.github/CODEOWNERS` file can require specific reviewers for paths, e.g.:

```
*.md @docs-team
package.json @tech-lead
```

## Bypassing (emergencies only)

Keep "Enforce admins" enabled so admins follow the same rules. If a force push
is unavoidable, prefer `git rebase` + normal push over `git push -f`, and only
after the protection rule is temporarily lifted.
