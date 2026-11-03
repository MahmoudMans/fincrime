"use client";

import { useCallback, useEffect, useRef } from "react";

import type { Option } from "@/components/list-tools";

/** Unique values, in first-seen order. */
export function distinct(values: Iterable<string>): string[] {
  return Array.from(new Set(values));
}

/** Orders values by their position in `order`, the rest A to Z. */
export function rankSort(
  values: readonly string[],
  order: readonly string[]
): string[] {
  const rank = (value: string) => {
    const index = order.indexOf(value);

    return index === -1 ? order.length : index;
  };

  return [...values].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  );
}

/** "All statuses" followed by one option per value, with counts. */
export function allOptions(
  allLabel: string,
  values: readonly string[],
  counts: Readonly<Record<string, number>>,
  label: (value: string) => string
): Option<string>[] {
  return [
    { value: "ALL", label: allLabel, count: counts.ALL ?? 0 },
    ...values.map((value) => ({
      value,
      label: label(value),
      count: counts[value] ?? 0,
    })),
  ];
}

/**
 * Lets an async handler skip its state updates when the screen was
 * left while a request was still running.
 */
export function useIsMounted(): () => boolean {
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  return useCallback(() => mounted.current, []);
}
