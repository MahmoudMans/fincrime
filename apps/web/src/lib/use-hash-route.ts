"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  DEFAULT_VIEW,
  resolveViewId,
  type ViewId,
} from "./navigation";

export interface Route {
  view: ViewId;
  /** Optional second segment, e.g. a case id in #/cases/<id>. */
  param: string | null;
}

function readRoute(): Route {
  if (typeof window === "undefined") {
    return { view: DEFAULT_VIEW, param: null };
  }

  const raw = window.location.hash.replace(/^#\/?/, "");
  const [first, second] = raw.split("/");

  return {
    view: resolveViewId(first) ?? DEFAULT_VIEW,
    param: second ? decodeURIComponent(second) : null,
  };
}

function toHash(view: ViewId, param?: string | null) {
  return param
    ? `#/${view}/${encodeURIComponent(param)}`
    : `#/${view}`;
}

/**
 * Keeps the active view in the URL hash so that refresh, back/forward
 * and shared links all land on the same screen.
 */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    function sync() {
      setRoute(readRoute());
    }

    window.addEventListener("hashchange", sync);

    return () =>
      window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback(
    (view: ViewId, param?: string | null) => {
      const next = toHash(view, param);

      if (window.location.hash === next) {
        // Same hash: no hashchange event fires, but the user still
        // expects the page to return to the top.
        setRoute({ view, param: param ?? null });
      } else {
        window.location.hash = next;
      }

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    []
  );

  return { route, navigate };
}
