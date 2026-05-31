import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import MapViewer from "./MapViewer";
import { PALETTES } from "../../components/CharacterSheet";

const ORIGINAL_PLATFORM = navigator.platform;

function setPlatform(value) {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value,
  });
}

describe("MapViewer zoom lock", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPlatform("MacIntel");
  });

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM);
  });

  it("defaults to modifier-locked wheel zoom and ignores plain scrolling", () => {
    render(
      <MapViewer
        imageUrl="https://example.com/map.png"
        name="Test Map"
        contentType="image/png"
        height={320}
        pal={PALETTES.ocean}
      />
    );

    expect(screen.getByText("100%")).toBeInTheDocument();

    const container = screen.getByAltText("Test Map").parentElement;
    fireEvent.wheel(container, { deltaY: -100, clientX: 80, clientY: 80 });

    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.wheel(container, { deltaY: -100, clientX: 80, clientY: 80, metaKey: true });

    expect(screen.getByText("110%")).toBeInTheDocument();
  });

  it("allows free wheel zoom when the viewer receives the unlocked mode", () => {
    render(
      <MapViewer
        imageUrl="https://example.com/map.png"
        name="Test Map"
        contentType="image/png"
        height={320}
        pal={PALETTES.ocean}
        freeZoom
      />
    );

    const container = screen.getByAltText("Test Map").parentElement;
    fireEvent.wheel(container, { deltaY: -100, clientX: 80, clientY: 80 });

    expect(screen.getByText("110%")).toBeInTheDocument();
  });
});
