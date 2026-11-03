"use client";

import { useEffect, useState } from "react";

/**
 * Follows `value` once it has stopped changing for `delay` ms, so a
 * text box can drive a request without firing one per keystroke.
 * The setter applies a value at once (Reset, applying a saved view).
 */
export function useSettled(value: string, delay = 250) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSettled(value);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [value, settled, delay]);

  return [settled, setSettled] as const;
}
