import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKGROUND_POLL_MS } from "../lib/liveSync";

const apiMocks = vi.hoisted(() => ({
  updateCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  getSessionState: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../api", () => ({
  updateCharacter: apiMocks.updateCharacter,
  deleteCharacter: apiMocks.deleteCharacter,
  getSessionState: apiMocks.getSessionState,
  verifyPassword: apiMocks.verifyPassword,
}));

vi.mock("../components/CharacterSheet", () => ({
  PALETTES: {
    ember: { accent: "#d07a3a", bg: "#161311" },
  },
}));

vi.mock("../features/characterSheet/CharacterSheetSessionMode", () => ({
  default: ({ initialData, slug, partyStatus, initiativeData }) => (
    <div data-testid="session-mode">
      {`sheet:${initialData?.name}:${slug}:members=${partyStatus?.members?.length ?? 0}:round=${initiativeData?.round ?? 0}`}
    </div>
  ),
}));

import CharacterModePage from "./CharacterModePage";

function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/characters/:slug/session" element={<CharacterModePage />} />
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
    partyStatus: { visible: true, members: [{ slug: "aragorn" }] },
    initiativePublic: { round: 1, activeTurnIndex: 0, entries: [] },
    mapLibrary: { activeMapId: null, activeMapView: null, maps: [] },
    serverTime: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("CharacterModePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMocks.verifyPassword.mockResolvedValue({ valid: true, role: "owner" });
  });

  it("renders a 404 state when session-state has no character for the slug", async () => {
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse({ character: undefined }));

    renderRoute("/characters/aragorn/session");

    expect(await screen.findByText(/No character found for/i)).toBeInTheDocument();
  });

  it("fans the consolidated session-state response out to the session mode component", async () => {
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse());

    renderRoute("/characters/aragorn/session");

    expect(await screen.findByTestId("session-mode")).toHaveTextContent(
      "sheet:Aragorn:aragorn:members=1:round=1"
    );
    expect(apiMocks.verifyPassword).toHaveBeenCalledWith("aragorn", "");
    expect(apiMocks.getSessionState).toHaveBeenCalledWith({ slug: "aragorn", dmPassword: "" });
  });

  it("shows the unlock prompt and skips session-state fetch when auth fails", async () => {
    apiMocks.verifyPassword.mockResolvedValueOnce({ valid: false });

    renderRoute("/characters/aragorn/session");

    expect(await screen.findByText(/Password Required/i)).toBeInTheDocument();
    expect(apiMocks.getSessionState).not.toHaveBeenCalled();
  });

  it("prefers the cached owner password before loading session mode", async () => {
    sessionStorage.setItem("dnd_char_aragorn", "owner-secret");
    apiMocks.getSessionState.mockResolvedValueOnce(baseSessionStateResponse());

    renderRoute("/characters/aragorn/session");

    expect(await screen.findByTestId("session-mode")).toBeInTheDocument();
    expect(apiMocks.verifyPassword).toHaveBeenCalledWith("aragorn", "owner-secret");
    expect(apiMocks.getSessionState).toHaveBeenCalledWith({ slug: "aragorn", dmPassword: "owner-secret" });
  });
});

describe("CharacterModePage polling (Story 35 consolidation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
    apiMocks.verifyPassword.mockResolvedValue({ valid: true, role: "owner" });
    apiMocks.getSessionState.mockResolvedValue(baseSessionStateResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues exactly one getSessionState request per poll tick", async () => {
    renderRoute("/characters/aragorn/session");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterMount = apiMocks.getSessionState.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);
    expect(apiMocks.getSessionState).toHaveBeenLastCalledWith({ slug: "aragorn", dmPassword: "" });

    // jsdom reports document.hasFocus() === false, so polling runs at the
    // backgrounded cadence — advance by exactly one tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKGROUND_POLL_MS);
    });

    expect(apiMocks.getSessionState.mock.calls.length).toBe(callsAfterMount + 1);
  });
});
