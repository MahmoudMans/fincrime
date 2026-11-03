/** Case-insensitive match; every word of the query must appear. */
export function matchesQuery(
  query: string,
  fields: ReadonlyArray<string | number | null | undefined>
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return true;
  }

  const haystack = fields
    .map((field) => (field ?? "").toString().toLowerCase())
    .join(" ");

  return words.every((word) => haystack.includes(word));
}

export function pageCount(total: number, size: number) {
  return Math.max(1, Math.ceil(total / size));
}

/** Keeps `page` inside the available pages (0-based). */
export function clampPage(
  page: number,
  total: number,
  size: number
) {
  return Math.min(Math.max(0, page), pageCount(total, size) - 1);
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  size: number
): T[] {
  const safe = clampPage(page, items.length, size);

  return items.slice(safe * size, safe * size + size);
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`
) {
  return count === 1 ? singular : pluralForm;
}

/** Counts items per key, e.g. alerts per severity. */
export function countBy<T>(
  items: readonly T[],
  key: (item: T) => string
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const value = key(item);

    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}
