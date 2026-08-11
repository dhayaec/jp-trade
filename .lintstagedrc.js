/**
 * Lint-staged runs on staged files before commit.
 * Type-checking happens in the pre-push hook and CI, not here,
 * because per-file `tsc` is slow and doesn't respect project context.
 */
module.exports = {
  '*.{js,jsx,ts,tsx,mjs,mts,cts}': ['prettier --write', 'eslint --fix'],
  '*.{json,md,css,scss,sass,html}': ['prettier --write'],
};
