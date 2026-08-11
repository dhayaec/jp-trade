import { expect } from 'vitest';

/**
 * Assert a value is defined and return it narrowed to its non-null type.
 *
 * Replaces the two-step `expect(x).not.toBeNull(); x!.field` pattern that trips
 * `@typescript-eslint/no-non-null-assertion`. The `as` cast is safe because the
 * `expect` line fails the test before the narrowed value is ever used.
 */
export function expectDefined<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}
