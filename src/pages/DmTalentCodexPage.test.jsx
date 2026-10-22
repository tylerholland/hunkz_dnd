import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getTalentCodex: vi.fn(), putTalentCodex: vi.fn() }));
vi.mock("../api", () => api);

import DmTalentCodexPage from "./DmTalentCodexPage";

describe("DmTalentCodexPage (Story 39)", () => {
  beforeEach(() => {
    sessionStorage.setItem("dnd_dm_password", "swordfish");
    api.getTalentCodex.mockResolvedValue({ entries: { lore: { description: "Old tales, our way." } }, version: 2 });
    api.putTalentCodex.mockImplementation(async (_pw, entries) => ({ entries, version: 3 }));
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  const renderPage = () => render(<MemoryRouter><DmTalentCodexPage /></MemoryRouter>);
  const description = () => screen.getByRole("textbox", { name: /^Description/ });

  it("starts from the built-in text and saves only the DM's change", async () => {
    renderPage();
    await waitFor(() => expect(description().value).toMatch(/strength, climbing/)); // Athletics, built in
    fireEvent.change(screen.getByRole("textbox", { name: /At the table/ }), { target: { value: "Advantage on rope climbs" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.putTalentCodex).toHaveBeenCalledWith("swordfish", {
      lore: { description: "Old tales, our way." },
      athletics: { atTable: "Advantage on rope climbs" },
    }));
  });

  it("guards unsaved changes when switching, and resets an edited entry to the built-in text", async () => {
    renderPage();
    await waitFor(() => expect(description().value).not.toBe(""));
    fireEvent.change(description(), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: /^Lore/ }));
    const guard = screen.getByRole("alertdialog", { name: "Unsaved changes" });
    fireEvent.click(within(guard).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(description().value).toBe("Old tales, our way."));
    fireEvent.click(screen.getByRole("button", { name: "Reset to built-in" }));
    await waitFor(() => expect(api.putTalentCodex).toHaveBeenCalledWith("swordfish", {}));
  });
});
