import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  listCharacters: vi.fn(),
  getPartyRoster: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../api", () => ({
  listCharacters: apiMocks.listCharacters,
  getPartyRoster: apiMocks.getPartyRoster,
  verifyPassword: apiMocks.verifyPassword,
}));

vi.mock("../components/CharacterSheet", () => ({
  PALETTES: {
    ember: {
      border: "rgba(100,130,160,0.2)",
      accent: "#d07a3a",
      accentDim: "#8f5c31",
      bg: "#161311",
      surface: "#1b1714",
      text: "#c8bfaf",
      textMuted: "#8f8272",
    },
    ocean: {
      border: "rgba(100,130,160,0.2)",
      accent: "#6a8fa8",
      accentDim: "#4b6474",
      bg: "#111e2c",
      surface: "#172230",
      text: "#d8e3ea",
      textMuted: "#8ba4b4",
    },
  },
}));

import CharactersListPage from "./CharactersListPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <CharactersListPage />
    </MemoryRouter>
  );
}

describe("CharactersListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMocks.getPartyRoster.mockResolvedValue({ exists: false, members: [] });
  });

  it("renders only valid public character cards when the API response includes internal or malformed rows", async () => {
    apiMocks.listCharacters.mockResolvedValueOnce([
      { slug: "aragorn", name: "Aragorn", palette: "ember", race: "Human", charClass: "Ranger", level: 4 },
      { slug: "initiative" },
      { slug: "npc-combat", name: "NPC Combat" },
      { slug: "broken-empty-name", name: "   ", palette: "ocean" },
      { slug: "", name: "Missing Slug" },
      { slug: "liu-sha", name: "Liu Sha", palette: "ocean", race: "Goliath", charClass: "Monk", level: 1 },
    ]);

    renderPage();

    expect(await screen.findByText("Aragorn")).toBeInTheDocument();
    expect(screen.getByText("Liu Sha")).toBeInTheDocument();

    expect(screen.queryByText("NPC Combat")).not.toBeInTheDocument();
    expect(screen.queryByText("Missing Slug")).not.toBeInTheDocument();
    expect(screen.queryByText("?")).not.toBeInTheDocument();

    expect(screen.getByText("New Character")).toBeInTheDocument();
  });

  it("shows an In Party badge for roster members", async () => {
    apiMocks.listCharacters.mockResolvedValueOnce([
      { slug: "aragorn", name: "Aragorn", palette: "ember", race: "Human", charClass: "Ranger", level: 4 },
      { slug: "liu-sha", name: "Liu Sha", palette: "ocean", race: "Goliath", charClass: "Monk", level: 1 },
    ]);
    apiMocks.getPartyRoster.mockResolvedValueOnce({ exists: true, members: ["liu-sha"] });

    renderPage();

    expect(await screen.findByText("Liu Sha")).toBeInTheDocument();
    expect(screen.getByText("In Party")).toBeInTheDocument();
  });
});
