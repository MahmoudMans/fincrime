"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { Option } from "@/components/list-tools";
import { humanize } from "@/lib/format";
import { countBy } from "@/lib/list-utils";

export const ALL = "ALL";

export const PRIORITY_ORDER = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

export function errorText(failure: unknown, fallback: string) {
  return failure instanceof Error && failure.message
    ? failure.message
    : fallback;
}

/**
 * Options for a chip group or select: "All" first, then one entry per
 * value found in `values` with its row count. `order` fixes the order
 * of known values, `always` lists values to show even with a count of
 * zero, and `keep` is the currently selected value, so that a filter
 * never points at an option that is not offered.
 */
export function countOptions(
  values: readonly string[],
  allLabel: string,
  extra: {
    order?: readonly string[];
    always?: readonly string[];
    keep?: string;
    tones?: Record<string, Option<string>["tone"]>;
    label?: (value: string) => string;
  } = {}
): Option<string>[] {
  const counts = countBy(values, (value) => value);
  const keys = new Set<string>(Object.keys(counts));

  for (const value of extra.always ?? []) {
    keys.add(value);
  }

  if (extra.keep && extra.keep !== ALL) {
    keys.add(extra.keep);
  }

  const order = extra.order ?? [];

  const rank = (value: string) => {
    const index = order.indexOf(value);

    return index === -1 ? order.length : index;
  };

  const sorted = Array.from(keys).sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  );

  const label = extra.label ?? humanize;

  return [
    { value: ALL, label: allLabel, count: values.length },
    ...sorted.map((value) => ({
      value,
      label: label(value),
      count: counts[value] ?? 0,
      tone: extra.tones?.[value],
    })),
  ];
}

export interface ActionRunner {
  /** Key of the action in flight, or null. */
  pending: string | null;
  error: string | null;
  notice: string | null;
  /**
   * Runs one action at a time. A second call while one is running is
   * ignored, which also covers a double click before the button has
   * had time to disable itself. The task returns the success message.
   */
  run: (
    key: string,
    task: () => Promise<string>,
    fallback: string
  ) => Promise<void>;
  dismiss: () => void;
}

export function useActionRunner(): ActionRunner {
  const busy = useRef(false);

  const alive = useRef(true);

  const [pending, setPending] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (
      key: string,
      task: () => Promise<string>,
      fallback: string
    ) => {
      if (busy.current) {
        return;
      }

      busy.current = true;
      setPending(key);
      setError(null);
      setNotice(null);

      try {
        const message = await task();

        if (alive.current) {
          setNotice(message);
        }
      } catch (failure) {
        if (alive.current) {
          setError(errorText(failure, fallback));
        }
      } finally {
        busy.current = false;

        if (alive.current) {
          setPending(null);
        }
      }
    },
    []
  );

  const dismiss = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  return { pending, error, notice, run, dismiss };
}

/**
 * Filter state with a page number. Changing a filter returns to the
 * first page; `current` is the state without paging, for SavedViews.
 * Pass a module-level constant for `defaults`.
 */
export function useFilterState<F extends object>(
  defaults: F
) {
  const [filters, setFilters] = useState<F>(defaults);

  const update = useCallback((patch: Partial<F>) => {
    setFilters((current) => ({ ...current, ...patch, page: 0 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
  }, []);

  const reset = useCallback(() => {
    setFilters(defaults);
  }, [defaults]);

  const apply = useCallback(
    (saved: Partial<F>) => {
      setFilters({ ...defaults, ...saved, page: 0 });
    },
    [defaults]
  );

  const current: F = { ...filters, page: 0 };

  const hasFilters =
    JSON.stringify(current) !==
    JSON.stringify({ ...defaults, page: 0 });

  return { filters, current, hasFilters, update, setPage, reset, apply };
}
