import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  listCharacters: vi.fn(),
  getPartyRoster: vi.fn(),
  verifyPassword: vi.fn(),
  getChronicle: vi.fn(),
  getSessionState: vi.fn(),
  putChronicleNextSession: vi.fn(),
}));

vi.mock("../api", () => apiMocks);

vi.mock("../components/CharacterSheet", async () => ({
  PALETTES: (await import("../features/characterSheet/theme")).PALETTES,
}));

import CharactersListPage from "./CharactersListPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <CharactersListPage />
    </MemoryRouter>
  );
}

const ARAGORN = { slug: "aragorn", name: "Aragorn", palette: "ember", race: "Human", charClass: "Ranger", level: 4 };
const LIU = { slug: "liu-sha", name: "Liu Sha", nameAlt: "Louie", palette: "ocean", race: "Goliath", charClass: "Monk", level: 1 };

const inDays = (n, hour = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const CHRONICLE = {
  chapters: [{ id: "ch1", name: "We Must All Hang Together" }],
  sessions: [
    { id: "s2", chapterId: "ch1", title: "Through the Lair · Tue, Sep 29", startAt: inDays(-24), summaryExcerpt: "Deep beneath the city…", foes: [{ name: "Carrion Crawler", portraitUrl: null }] },
    { id: "s1", chapterId: "ch1", title: "Up From The Gutter", startAt: inDays(-90), summaryExcerpt: "", foes: [] },
  ],
  nextSession: { at: inDays(7) },
};

describe("CharactersListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMocks.getPartyRoster.mockResolvedValue({ exists: false, members: [] });
    apiMocks.getChronicle.mockResolvedValue({ chapters: [], sessions: [], nextSession: null });
    apiMocks.getSessionState.mockResolvedValue({ partyStatus: { visible: false, members: [] } });
  });

  it("renders only valid public character cards when the API response includes internal or malformed rows", async () => {
    apiMocks.listCharacters.mockResolvedValueOnce([
      ARAGORN,
      { slug: "initiative" },
      { slug: "npc-combat", name: "NPC Combat" },
      { slug: "broken-empty-name", name: "   ", palette: "ocean" },
      { slug: "", name: "Missing Slug" },
      LIU,
    ]);

    renderPage();

    expect(await screen.findByText("Aragorn")).toBeInTheDocument();
    expect(screen.getByText("Liu Sha")).toBeInTheDocument();
    expect(screen.queryByText("NPC Combat")).not.toBeInTheDocument();
    expect(screen.queryByText("Missing Slug")).not.toBeInTheDocument();
    expect(screen.getByText("+ New character")).toBeInTheDocument();
  });

  it("splits the party from other characters and shows party HP when it's public", async () => {
    apiMocks.listCharacters.mockResolvedValueOnce([ARAGORN, LIU]);
    apiMocks.getPartyRoster.mockResolvedValueOnce({ exists: true, members: ["liu-sha"] });
    apiMocks.getSessionState.mockResolvedValueOnce({ partyStatus: { visible: true, members: [{ slug: "liu-sha", hpCurrent: 7, hpMax: 12, conditions: ["Poisoned"] }] } });

    renderPage();

    const party = await screen.findByRole("region", { name: "The Party" });
    expect(within(party).getByText("Liu Sha")).toBeInTheDocument();
    expect(await within(party).findByText("7/12")).toBeInTheDocument();
    expect(within(party).getByText("Poisoned")).toBeInTheDocument();
    expect(within(party).queryByText("Aragorn")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Other characters" })).getByText("Aragorn")).toBeInTheDocument();
  });

  it("leads with the Chronicle's latest session and the next session; only signed-in people can schedule", async () => {
    apiMocks.listCharacters.mockResolvedValueOnce([LIU]);
    apiMocks.getChronicle.mockResolvedValueOnce(CHRONICLE);

    renderPage();

    expect(await screen.findByText("Through the Lair")).toBeInTheDocument();
    expect(screen.getByText("The Chronicle · Chapter I")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "We Must All Hang Together" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Hunkz Adventures" })).not.toBeInTheDocument();
    expect(screen.getByText(/days since the party last gathered/)).toBeInTheDocument();
    expect(screen.getByText(/in 7 days/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read the Chronicle/ })).toHaveAttribute("href", "/chronicle/s2");
    expect(screen.getByRole("link", { name: /Through the Lair/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
  });

  it("greets a signed-in player and lets them schedule the next session", async () => {
    sessionStorage.setItem("dnd_char_liu-sha", "pw");
    apiMocks.listCharacters.mockResolvedValueOnce([ARAGORN, LIU]);
    apiMocks.getPartyRoster.mockResolvedValueOnce({ exists: true, members: ["aragorn", "liu-sha"] });
    apiMocks.getChronicle.mockResolvedValueOnce({ ...CHRONICLE, nextSession: null });
    apiMocks.putChronicleNextSession.mockImplementation(async (_viewer, at) => ({ nextSession: { at } }));

    renderPage();

    expect(await screen.findByText("Continue as Liu")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Schedule the next session" }));
    const dialog = screen.getByRole("dialog", { name: "Schedule the next session" });
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: "2099-01-02" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.putChronicleNextSession).toHaveBeenCalled());
    const [credentials, at] = apiMocks.putChronicleNextSession.mock.calls[0];
    expect(credentials).toEqual({ password: "pw", asSlug: "liu-sha" });
    expect(new Date(at).getFullYear()).toBe(2099);
    expect(await screen.findByText(/Next session:/)).toBeInTheDocument();
  });
});
