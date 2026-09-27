import { useCallback, useEffect, useRef, useState } from "react";

export const ACTIVE_POLL_MS = 1000;
// ADR-011 amendment (Story 35): raised from 5s to 30s for backgrounded/hidden
// tabs to cut idle Lambda + DynamoDB request volume once polling was
// consolidated to a single endpoint.
export const BACKGROUND_POLL_MS = 30000;

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

// Pending-write expectations. A screen records the value it just wrote; until
// the server echoes it back (or the expectation expires) incoming poll data
// for that field is ignored, so a poll that started before the write can't
// snap the UI back. The expiry matters: if someone else changes the same
// field right after, the server never "matches" and we must defer to it.
export const EXPECTED_TTL_MS = 8000;

export function markExpectedFields(expectedValuesRef, fields, ttlMs = EXPECTED_TTL_MS) {
  const expiresAt = Date.now() + ttlMs;
  Object.entries(fields).forEach(([field, value]) => {
    expectedValuesRef.current.set(field, { __expected: true, value: cloneLiveValue(value), expiresAt });
  });
}

export function clearExpectedFields(expectedValuesRef, fieldNames) {
  fieldNames.forEach((field) => expectedValuesRef.current.delete(field));
}

// True while a local write to `field` is still awaiting the server — i.e. the
// incoming value should be ignored. Clears the expectation once the server
// matches or it has expired.
export function isFieldPending(expectedValuesRef, field, incomingValue) {
  const entry = expectedValuesRef.current.get(field);
  if (entry === undefined) return false;
  const expected = entry?.__expected ? entry.value : entry;
  if (liveValuesEqual(incomingValue, expected) || (entry?.__expected && Date.now() > entry.expiresAt)) {
    expectedValuesRef.current.delete(field);
    return false;
  }
  return true;
}

export function mergeOptimisticLiveFields(prev, incoming, liveFields, expectedValuesRef) {
  const next = { ...prev, ...incoming };
  for (const field of liveFields) {
    next[field] = isFieldPending(expectedValuesRef, field, incoming?.[field]) ? prev?.[field] : incoming?.[field];
  }
  return next;
}

// Optimistic override for a single server-owned value (e.g. a map's token
// list). `begin(value)` shows `value` immediately; `settle(seq)` marks that
// write as landed. After settling, the server value wins as soon as it
// matches — and unconditionally after `releaseMs`, so a concurrent change
// from someone else (a player dragging their own token) always shows up.
// `reset()` drops the override (e.g. when the active map changes).
export function useSettlingOverride(serverValue, { equals = liveValuesEqual, releaseMs = 2000 } = {}) {
  const [local, setLocal] = useState(null); // { value, settled } | null
  const seqRef = useRef(0);
  const timerRef = useRef(null);

  const begin = useCallback((value) => {
    seqRef.current += 1;
    clearTimeout(timerRef.current);
    setLocal({ value, settled: false });
    return seqRef.current;
  }, []);

  const settle = useCallback((seq) => {
    if (seq !== seqRef.current) return;
    setLocal((current) => (current ? { ...current, settled: true } : current));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (seq === seqRef.current) setLocal(null);
    }, releaseMs);
  }, [releaseMs]);

  const reset = useCallback(() => {
    seqRef.current += 1;
    clearTimeout(timerRef.current);
    setLocal(null);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const showLocal = local !== null && !(local.settled && equals(local.value, serverValue));
  return { value: showLocal ? local.value : serverValue, pending: local !== null && !local.settled, begin, settle, reset };
}

export function useQueuedRefresh(refreshFn) {
  const timerRef = useRef(null);

  const queueRefresh = useCallback((delay = 75) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      refreshFn({ background: true });
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
