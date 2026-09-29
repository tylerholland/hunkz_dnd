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
// API Gateway closes a WebSocket after 10 minutes without traffic. A small
// message every few minutes keeps a quiet session's socket open (the API has
// no route for it and just answers with an error frame, which is ignored).
const KEEPALIVE_MS = 4 * 60 * 1000;

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

  // Stay connected while the tab is hidden: a hidden or covered window (on a
  // Mac, one behind Zoom or another window counts) would otherwise fall back
  // to a 30s poll, and the DM or a player would see a hit half a minute late —
  // too late for its animation. A nudge is tiny; polling is what costs.
  useEffect(() => {
    if (!wsUrl) return undefined;

    connect();

    const keepAlive = setInterval(() => {
      const socket = wsRef.current;
      if (socket && socket.readyState === 1) {
        try { socket.send(JSON.stringify({ action: "ping" })); } catch { /* onclose will reconnect */ }
      }
    }, KEEPALIVE_MS);

    // After a network drop the old socket can look open but be dead: rebuild it.
    const handleOnline = () => {
      const socket = wsRef.current;
      if (socket) {
        socket.onclose = null;
        try { socket.close(); } catch { /* already closed */ }
        wsRef.current = null;
        setConnected(false);
      }
      backoffRef.current = MIN_BACKOFF_MS;
      connect();
    };
    window.addEventListener("online", handleOnline);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Coming back: reconnect straight away if the socket dropped.
        backoffRef.current = MIN_BACKOFF_MS;
        clearTimeout(reconnectTimerRef.current);
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(keepAlive);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      disconnect();
    };
  }, [wsUrl, connect, disconnect]);

  return { connected: !!wsUrl && connected };
}
