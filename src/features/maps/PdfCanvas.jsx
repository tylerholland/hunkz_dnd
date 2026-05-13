import { useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export default function PdfCanvas({
  src,
  pageNumber = 1,
  renderScale = 1.5,
  style,
  onDocumentLoad,
  emptyLabel = "PDF unavailable",
}) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    let renderTask = null;

    async function renderPdf() {
      if (!src || !canvasRef.current) return;
      setFailed(false);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        loadingTask = pdfjs.getDocument(src);
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        onDocumentLoad?.({ numPages: pdf.numPages });

        const safePageNumber = Math.min(Math.max(1, pageNumber), pdf.numPages);
        const page = await pdf.getPage(safePageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException" && !cancelled) {
          console.error("Failed to render PDF map:", err);
          setFailed(true);
        }
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // no-op
      }
      try {
        loadingTask?.destroy();
      } catch {
        // no-op
      }
    };
  }, [src, pageNumber, renderScale, onDocumentLoad]);

  if (failed) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 72,
          color: "rgba(180, 190, 200, 0.72)",
          fontFamily: "'Crimson Text', Georgia, serif",
          fontSize: 14,
          textAlign: "center",
          padding: 12,
          ...style,
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ display: "block", ...style }} />;
}
