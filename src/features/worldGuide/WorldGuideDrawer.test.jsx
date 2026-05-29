import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import WorldGuideDrawer from "./WorldGuideDrawer";
import WorldGuideTrigger from "./WorldGuideTrigger";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_TOC = {
  sections: [
    { title: "Greyhawk's World", file: "01-greyhawks-world.md", level: 1 },
    {
      title: "Gazetteer of the Flanaess",
      file: null,
      level: 1,
      children: [
        { title: "Furyondy", file: "04-gazetteer/furyondy.md", level: 3 },
        { title: "Ahlissa", file: "04-gazetteer/ahlissa.md", level: 3 },
        { title: "Keoland", file: "04-gazetteer/keoland.md", level: 3 },
      ],
    },
    {
      title: "Folk of the Flanaess",
      file: "02-folk/index.md",
      level: 1,
      children: [{ title: "Elves", file: "02-folk/elves.md", level: 3 }],
    },
  ],
};

const MOCK_SECTION_MD = `# Furyondy

## Capital
Chendl

## Ruler
King Belvor IV (LG male human Ftr14)

Furyondy is a kingdom facing threats from all sides. Its people are resilient.

- Grain production is strong
- Trade routes to the south remain open
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(tocData = MOCK_TOC, sectionText = MOCK_SECTION_MD) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url) => {
      if (url.includes("toc.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(tocData),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(sectionText),
      });
    })
  );
}

function renderDrawer(props = {}) {
  const onClose = vi.fn();
  const result = render(
    <WorldGuideDrawer open={true} onClose={onClose} pal={null} {...props} />
  );
  return { ...result, onClose };
}

/** Wait for TOC to load and render chapter rows. */
async function waitForTOC() {
  await waitFor(() => screen.getByText("Greyhawk's World"), { timeout: 3000 });
}

/** Navigate to a section and wait for reading view header.
 *  Uses querySelector to find the chapter row by class + text content,
 *  avoiding ambiguity when a Resume row also contains the same title text.
 */
async function navigateToSection(rowText) {
  const rows = document.querySelectorAll(".wg-chapter-row");
  const row = Array.from(rows).find((r) => r.textContent.includes(rowText));
  if (!row) throw new Error(`Chapter row containing "${rowText}" not found`);
  await act(async () => { fireEvent.click(row); });
  await waitFor(
    () => screen.getByRole("button", { name: /back to guide/i }),
    { timeout: 3000 }
  );
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── WorldGuideTrigger ────────────────────────────────────────────────────────

describe("WorldGuideTrigger", () => {
  it("renders with aria-label and aria-expanded=false when closed", () => {
    render(<WorldGuideTrigger open={false} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /world guide/i });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.classList.contains("is-open")).toBe(false);
  });

  it("adds is-open class and aria-expanded=true when open", () => {
    render(<WorldGuideTrigger open={true} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /world guide/i });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.classList.contains("is-open")).toBe(true);
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<WorldGuideTrigger open={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /world guide/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

// ─── Drawer rendering ─────────────────────────────────────────────────────────

describe("WorldGuideDrawer — closed state", () => {
  it("renders drawer element without is-open class when closed", () => {
    render(<WorldGuideDrawer open={false} onClose={vi.fn()} pal={null} />);
    const drawer = document.querySelector(".world-guide-drawer");
    expect(drawer).toBeTruthy();
    expect(drawer.classList.contains("is-open")).toBe(false);
  });
});

describe("WorldGuideDrawer — open state", () => {
  it("adds is-open class when open=true", () => {
    render(<WorldGuideDrawer open={true} onClose={vi.fn()} pal={null} />);
    const drawer = document.querySelector(".world-guide-drawer");
    expect(drawer.classList.contains("is-open")).toBe(true);
  });

  it("shows World Guide title and close button", () => {
    render(<WorldGuideDrawer open={true} onClose={vi.fn()} pal={null} />);
    expect(screen.getByText("World Guide")).toBeTruthy();
    expect(screen.getByRole("button", { name: /close world guide/i })).toBeTruthy();
  });
});

// ─── TOC loading ─────────────────────────────────────────────────────────────

describe("WorldGuideDrawer — TOC fetch", () => {
  it("fetches toc.json on first open and renders chapter rows", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();

    expect(screen.getByText("Greyhawk's World")).toBeTruthy();
    expect(screen.getByText("Gazetteer of the Flanaess")).toBeTruthy();
    expect(screen.getByText("Folk of the Flanaess")).toBeTruthy();
  });

  it("shows loading state while fetching", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderDrawer();
    await waitFor(() => screen.getByText(/loading/i), { timeout: 2000 });
  });

  it("shows error state and retry button on TOC fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
    renderDrawer();
    await waitFor(() => screen.getByText(/could not load/i), { timeout: 3000 });
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("does not re-fetch toc.json on subsequent opens", async () => {
    mockFetch();
    const { rerender, onClose } = renderDrawer();
    await waitForTOC();

    rerender(<WorldGuideDrawer open={false} onClose={onClose} pal={null} />);
    rerender(<WorldGuideDrawer open={true} onClose={onClose} pal={null} />);
    await waitForTOC();

    // Only 1 fetch call (for toc.json); no second call on re-open
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Navigation ───────────────────────────────────────────────────────────────

describe("WorldGuideDrawer — chapter navigation", () => {
  it("clicking a chapter row fetches markdown and shows reading view", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();
    await navigateToSection("Greyhawk's World");

    expect(screen.getByRole("button", { name: /back to guide/i })).toBeTruthy();
  });

  it("saves last-viewed section to sessionStorage on navigation", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();
    await navigateToSection("Greyhawk's World");

    expect(sessionStorage.getItem("dnd_guide_section")).toBe("01-greyhawks-world.md");
  });

  it("Back button returns to TOC and clears scroll for that file", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();
    await navigateToSection("Greyhawk's World");

    sessionStorage.setItem("dnd_guide_scroll_01-greyhawks-world.md", "200");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /back to guide/i }));
    });
    // Wait for TOC view to return (check for the section label which is unique to TOC)
    await waitFor(() => screen.getByText("Chapters"), { timeout: 3000 });

    expect(sessionStorage.getItem("dnd_guide_scroll_01-greyhawks-world.md")).toBeNull();
  });

  it("caches section content and does not re-fetch on revisit", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();
    await navigateToSection("Greyhawk's World");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /back to guide/i }));
    });
    await waitFor(() => screen.getByText("Chapters"), { timeout: 3000 });

    const callsAfterFirstVisit = global.fetch.mock.calls.length;

    await navigateToSection("Greyhawk's World");

    expect(global.fetch.mock.calls.length).toBe(callsAfterFirstVisit);
  });
});

// ─── Markdown rendering ───────────────────────────────────────────────────────

describe("WorldGuideDrawer — reading view content", () => {
  it("renders section title from # heading without showing raw markdown syntax", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();
    await navigateToSection("Greyhawk's World");

    // The section title div should contain "Furyondy" (from # heading in mock markdown)
    await waitFor(() => {
      const titleEl = document.querySelector(".wg-section-title");
      expect(titleEl).toBeTruthy();
      expect(titleEl.textContent).toBe("Furyondy");
    }, { timeout: 3000 });

    // Raw "# Furyondy" must not appear as a text node
    expect(screen.queryByText(/^# Furyondy/)).toBeNull();
  });

  it("renders ## subheadings as h2 elements", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();
    await navigateToSection("Greyhawk's World");

    await waitFor(() => {
      const h2s = document.querySelectorAll(".wg-reading-content h2");
      expect(h2s.length).toBeGreaterThan(0);
      expect(h2s[0].textContent).toBe("Capital");
    }, { timeout: 3000 });
  });

  it("renders unordered list items as li elements", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();
    await navigateToSection("Greyhawk's World");

    await waitFor(() => {
      const listItems = document.querySelectorAll(".wg-reading-content li");
      expect(listItems.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("shows error state and Back button on section fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url.includes("toc.json")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_TOC) });
        }
        return Promise.resolve({ ok: false });
      })
    );
    renderDrawer();
    await waitForTOC();

    await act(async () => {
      fireEvent.click(
        screen.getByText("Greyhawk's World").closest(".wg-chapter-row")
      );
    });

    await waitFor(() => screen.getByText(/could not load this section/i), { timeout: 3000 });
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /back to guide/i })).toBeTruthy();
  });
});

// ─── Gazetteer ────────────────────────────────────────────────────────────────

describe("WorldGuideDrawer — Gazetteer", () => {
  it("Gazetteer chevron gains is-expanded class after click", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();

    // Chevron starts without is-expanded
    const chevron = screen
      .getByText("Gazetteer of the Flanaess")
      .closest(".wg-chapter-row")
      .querySelector(".wg-chapter-chevron");
    expect(chevron.classList.contains("is-expanded")).toBe(false);

    await act(async () => {
      fireEvent.click(
        screen.getByText("Gazetteer of the Flanaess").closest(".wg-chapter-row")
      );
    });

    // Chevron now has is-expanded, confirming the open state toggled
    await waitFor(() => {
      expect(chevron.classList.contains("is-expanded")).toBe(true);
    }, { timeout: 3000 });

    // Realm rows are present in the DOM
    expect(screen.getAllByText("Furyondy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ahlissa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Keoland").length).toBeGreaterThan(0);
  });

  it("filter input narrows realm list by substring", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();

    await act(async () => {
      fireEvent.click(
        screen.getByText("Gazetteer of the Flanaess").closest(".wg-chapter-row")
      );
    });
    await waitFor(() => screen.getByText("Furyondy"), { timeout: 3000 });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/filter realms/i), {
        target: { value: "fury" },
      });
    });

    expect(screen.getByText("Furyondy")).toBeTruthy();
    expect(screen.queryByText("Ahlissa")).toBeNull();
    expect(screen.queryByText("Keoland")).toBeNull();
  });

  it("shows no-match message when filter has no results", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();

    await act(async () => {
      fireEvent.click(
        screen.getByText("Gazetteer of the Flanaess").closest(".wg-chapter-row")
      );
    });
    await waitFor(() => screen.getByPlaceholderText(/filter realms/i), { timeout: 3000 });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/filter realms/i), {
        target: { value: "zzz" },
      });
    });

    expect(screen.getByText(/no realms match/i)).toBeTruthy();
  });

  it("clicking a realm row navigates to that section", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();

    await act(async () => {
      fireEvent.click(
        screen.getByText("Gazetteer of the Flanaess").closest(".wg-chapter-row")
      );
    });
    await waitFor(() => screen.getByText("Furyondy"), { timeout: 3000 });

    await act(async () => {
      fireEvent.click(screen.getByText("Furyondy").closest(".wg-realm-row"));
    });
    await waitFor(
      () => screen.getByRole("button", { name: /back to guide/i }),
      { timeout: 3000 }
    );

    expect(sessionStorage.getItem("dnd_guide_section")).toBe("04-gazetteer/furyondy.md");
  });

  it("persists Gazetteer expansion state to sessionStorage", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();

    await act(async () => {
      fireEvent.click(
        screen.getByText("Gazetteer of the Flanaess").closest(".wg-chapter-row")
      );
    });
    await waitFor(() => screen.getByText("Furyondy"), { timeout: 3000 });

    expect(sessionStorage.getItem("dnd_guide_gazetteer_expanded")).toBe("true");
  });
});

// ─── Resume row ───────────────────────────────────────────────────────────────

describe("WorldGuideDrawer — Resume row", () => {
  it("shows Resume row when dnd_guide_section is set to a known file", async () => {
    sessionStorage.setItem("dnd_guide_section", "04-gazetteer/furyondy.md");
    mockFetch();
    renderDrawer();
    await waitForTOC();

    // Wait for Resume row specifically (only the resume row contains this pattern)
    await waitFor(() => {
      const resumeRow = document.querySelector(".wg-resume-row");
      expect(resumeRow).toBeTruthy();
      expect(resumeRow.textContent).toMatch(/Furyondy/);
    }, { timeout: 3000 });
  });

  it("does not show Resume row when no section is stored", async () => {
    mockFetch();
    renderDrawer();
    await waitForTOC();

    expect(screen.queryByText(/resume/i)).toBeNull();
  });

  it("clicking Resume row navigates to last-viewed section", async () => {
    sessionStorage.setItem("dnd_guide_section", "04-gazetteer/furyondy.md");
    mockFetch();
    renderDrawer();
    await waitForTOC();

    await waitFor(() => screen.getByText(/resume/i), { timeout: 3000 });
    await act(async () => {
      fireEvent.click(screen.getByText(/resume/i).closest(".wg-resume-row"));
    });
    await waitFor(
      () => screen.getByRole("button", { name: /back to guide/i }),
      { timeout: 3000 }
    );
  });
});

// ─── Keyboard ────────────────────────────────────────────────────────────────

describe("WorldGuideDrawer — keyboard", () => {
  it("Esc key calls onClose", () => {
    mockFetch();
    const { onClose } = renderDrawer();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on non-Esc keys", () => {
    mockFetch();
    const { onClose } = renderDrawer();
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "g" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── sessionStorage ───────────────────────────────────────────────────────────

describe("WorldGuideDrawer — sessionStorage", () => {
  it("writes dnd_guide_open=true when open", () => {
    render(<WorldGuideDrawer open={true} onClose={vi.fn()} pal={null} />);
    expect(sessionStorage.getItem("dnd_guide_open")).toBe("true");
  });

  it("writes dnd_guide_open=false when closed", () => {
    render(<WorldGuideDrawer open={false} onClose={vi.fn()} pal={null} />);
    expect(sessionStorage.getItem("dnd_guide_open")).toBe("false");
  });

  it("writes dnd_guide_open=false on unmount", () => {
    const { unmount } = render(
      <WorldGuideDrawer open={true} onClose={vi.fn()} pal={null} />
    );
    expect(sessionStorage.getItem("dnd_guide_open")).toBe("true");
    unmount();
    expect(sessionStorage.getItem("dnd_guide_open")).toBe("false");
  });
});
