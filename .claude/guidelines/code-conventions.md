# Code Conventions

Enforced by ESLint (`eslint.config.mjs`), TypeScript (`tsconfig.json`), and
Prettier (`.prettierrc`). Keep these in mind when writing code.

## TypeScript — strict by default

`tsconfig.json` enables `strict` plus:

- `noUncheckedIndexedAccess` — array/object index access returns
  `T | undefined`.
- `exactOptionalPropertyTypes` — optional props are exactly that; no `undefined`
  short-hand.
- `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`.

Conventions:

- No `any`. Reach for `unknown` and narrow, or a proper type.
- No unused variables/parameters (prefix throwaway args with `_`).
- Type-only imports: `import { type Foo }` (enforced by ESLint).
- No non-null assertions (`!`) unless genuinely unavoidable — it's a warning.
- Prefer discriminated unions and exhaustive switches over `any`/casting.

## React & rendering

- Server-first: prefer React Server Components / server data fetching; use
  client components only where interactivity is required.
- No `console.log`/`debugger` in application code. `console.warn` and
  `console.error` are allowed.
- No array-index keys (`index` as a `key`); derive a stable id.
- No useless fragments (`<>...</>` wrapping a single element).
- Keep effects free of set-state-in-effect where a render-time derivation works;
  avoid setting state synchronously inside `useEffect`.

## Formatting

- Prettier: printWidth 100, single quotes, trailing comma `es5`, LF endings.
- Tailwind classes are canonicalized by
  `prettier-plugin-tailwindcss-canonical-classes`.
- `.prettierignore` excludes build output and YAML (Prettier has no YAML
  parser).

## Data & boundaries

- Validate all user input with Zod at the system boundary (server actions, API
  routes) before it touches business logic.
- Validate environment variables at runtime with a small Zod schema; never trust
  `.env` values are set.
- Keep data access behind a service/repository layer; UI code should not call
  the database client directly.

## Environment & config

- Copy `.env.example` to `.env` for local development. Real secrets never get
  committed.
- Keep feature flags and environment-gated behavior explicit and documented.
