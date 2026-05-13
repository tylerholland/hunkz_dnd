import { describe, expect, it } from "vitest";
import { inferMapContentType, isPdfMap, isSupportedMapContentType } from "./mapFiles";

describe("mapFiles", () => {
  it("infers pdf maps from extension when contentType is missing", () => {
    expect(isPdfMap({ s3Key: "maps/castle.pdf" })).toBe(true);
    expect(inferMapContentType({ imageUrl: "https://example.com/maps/castle.pdf" })).toBe("application/pdf");
  });

  it("respects explicit contentType when present", () => {
    expect(isPdfMap({ imageUrl: "https://example.com/maps/castle.jpg", contentType: "application/pdf" })).toBe(true);
  });

  it("accepts images and pdfs as supported map uploads", () => {
    expect(isSupportedMapContentType("image/webp")).toBe(true);
    expect(isSupportedMapContentType("application/pdf")).toBe(true);
    expect(isSupportedMapContentType("text/plain")).toBe(false);
  });
});
