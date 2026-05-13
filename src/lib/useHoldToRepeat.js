import { useEffect, useRef } from "react";

/**
 * Shared hold-to-repeat hook.
 * Call start() on pointerdown, stop() on pointerup/pointercancel.
 * onTick fires immediately on start, then repeatedly after `delay` ms at `interval` ms.
 */
export function useHoldToRepeat(onTick, delay = 500, interval = 80) {
  const holdTimerRef = useRef(null);
  const holdIntervalRef = useRef(null);

  function start() {
    onTick();
    holdTimerRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(onTick, interval);
    }, delay);
  }

  function stop() {
    clearTimeout(holdTimerRef.current);
    clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
  }

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { start, stop };
}
