"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface SavedFilter<T> {
  id: string;
  name: string;
  value: T;
}

const MAX_SAVED = 12;

const EMPTY: SavedFilter<never>[] = [];

const listeners = new Set<() => void>();

/** Used when the browser refuses localStorage (private windows). */
const memory = new Map<string, string>();

const cache = new Map<
  string,
  { raw: string | null; parsed: SavedFilter<unknown>[] }
>();

function readRaw(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key);

    if (stored !== null) {
      return stored;
    }
  } catch {
    // Fall through to the in-memory copy.
  }

  return memory.get(key) ?? null;
}

function parse(raw: string | null): SavedFilter<unknown>[] {
  if (raw === null) {
    return EMPTY;
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (!Array.isArray(value)) {
      return EMPTY;
    }

    return value
      .filter(
        (entry): entry is SavedFilter<unknown> =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as SavedFilter<unknown>).id ===
            "string" &&
          typeof (entry as SavedFilter<unknown>).name ===
            "string" &&
          "value" in entry
      )
      .slice(0, MAX_SAVED);
  } catch {
    return EMPTY;
  }
}

function snapshot(key: string): SavedFilter<unknown>[] {
  const raw = readRaw(key);
  const cached = cache.get(key);

  if (cached && cached.raw === raw) {
    return cached.parsed;
  }

  const parsed = parse(raw);

  cache.set(key, { raw, parsed });

  return parsed;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(key: string, next: SavedFilter<unknown>[]) {
  const raw = JSON.stringify(next);

  memory.set(key, raw);

  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // The in-memory copy still serves this tab.
  }

  listeners.forEach((listener) => listener());
}

/**
 * Named filter presets kept in this browser (localStorage), shared
 * between tabs. `storageKey` separates one screen's presets from the
 * next, e.g. "fcg.views.alerts".
 */
export function useSavedFilters<T>(storageKey: string) {
  const saved = useSyncExternalStore(
    subscribe,
    () => snapshot(storageKey) as SavedFilter<T>[],
    () => EMPTY as SavedFilter<T>[]
  );

  const save = useCallback(
    (name: string, value: T) => {
      const trimmed = name.trim().slice(0, 40);

      if (trimmed === "") {
        return;
      }

      const current = snapshot(storageKey);

      const entry: SavedFilter<unknown> = {
        id: `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        name: trimmed,
        value,
      };

      // Saving under an existing name replaces that preset.
      const others = current.filter(
        (item) =>
          item.name.toLowerCase() !== trimmed.toLowerCase()
      );

      write(
        storageKey,
        [entry, ...others].slice(0, MAX_SAVED)
      );
    },
    [storageKey]
  );

  const remove = useCallback(
    (id: string) => {
      write(
        storageKey,
        snapshot(storageKey).filter((item) => item.id !== id)
      );
    },
    [storageKey]
  );

  return { saved, save, remove };
}
