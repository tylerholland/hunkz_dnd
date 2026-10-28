import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import TopNav from "./TopNav";
import { setCombatActive } from "../lib/dmSession";

afterEach(() => { sessionStorage.clear(); act(() => setCombatActive(false)); });

const at = (path, ui) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
const dmLinks = () => within(screen.getByRole("navigation", { name: "DM pages" }));

describe("TopNav — the DM's places", () => {
  it("shows Campaign · Shop · Maps · Chronicle on DM pages, the current one marked", () => {
    sessionStorage.setItem("dnd_dm_password", "pw");
    at("/dm/shop", <TopNav title="Shop · Ironwhistle's Emporium" />);
    expect(dmLinks().getAllByRole("link").map((a) => a.textContent)).toEqual(["Campaign", "Shop", "Maps", "Chronicle"]);
    expect(dmLinks().getByRole("link", { name: "Shop" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home — the party" })).toHaveAttribute("href", "/");
  });

  it("marks Campaign while combat is on, from any page", () => {
    sessionStorage.setItem("dnd_dm_password", "pw");
    at("/dm/settings", <TopNav title="DM Settings" />);
    expect(screen.queryAllByLabelText("in combat")).toHaveLength(0);
    act(() => setCombatActive(true));
    expect(dmLinks().getByLabelText("in combat")).toBeInTheDocument();
  });

  it("keeps a character page's title and folds the places into “DM ▾”", () => {
    sessionStorage.setItem("dnd_dm_password", "pw");
    at("/characters/aesop/session", <TopNav backTo="/" title="Aesop" />);
    expect(screen.getByText("Aesop")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "DM pages" })).toBe(null);
    expect(screen.getByRole("button", { name: /DM/ })).toBeInTheDocument();
  });

  it("shows players no DM links, and a DM button on the homepage when nobody is signed in", () => {
    at("/", <TopNav title="Hunkz Adventures" />);
    expect(screen.queryByRole("navigation", { name: "DM pages" })).toBe(null);
    expect(screen.getByRole("link", { name: "DM" })).toHaveAttribute("href", "/dm");
  });
});

describe("TopNav — the ⋯ menu", () => {
  it("adds Settings, Theme and Sign out for the DM after the page's own items", () => {
    sessionStorage.setItem("dnd_dm_password", "pw");
    at("/dm", <TopNav title="Campaign" menuItems={[{ label: "Manage Party", onClick: () => {} }]} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "Manage Party" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/dm/settings");
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("gives a signed-in player Sign out but not Theme or Settings; nobody signed in gets neither", () => {
    sessionStorage.setItem("dnd_char_aesop", "pw");
    const { unmount } = at("/characters/aesop/session", <TopNav backTo="/" title="Aesop" menuItems={[{ label: "Chronicle", href: "/chronicle" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByText("Theme")).toBe(null);
    expect(screen.queryByRole("link", { name: "Settings" })).toBe(null);
    unmount();
    sessionStorage.clear();
    at("/", <TopNav title="Hunkz Adventures" menuItems={[{ label: "Chronicle", href: "/chronicle" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("button", { name: "Sign out" })).toBe(null);
  });

  it("renders an on/off item as a switch that flips without closing the menu", () => {
    const onChange = vi.fn();
    at("/characters/aesop/session", <TopNav title="Aesop" menuItems={[{ toggle: true, label: "Turn alerts", checked: true, onChange }]} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const item = screen.getByRole("menuitemcheckbox", { name: "Turn alerts" });
    expect(item).toHaveAttribute("aria-checked", "true");
    fireEvent.click(item);
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "true");
  });

  it("hangs a mode toggle off the bar as a notch", () => {
    sessionStorage.setItem("dnd_dm_password", "pw");
    at("/dm", <TopNav title="Campaign" notch={<button type="button">Combat</button>} />);
    expect(screen.getByRole("button", { name: "Combat" }).closest(".topnav-notch")).not.toBe(null);
  });
});
