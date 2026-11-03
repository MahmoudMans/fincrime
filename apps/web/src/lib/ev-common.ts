/**
 * Small pure helpers shared by the evidence, audit and release
 * screens. No React in here so that they can be unit tested.
 */

/** Value of a filter that does not narrow anything. */
export const ALL = "ALL";

/** True for the error fetch rejects with when a request is aborted. */
export function isAbort(failure: unknown): boolean {
  return (
    failure instanceof DOMException &&
    failure.name === "AbortError"
  );
}

export function failureMessage(
  failure: unknown,
  fallback: string
): string {
  return failure instanceof Error && failure.message
    ? failure.message
    : fallback;
}

/** ISO 8601 (UTC) for exports; the raw text when it is not a date. */
export function isoOrRaw(
  value: string | null | undefined
): string {
  if (!value) {
    return "";
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time)
    ? value
    : new Date(time).toISOString();
}

export function uniqueSorted(
  values: ReadonlyArray<string | null | undefined>
): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value !== ""
      )
    )
  ).sort((left, right) => left.localeCompare(right));
}

/** Usernames are compared the way the backend does: trimmed, no case. */
export function sameUser(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    left.trim() !== "" &&
    left.trim().toLowerCase() === right.trim().toLowerCase()
  );
}

/**
 * Saved views come back from localStorage as unknown JSON. These two
 * keep a damaged or old entry from putting a filter into a shape
 * the screen cannot handle.
 */
export function pickText(
  value: unknown,
  maxLength = 200
): string {
  return typeof value === "string"
    ? value.slice(0, maxLength)
    : "";
}

export function pickChoice(
  value: unknown,
  allowed: readonly string[],
  fallback: string = ALL
): string {
  return typeof value === "string" &&
    (value === fallback || allowed.includes(value))
    ? value
    : fallback;
}

/** Plain text for a value kept in a saved view; ALL when blank. */
export function pickFreeChoice(value: unknown): string {
  return typeof value === "string" && value !== ""
    ? value.slice(0, 200)
    : ALL;
}

/** YYYY-MM-DD or "" (what an <input type="date"> holds). */
export function pickDate(value: unknown): string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : "";
}

export function asRecord(
  value: unknown
): Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Options for a select whose choices come from the data, keeping the
 * currently selected value in the list even when the data no longer
 * contains it (a saved view, or data that changed after a reload).
 * `counts` adds the number of rows behind each choice.
 */
export function dataOptions(
  values: readonly string[],
  current: string,
  allLabel: string,
  counts: Record<string, number>,
  total: number,
  label: (value: string) => string = (value) => value
): { value: string; label: string; count: number }[] {
  const all =
    current !== ALL && !values.includes(current)
      ? [...values, current]
      : values;

  return [
    { value: ALL, label: allLabel, count: total },
    ...all.map((value) => ({
      value,
      label: label(value),
      count: counts[value] ?? 0,
    })),
  ];
}
