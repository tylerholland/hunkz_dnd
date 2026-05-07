import { useCallback, useEffect, useRef } from "react";

export const ACTIVE_POLL_MS = 1000;
export const BACKGROUND_POLL_MS = 5000;

export function debounce(fn, ms) {
  let timer;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function cloneLiveValue(value) {
  return value && typeof value === "object"
    ? JSON.parse(JSON.stringify(value))
    : value;
}

export function liveValuesEqual(a, b) {
  if (a === undefined && b === undefined) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeOptimisticLiveFields(prev, incoming, liveFields, expectedValuesRef) {
  const next = { ...prev, ...incoming };
  for (const field of liveFields) {
    const expected = expectedValuesRef.current.get(field);
    const incomingValue = incoming[field];
    if (expected !== undefined) {
      if (liveValuesEqual(incomingValue, expected)) {
        expectedValuesRef.current.delete(field);
        next[field] = incomingValue;
      } else {
        next[field] = prev[field];
      }
    } else {
      next[field] = incomingValue;
    }
  }
  return next;
}

export function useQueuedRefresh(refreshFn) {
  const timerRef = useRef(null);

  const queueRefresh = useCallback((delay = 75) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      refreshFn({ background: true, force: true });
    }, delay);
  }, [refreshFn]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return queueRefresh;
}

export function useAdaptivePolling({
  enabled = true,
  poll,
  activeMs = ACTIVE_POLL_MS,
  backgroundMs = BACKGROUND_POLL_MS,
}) {
  useEffect(() => {
    if (!enabled) return;

    let timeoutId = null;
    let stopped = false;

    const getDelay = () =>
      document.visibilityState === "visible" && document.hasFocus()
        ? activeMs
        : backgroundMs;

    const scheduleNext = () => {
      if (stopped) return;
      timeoutId = setTimeout(async () => {
        await poll({ background: true });
        scheduleNext();
      }, getDelay());
    };

    const reschedule = () => {
      clearTimeout(timeoutId);
      scheduleNext();
    };

    scheduleNext();
    document.addEventListener("visibilitychange", reschedule);
    window.addEventListener("focus", reschedule);
    window.addEventListener("blur", reschedule);

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", reschedule);
      window.removeEventListener("focus", reschedule);
      window.removeEventListener("blur", reschedule);
    };
  }, [activeMs, backgroundMs, enabled, poll]);
}

export function useDebouncedOptimisticNumberFlush({
  enabled = true,
  delay = 300,
  fieldName,
  getTargetValue,
  serverValueRef,
  inFlightRef,
  pendingDeltaRef = null,
  markExpected,
  clearExpected,
  commitValue,
  setLocalValue,
  requestSync,
}) {
  const flushRef = useRef(null);

  useEffect(() => {
    flushRef.current?.cancel?.();
    if (!enabled) return () => {};

    flushRef.current = debounce(async () => {
      if (inFlightRef.current) return;

      const targetValue = getTargetValue();
      const previousServerValue = serverValueRef.current;

      if (targetValue === previousServerValue) {
        if (pendingDeltaRef) pendingDeltaRef.current = 0;
        return;
      }

      if (pendingDeltaRef) pendingDeltaRef.current = 0;
      inFlightRef.current = true;
      markExpected?.({ [fieldName]: targetValue });

      try {
        await commitValue(targetValue);
        serverValueRef.current = targetValue;
        requestSync?.();
      } catch (err) {
        clearExpected?.([fieldName]);
        serverValueRef.current = previousServerValue;
        setLocalValue?.(previousServerValue);
      } finally {
        inFlightRef.current = false;
        const currentValue = getTargetValue();
        const hasPending = pendingDeltaRef ? pendingDeltaRef.current !== 0 : false;
        if (hasPending || currentValue !== serverValueRef.current) {
          flushRef.current?.();
        }
      }
    }, delay);

    return () => flushRef.current?.cancel?.();
  }, [
    clearExpected,
    commitValue,
    delay,
    enabled,
    fieldName,
    getTargetValue,
    inFlightRef,
    markExpected,
    pendingDeltaRef,
    requestSync,
    serverValueRef,
    setLocalValue,
  ]);

  return flushRef;
}
