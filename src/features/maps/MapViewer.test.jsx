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

describe("MapViewer initial framing", () => {
  function sizeContainer(width, height) {
    const w = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => height });
    return () => {
      if (w) Object.defineProperty(HTMLElement.prototype, "clientWidth", w);
      if (h) Object.defineProperty(HTMLElement.prototype, "clientHeight", h);
    };
  }

  it("centres and fits the whole map when the DM hasn't published a view", () => {
    const restore = sizeContainer(400, 300);
    try {
      render(<MapViewer imageUrl="https://example.com/big.png" name="Big" pal={PALETTES.ember} />);
      const img = screen.getByAltText("Big");
      Object.defineProperty(img, "naturalWidth", { configurable: true, value: 2000 });
      Object.defineProperty(img, "naturalHeight", { configurable: true, value: 1000 });
      fireEvent.load(img);
      // fit = min(400/2000, 300/1000) = 0.2 → clamped to the 0.5 minimum;
      // box centred: x = 200 - 1000, y = 150 - 500.
      expect(img.parentElement.style.transform).toContain("translate(-800px, -350px) scale(0.5)");
    } finally {
      restore();
    }
  });
});
