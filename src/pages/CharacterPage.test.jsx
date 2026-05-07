import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getCharacter: vi.fn(),
  updateCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
}));

vi.mock("../api", () => ({
  getCharacter: apiMocks.getCharacter,
  updateCharacter: apiMocks.updateCharacter,
  deleteCharacter: apiMocks.deleteCharacter,
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

describe("CharacterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a 404 state when the API payload is not a valid character", async () => {
    apiMocks.getCharacter.mockResolvedValueOnce({ slug: "initiative" });

    renderRoute("/character/initiative");

    expect(await screen.findByText(/No character found for/i)).toBeInTheDocument();
    expect(screen.getByText(/initiative/i)).toBeInTheDocument();
  });

  it("renders the character sheet for a valid character payload", async () => {
    apiMocks.getCharacter.mockResolvedValueOnce({
      slug: "aragorn",
      name: "Aragorn",
      palette: "ember",
      collections: [{ id: "c1", sections: [{ id: "s1" }] }],
    });

    renderRoute("/character/aragorn");

    expect(await screen.findByTestId("character-sheet")).toHaveTextContent("sheet:Aragorn:aragorn");
  });
});
