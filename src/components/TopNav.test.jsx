import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import TopNav from "./TopNav";

afterEach(() => sessionStorage.clear());

describe("TopNav DM Session shortcut", () => {
  it("links a signed-in DM back to the dashboard from any other page", () => {
    sessionStorage.setItem("dnd_dm_password", "pw");
    render(<MemoryRouter initialEntries={["/chronicle"]}><TopNav title="Chronicle" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "DM Session" }).getAttribute("href")).toBe("/dm");
  });

  it("is hidden on the dashboard itself and for players", () => {
    sessionStorage.setItem("dnd_dm_password", "pw");
    const { unmount } = render(<MemoryRouter initialEntries={["/dm"]}><TopNav title="Campaign" /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "DM Session" })).toBe(null);
    unmount();
    sessionStorage.clear();
    render(<MemoryRouter initialEntries={["/characters/aesop/session"]}><TopNav title="Aesop" /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "DM Session" })).toBe(null);
  });
});
