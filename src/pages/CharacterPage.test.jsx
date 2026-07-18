import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKGROUND_POLL_MS } from "../lib/liveSync";

const apiMocks = vi.hoisted(() => ({
  updateCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  getSessionState: vi.fn(),
}));

vi.mock("../api", () => ({
  updateCharacter: apiMocks.updateCharacter,
  deleteCharacter: apiMocks.deleteCharacter,
  getSessionState: apiMocks.getSessionState,
}));

vi.mock("../components/CharacterSheet", () => ({
  default: ({ initialData, slug }) => (
    <div data-testid="character-sheet">{`sheet:${initialData.name}:${slug}`}</div>
  ),
  PALETTES: {
    ember: { accent: "#d07a3a", bg: "#161311" },
  },
}));

import CharacterPage from "./CharacterPage";

function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/character/:slug" element={<CharacterPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function baseSessionStateResponse(overrides = {}) {
  return {
    character: {
      slug: "aragorn",
      name: "Aragorn",
      palette: "ember",
      collections: [{ id: "c1", sections: [{ id: "s1" }] }],
    },
    mapLibrary: { activeMapId: null, activeMapView: null, maps: [] },
    serverTime: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("CharacterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders a 404 state when session-state has no character for the slug", async () => {
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse({ character: undefined }));

    renderRoute("/character/initiative");

    expect(await screen.findByText(/No character found for/i)).toBeInTheDocument();
    expect(screen.getByText(/initiative/i)).toBeInTheDocument();
  });

  it("renders the character sheet for a valid character payload", async () => {
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse());

    renderRoute("/character/aragorn");

    expect(await screen.findByTestId("character-sheet")).toHaveTextContent("sheet:Aragorn:aragorn");
  });

  it("fetches with no cached credential when neither DM nor owner password is cached", async () => {
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse());

    renderRoute("/character/aragorn");

    await screen.findByTestId("character-sheet");
    expect(apiMocks.getSessionState).toHaveBeenCalledWith({ slug: "aragorn", dmPassword: undefined });
  });

  it("passes the cached owner password for this slug when present", async () => {
    sessionStorage.setItem("dnd_char_aragorn", "owner-secret");
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse());

    renderRoute("/character/aragorn");

    await screen.findByTestId("character-sheet");
    expect(apiMocks.getSessionState).toHaveBeenCalledWith({ slug: "aragorn", dmPassword: "owner-secret" });
  });

  it("prefers the cached DM password over the owner password", async () => {
    sessionStorage.setItem("dnd_char_aragorn", "owner-secret");
    sessionStorage.setItem("dnd_dm_password", "dm-secret");
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse());

    renderRoute("/character/aragorn");

    await screen.findByTestId("character-sheet");
    expect(apiMocks.getSessionState).toHaveBeenCalledWith({ slug: "aragorn", dmPassword: "dm-secret" });
  });
});

describe("CharacterPage polling (Story 35b consolidation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
    apiMocks.getSessionState.mockResolvedValue(baseSessionStateResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues exactly one getSessionState request per poll tick", async () => {
    renderRoute("/character/aragorn");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterMount = apiMocks.getSessionState.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);
    expect(apiMocks.getSessionState).toHaveBeenLastCalledWith({ slug: "aragorn", dmPassword: undefined });

    // jsdom reports document.hasFocus() === false, so polling runs at the
    // backgrounded cadence — advance by exactly one tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKGROUND_POLL_MS);
    });

    expect(apiMocks.getSessionState.mock.calls.length).toBe(callsAfterMount + 1);
  });
});
