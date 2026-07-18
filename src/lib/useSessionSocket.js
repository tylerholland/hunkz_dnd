import { useCallback, useEffect, useRef, useState } from "react";
import { handleReloadBroadcast } from "./staleClient";

// Story 36 — WebSocket nudge channel.
//
// Connects to VITE_WS_URL (an API Gateway WebSocket stage). Two message
// shapes travel over the socket: { type: "changed" } — "some session write
// landed somewhere, go refetch" (callers pass their existing queued-refresh
// callback as `onChanged`) — and, since Story 36b, { type: "reload" } — an
// immediate stale-client reload push, handled entirely here via
// staleClient.js's handleReloadBroadcast() so the safe-moment/loop-guard
// logic isn't duplicated per caller.
//
// If VITE_WS_URL isn't set, this hook is a complete no-op and always returns
// { connected: false } — callers fall back to today's ADR-011 polling cadence
// unchanged.

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export function useSessionSocket(onChanged) {
  const wsUrl = import.meta.env.VITE_WS_URL;
  const [connected, setConnected] = useState(false);

  const wsRef = useRef(null);
  const backoffRef = useRef(MIN_BACKOFF_MS);
  const reconnectTimerRef = useRef(null);
  const closedByUsRef = useRef(false);
  const onChangedRef = useRef(onChanged);
  const connectRef = useRef(() => {});

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  const connect = useCallback(() => {
    if (!wsUrl) return;
    if (wsRef.current) return; // already connecting/connected

    closedByUsRef.current = false;

    let socket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      return;
    }
    wsRef.current = socket;

    const scheduleReconnect = () => {
      if (closedByUsRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      clearTimeout(reconnectTimerRef.current);
      const delay = backoffRef.current;
      reconnectTimerRef.current = setTimeout(() => {
        wsRef.current = null;
        connectRef.current();
      }, delay);
      backoffRef.current = Math.min(MAX_BACKOFF_MS, backoffRef.current * 2);
    };

    socket.onopen = () => {
      backoffRef.current = MIN_BACKOFF_MS;
      setConnected(true);
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data?.type === "changed") {
        onChangedRef.current?.();
      } else if (data?.type === "reload") {
        handleReloadBroadcast();
      }
    };

    socket.onclose = () => {
      wsRef.current = null;
      setConnected(false);
      scheduleReconnect();
    };

    // onerror is always followed by onclose for browser WebSockets — no
    // separate handling needed here.
    socket.onerror = () => {};
  }, [wsUrl]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    closedByUsRef.current = true;
    clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!wsUrl) return undefined;

    if (document.visibilityState === "visible") connect();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        backoffRef.current = MIN_BACKOFF_MS;
        connect();
      } else {
        disconnect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      disconnect();
    };
  }, [wsUrl, connect, disconnect]);

  return { connected: !!wsUrl && connected };
}
