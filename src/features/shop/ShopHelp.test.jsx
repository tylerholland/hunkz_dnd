import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InfoTip, ShopTour, TourBanner } from "./ShopHelp";
import { HELP, TOUR, tourSeen } from "./shopHelpText";

afterEach(() => { localStorage.clear(); });

describe("InfoTip", () => {
  it("opens a note on tap, one at a time, and closes with ✕ or Esc", () => {
    render(<div className="sd-page"><InfoTip id="temper" /><InfoTip id="prices" /></div>);
    fireEvent.click(screen.getByRole("button", { name: "About temper" }));
    expect(screen.getByRole("dialog", { name: "Temper" })).toHaveTextContent("2d6 + the shopper's CHA");
    expect(screen.getByText(/hidden WIS roll/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "About price level" }));
    expect(screen.queryByRole("dialog", { name: "Temper" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Price level" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has a note for every help id the page uses", () => {
    for (const help of Object.values(HELP)) {
      expect(help.title).toBeTruthy();
      expect(help.paras.length).toBeGreaterThan(0);
    }
  });
});

describe("ShopTour", () => {
  function page() {
    // Every step's target except the main action (one that isn't on the page).
    return TOUR.filter((s) => s.el !== "main").map((s) => <div key={s.el} data-tour={s.el} />);
  }

  it("walks the steps, skips one whose target is missing, and switches tab for the catalog", () => {
    const onTab = vi.fn();
    const onClose = vi.fn();
    render(<div className="sd-page">{page()}<ShopTour onTab={onTab} onClose={onClose} /></div>);
    expect(screen.getByText(`Step 1 of ${TOUR.length}`)).toBeInTheDocument();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Walk it first" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // "Open it" has no target here, so the tour goes on to the catalog.
    expect(screen.getByRole("heading", { name: "The item catalog" })).toBeInTheDocument();
    expect(onTab).toHaveBeenLastCalledWith("catalog");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
    expect(tourSeen()).toBe(true);
  });

  it("can be skipped, and then isn't offered again", () => {
    const onClose = vi.fn();
    render(<div className="sd-page">{page()}<ShopTour onTab={vi.fn()} onClose={onClose} /></div>);
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(onClose).toHaveBeenCalled();
    expect(tourSeen()).toBe(true);
  });
});

describe("TourBanner", () => {
  it("dismissing it remembers, on this device", () => {
    const onDismiss = vi.fn();
    expect(tourSeen()).toBe(false);
    render(<TourBanner onStart={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss the tour" }));
    expect(onDismiss).toHaveBeenCalled();
    expect(tourSeen()).toBe(true);
  });
});
