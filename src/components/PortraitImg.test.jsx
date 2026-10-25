import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PortraitImg from "./PortraitImg";

function load(img, width, height) {
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  fireEvent.load(img);
}

describe("PortraitImg", () => {
  it("centres a character's portrait focus in a round frame once the image loads", () => {
    render(<PortraitImg src="https://x/eoghan-a.png" focus={{ x: 0.632, y: 0.3 }} alt="Eòghan" />);
    const img = screen.getByAltText("Eòghan");
    load(img, 1309, 728);
    // A wide image in a square frame slides right so x = 63% is centred.
    expect(img.style.objectPosition).toMatch(/^7\d\.\d% 50\.0%$/);
  });

  it("leaves portraits without a focus framed by their CSS", () => {
    render(<PortraitImg src="https://x/aesop.png" alt="Aesop" style={{ opacity: 0.5 }} />);
    const img = screen.getByAltText("Aesop");
    load(img, 800, 1200);
    expect(img.style.objectPosition).toBe("");
    expect(img.style.opacity).toBe("0.5");
  });
});
