/**
 * Lint-staged runs on staged files before commit — Prettier only (fast).
 *
 * ESLint and type-checking run in CI and the pre-push hook, not here.
 * Full-project `eslint` is too slow for the pre-commit path.
 */
module.exports = {
  '*.{js,jsx,ts,tsx,mjs,mts,cts}': ['prettier --write'],
  '*.{json,md,css,scss,sass,html}': ['prettier --write'],
};
