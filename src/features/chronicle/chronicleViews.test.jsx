import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api";
import ChronicleList from "./ChronicleList";
import RecordSession from "./RecordSession";
import SessionView from "./SessionView";
import { PALETTES } from "../characterSheet/theme";

vi.mock("../../api", () => ({
  getChronicle: vi.fn(),
  getChronicleSession: vi.fn(),
  getRollHistoryWithArchive: vi.fn(),
  createChronicleSession: vi.fn(),
  updateChronicleSession: vi.fn(),
  deleteChronicleSession: vi.fn(),
  putChronicleChapters: vi.fn(),
  putChronicleSummary: vi.fn(),
  addChronicleRecollection: vi.fn(),
  updateChronicleRecollection: vi.fn(),
}));

const at = (min) => new Date(Date.UTC(2026, 6, 23, 2, min)).toISOString();
const meta = { id: "s1", chapterId: "c1", title: "Session 1 · Wed Jul 22", startAt: at(0), endAt: at(90), eventCount: 2, players: [{ slug: "aesop", name: "Aesop", palette: "nightwood" }], summaryExcerpt: "", recollectionCount: 0 };

beforeEach(() => vi.clearAllMocks());

describe("ChronicleList", () => {
  it("lists chapters with their sessions, and offers recording to the DM", async () => {
    api.getChronicle.mockResolvedValue({ chapters: [{ id: "c1", name: "The Road to Hearthfire" }], sessions: [meta] });
    render(<MemoryRouter><ChronicleList isDm dmPassword="dm" /></MemoryRouter>);
    expect(await screen.findByText("The Road to Hearthfire")).toBeTruthy();
    expect(screen.getByText("Session 1 · Wed Jul 22")).toBeTruthy();
    expect(screen.getByText("+ Record a session")).toBeTruthy();
  });
});

describe("RecordSession", () => {
  it("records the picked range without the events the DM unticked", async () => {
    api.getRollHistoryWithArchive.mockResolvedValue({
      rolls: [{ id: "r2", createdAt: at(20), slug: "aesop", characterName: "Aesop", label: "Free Roll", exprLabel: "1d6", total: 4 }],
      archived: [{ id: "r1", createdAt: at(10), slug: "aesop", characterName: "Aesop", label: "Free Roll", exprLabel: "2d6", total: 9 }],
    });
    api.getChronicle.mockResolvedValue({ chapters: [{ id: "c1", name: "Chapter One" }], sessions: [] });
    api.createChronicleSession.mockResolvedValue({ session: { id: "new" } });
    render(
      <MemoryRouter initialEntries={["/chronicle/record"]}>
        <Routes>
          <Route path="/chronicle/record" element={<RecordSession dmPassword="dm" />} />
          <Route path="/chronicle/:id" element={<p>session page</p>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/2d6/)).toBeTruthy();
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[boxes.length - 1]); // untick the later roll
    fireEvent.click(screen.getByText("Record session"));
    await screen.findByText("session page");
    const payload = api.createChronicleSession.mock.calls[0][1];
    expect(payload.excludedEventIds).toEqual(["r2"]);
    expect(payload.chapterId).toBe("c1");
  });
});

describe("SessionView", () => {
  const events = [
    { id: "r1", createdAt: at(10), slug: "aesop", characterName: "Aesop", paletteKey: "nightwood", label: "Free Roll", exprLabel: "1d20", total: 20, rollValues: [20] },
    { id: "h1", type: "hp", createdAt: at(20), subject: { type: "npc", sourceId: "gob", name: "Goblin" }, delta: -7, by: { type: "character", sourceId: "aesop", name: "Aesop" }, action: { name: "Unarmed Strike" } },
  ];

  it("shows the timeline and highlights, and lets a player edit the summary", async () => {
    api.getChronicleSession.mockResolvedValue({ session: { ...meta, events, summary: null, recollections: [] }, chapters: [{ id: "c1", name: "The Road" }] });
    api.putChronicleSummary.mockResolvedValue({ summary: { text: "We won.", updatedAt: at(100), updatedBy: { name: "Aesop" } } });
    const creds = { password: "pw", asSlug: "aesop" };
    render(<MemoryRouter><SessionView sessionId="s1" viewer={{ role: "player", characters: [{ slug: "aesop", password: "pw" }] }} creds={creds} pal={PALETTES.ocean} /></MemoryRouter>);
    expect(await screen.findByText("The Night at a Glance")).toBeTruthy();
    expect(screen.getByText("Natural 20s")).toBeTruthy();
    fireEvent.click(screen.getByText("Add summary"));
    fireEvent.change(screen.getByRole("textbox", { name: /Summary/ }), { target: { value: "We won." } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.getByText("We won.")).toBeTruthy());
    expect(api.putChronicleSummary).toHaveBeenCalledWith(creds, "s1", { text: "We won.", baseUpdatedAt: null });
    expect(screen.getByText("Add a recollection")).toBeTruthy();
  });

  it("keeps a player's draft when someone else saved the summary first", async () => {
    api.getChronicleSession.mockResolvedValue({ session: { ...meta, events, summary: null, recollections: [] }, chapters: [] });
    api.putChronicleSummary.mockRejectedValue(Object.assign(new Error("Someone else edited this summary."), { status: 409, data: { summary: { text: "The DM's version.", updatedAt: at(99), updatedBy: { name: "DM" } } } }));
    render(<MemoryRouter><SessionView sessionId="s1" viewer={{ role: "player", characters: [{ slug: "aesop", password: "pw" }] }} creds={{ password: "pw", asSlug: "aesop" }} pal={PALETTES.ocean} /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Add summary"));
    fireEvent.change(screen.getByRole("textbox", { name: /Summary/ }), { target: { value: "My version." } });
    fireEvent.click(screen.getByText("Save"));
    expect(await screen.findByText("Someone else edited this summary.")).toBeTruthy();
    expect(screen.getByText("The DM's version.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Summary/ }).value).toBe("My version.");
  });
});
