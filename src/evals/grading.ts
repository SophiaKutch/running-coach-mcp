/**
 * Pure, dependency-free grading primitives for the eval harness. These are
 * unit tested on their own (see __tests__/grading.test.ts) precisely so
 * that the part of this project that scores "did the model get it right"
 * is itself trustworthy -- an eval harness with buggy grading logic is
 * worse than no eval harness, because it's confidently wrong.
 */

export function containsAll(text: string, substrings: string[]): boolean {
  const haystack = text.toLowerCase();
  return substrings.every((s) => haystack.includes(s.toLowerCase()));
}

export function containsAny(text: string, substrings: string[]): boolean {
  const haystack = text.toLowerCase();
  return substrings.some((s) => haystack.includes(s.toLowerCase()));
}

/**
 * Scans the text for any number (integer or decimal) and returns true if at
 * least one is within `tolerance` of `target`. This is intentionally
 * lenient about formatting (e.g. "13.1 mi" vs "13.11 miles") but still
 * strict about the actual value -- a model that reports the wrong number
 * in otherwise-plausible-looking prose should still fail.
 */
export function containsNumberNear(text: string, target: number, tolerance: number): boolean {
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches) return false;
  return matches.some((m) => Math.abs(parseFloat(m) - target) <= tolerance);
}

/**
 * True if every tool in `expectedTools` appears at least once in
 * `calledTools`. Extra tool calls beyond what's expected are fine --
 * this only flags the case that actually matters for a grounding check:
 * did it skip the tool it needed and guess instead?
 */
export function toolsCoverExpected(calledTools: string[], expectedTools: string[]): boolean {
  const called = new Set(calledTools);
  return expectedTools.every((t) => called.has(t));
}
