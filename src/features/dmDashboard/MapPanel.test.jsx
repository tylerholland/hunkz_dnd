import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mapViewerMocks = vi.hoisted(() => ({
  writeMapFreeZoomPreference: vi.fn(),
}));

vi.mock("../maps/MapViewer", () => ({
  __esModule: true,
  default: ({ freeZoom }) => <div data-testid="map-viewer">{freeZoom ? "free" : "locked"}</div>,
  getMapZoomModifierLabel: () => "Cmd",
  readMapFreeZoomPreference: () => false,
  writeMapFreeZoomPreference: mapViewerMocks.writeMapFreeZoomPreference,
}));

vi.mock("./MapLibraryModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("../../api", () => ({
  putMapActive: vi.fn(),
  putMapView: vi.fn(),
}));

import MapPanel from "./MapPanel";
import { PALETTES } from "../characterSheet/theme";

describe("MapPanel zoom mode toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the zoom mode toggle inline with map actions and persists changes", () => {
    render(
      <MapPanel
        mapLibrary={{
          activeMapId: "map-1",
          activeMapView: null,
          maps: [{ id: "map-1", name: "Dungeon", imageUrl: "https://example.com/map.png", contentType: "image/png" }],
        }}
        dmPassword="swordfish"
        onLibraryChange={vi.fn()}
        pal={PALETTES.ocean}
      />
    );

    expect(screen.getByText("Set for Players")).toBeInTheDocument();
    expect(screen.getByText("Open Window")).toBeInTheDocument();
    expect(screen.getByText("Cmd + Scroll to Zoom")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Toggle free zoom" })).toBeInTheDocument();
    expect(screen.getByTestId("map-viewer")).toHaveTextContent("locked");

    fireEvent.click(screen.getByRole("switch", { name: "Toggle free zoom" }));

    expect(screen.getByText("Free Zoom")).toBeInTheDocument();
    expect(screen.getByTestId("map-viewer")).toHaveTextContent("free");
    expect(mapViewerMocks.writeMapFreeZoomPreference).toHaveBeenLastCalledWith(true);
  });
});
