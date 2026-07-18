import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKGROUND_POLL_MS } from "../lib/liveSync";

const apiMocks = vi.hoisted(() => ({
  getSessionState: vi.fn(),
}));

vi.mock("../api", () => ({
  getSessionState: apiMocks.getSessionState,
}));

vi.mock("../features/maps/MapViewer", () => ({
  default: ({ name }) => <div data-testid="map-viewer">{name}</div>,
}));

import MapViewerPage from "./MapViewerPage";

function baseSessionStateResponse(overrides = {}) {
  return {
    partyStatus: { visible: true, members: [] },
    initiativePublic: { round: 1, activeTurnIndex: 0, entries: [] },
    mapLibrary: { activeMapId: null, activeMapView: null, maps: [] },
    rollHistory: { rolls: [] },
    serverTime: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("MapViewerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the empty state when no active map is set", async () => {
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse());

    render(
      <MemoryRouter>
        <MapViewerPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/hasn't loaded a map yet/i)).toBeInTheDocument();
    expect(apiMocks.getSessionState).toHaveBeenCalledWith();
  });

  it("renders the active map from the consolidated session-state response", async () => {
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse({
      mapLibrary: {
        activeMapId: "m1",
        activeMapView: null,
        maps: [{ id: "m1", name: "Dungeon", imageUrl: "https://example.com/dungeon.png" }],
      },
    }));

    render(
      <MemoryRouter>
        <MapViewerPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId("map-viewer")).toHaveTextContent("Dungeon");
  });
});

describe("MapViewerPage polling (Story 35b consolidation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    apiMocks.getSessionState.mockResolvedValue(baseSessionStateResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues exactly one getSessionState request per poll tick", async () => {
    render(
      <MemoryRouter>
        <MapViewerPage />
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterMount = apiMocks.getSessionState.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);
    expect(apiMocks.getSessionState).toHaveBeenLastCalledWith();

    // jsdom reports document.hasFocus() === false, so polling runs at the
    // backgrounded cadence — advance by exactly one tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKGROUND_POLL_MS);
    });

    expect(apiMocks.getSessionState.mock.calls.length).toBe(callsAfterMount + 1);
  });
});
