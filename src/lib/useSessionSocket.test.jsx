import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionSocket } from "./useSessionSocket";
import * as staleClient from "./staleClient";

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  send() {}

  // Test helpers — not part of the real WebSocket API.
  triggerOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  triggerMessage(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("useSessionSocket", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket;
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
    vi.unstubAllEnvs();
  });

  it("is a no-op when VITE_WS_URL is absent — no socket opens, connected stays false", () => {
    vi.stubEnv("VITE_WS_URL", "");
    const onChanged = vi.fn();

    const { result } = renderHook(() => useSessionSocket(onChanged));

    expect(result.current.connected).toBe(false);
    expect(MockWebSocket.instances.length).toBe(0);
    // With connected always false, callers' useAdaptivePolling keeps its
    // default ACTIVE_POLL_MS/BACKGROUND_POLL_MS cadence (ADR-011) — the hook
    // never gives them a reason to stretch the interval.
  });

  it("calls the refetch callback when a { type: 'changed' } message arrives", () => {
    vi.stubEnv("VITE_WS_URL", "wss://example.test/ws");
    const onChanged = vi.fn();

    const { result, unmount } = renderHook(() => useSessionSocket(onChanged));

    expect(MockWebSocket.instances.length).toBe(1);
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe("wss://example.test/ws");

    act(() => {
      socket.triggerOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      socket.triggerMessage({ type: "changed" });
    });
    expect(onChanged).toHaveBeenCalledTimes(1);

    // Messages of other shapes are ignored.
    act(() => {
      socket.triggerMessage({ type: "something-else" });
    });
    expect(onChanged).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("delegates a { type: 'reload' } message to staleClient's handleReloadBroadcast, not the onChanged callback", () => {
    vi.stubEnv("VITE_WS_URL", "wss://example.test/ws");
    const onChanged = vi.fn();
    const handleReloadBroadcastSpy = vi.spyOn(staleClient, "handleReloadBroadcast").mockImplementation(() => {});

    const { unmount } = renderHook(() => useSessionSocket(onChanged));

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.triggerOpen();
    });

    act(() => {
      socket.triggerMessage({ type: "reload" });
    });

    expect(handleReloadBroadcastSpy).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();

    handleReloadBroadcastSpy.mockRestore();
    unmount();
  });

  it("reports connected: false again after the socket closes, and reconnects with backoff", () => {
    vi.stubEnv("VITE_WS_URL", "wss://example.test/ws");
    const { result, unmount } = renderHook(() => useSessionSocket(() => {}));

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.triggerOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      socket.onclose?.();
    });
    expect(result.current.connected).toBe(false);

    // Reconnect attempt is scheduled with a 1s backoff, not immediate.
    expect(MockWebSocket.instances.length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances.length).toBe(2);

    unmount();
  });
});
