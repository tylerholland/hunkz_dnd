import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches, kept live as the window changes. */
export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    const list = window.matchMedia?.(query);
    if (!list) return () => {};
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
