import PdfCanvas from "./PdfCanvas";
import { isPdfMap } from "./mapFiles";

export default function MapThumbnail({
  map,
  alt,
  style,
  pdfScale = 0.7,
}) {
  if (isPdfMap(map)) {
    return (
      <div
        style={{
          background: "#10161f",
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          ...style,
        }}
      >
        <PdfCanvas
          src={map.imageUrl}
          renderScale={pdfScale}
          emptyLabel="PDF"
          style={{ width: "100%", height: "auto" }}
        />
      </div>
    );
  }

  return (
    <img
      src={map.imageUrl}
      alt={alt}
      style={{
        display: "block",
        objectFit: "cover",
        ...style,
      }}
    />
  );
}
