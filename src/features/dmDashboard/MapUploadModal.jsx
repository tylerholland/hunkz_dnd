import { useState, useRef, useEffect } from "react";
import { presignMap, postMap, putMapActive } from "../../api";
import MapThumbnail from "../maps/MapThumbnail";
import { isSupportedMapContentType } from "../maps/mapFiles";

const MAX_MAP_SIZE_BYTES = 50 * 1024 * 1024;
const LARGE_MAP_WARNING_BYTES = 25 * 1024 * 1024;

export function displayMapName(map) {
  if (map.name) return map.name;
  // Extract filename portion from s3Key: maps/{uuid}.ext
  const parts = (map.s3Key || "").split("/");
  const filename = parts[parts.length - 1] || "";
  const base = filename.replace(/\.[^.]+$/, ""); // strip extension
  const spaced = base.replace(/[-_]+/g, " ");
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MapUploadModal({ initialFile, dmPassword, onUploaded, onClose }) {
  const [file, setFile] = useState(initialFile || null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { map }
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);

  // Pre-fill name from file
  useEffect(() => {
    if (file) {
      const base = file.name.replace(/\.[^.]+$/, "");
      const spaced = base.replace(/[-_]+/g, " ");
      const titled = spaced.replace(/\b\w/g, (c) => c.toUpperCase());
      setName(titled.slice(0, 48));
    }
  }, [file]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileSelect = (f) => {
    if (!f) return;
    if (!isSupportedMapContentType(f.type)) { setError("Only image files and PDFs are supported."); return; }
    if (f.size > MAX_MAP_SIZE_BYTES) {
      setError("Maps must be 50 MB or smaller.");
      return;
    }
    setError("");
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    handleFileSelect(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      const { uploadUrl, id, s3Key, imageUrl } = await presignMap(file.name, file.type, file.size, dmPassword);

      // XHR for progress
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setProgress(100);
      const result = await postMap({ id, name, s3Key, imageUrl, contentType: file.type }, dmPassword);
      const newMap = (result.maps || []).find((m) => m.id === id) || { id, name, s3Key, imageUrl, contentType: file.type };
      setDone({ map: newMap });
      onUploaded(newMap); // refresh library immediately on successful upload
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const isLarge = file && file.size >= LARGE_MAP_WARNING_BYTES;

  // Palette-agnostic styles (use a fallback if pal not available — this modal is always rendered within DM context)
  const bg = "rgba(10,15,24,0.97)";
  const border = "rgba(100,130,160,0.28)";
  const accent = "#6a8fa8";
  const accentBright = "#a0c0d0";
  const textMuted = "#3a5a6a";
  const text = "#c8bfaf";
  const fontUI = "'IM Fell English', Georgia, serif";
  const fontBody = "'Crimson Text', Georgia, serif";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: 28, width: "100%", maxWidth: 480, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontFamily: fontUI, fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: accentBright }}>Upload Map</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {done ? (
          <div>
            <div style={{ fontFamily: fontBody, fontSize: 15, color: "#88cc88", marginBottom: 16 }}>
              "{displayMapName(done.map)}" uploaded successfully.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setFile(null); setName(""); setDone(null); setProgress(0); }}
                style={{ flex: 1, background: "transparent", border: `1px solid ${border}`, borderRadius: 4, color: accentBright, fontFamily: fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "9px 0", cursor: "pointer" }}>
                Upload Another
              </button>
              <button onClick={() => { putMapActive(done.map.id, dmPassword).then(() => onUploaded(done.map)); onClose(); }}
                style={{ flex: 1, background: "rgba(18,32,48,0.6)", border: `1px solid ${accent}`, borderRadius: 4, color: accentBright, fontFamily: fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "9px 0", cursor: "pointer" }}>
                Set as Active
              </button>
            </div>
          </div>
        ) : !file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? accent : border}`,
              borderRadius: 5,
              padding: "36px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragging ? "rgba(100,130,160,0.06)" : "transparent",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <div style={{ fontFamily: fontUI, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: textMuted, marginBottom: 10 }}>Drop image here</div>
            <div style={{ fontFamily: fontBody, fontSize: 14, color: accent }}>or click to choose file</div>
            <div style={{ fontFamily: fontBody, fontSize: 12, color: textMuted, marginTop: 8 }}>Supports image files and PDFs up to 50 MB.</div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(e) => handleFileSelect(e.target.files?.[0])} />
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 16, alignItems: "flex-start" }}>
              <MapThumbnail map={{ imageUrl: previewUrl, contentType: file.type }} alt="preview" style={{ width: 80, height: 56, borderRadius: 3, border: `1px solid ${border}`, flexShrink: 0 }} pdfScale={0.45} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: fontBody, fontSize: 12, color: textMuted, fontStyle: "italic", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 48))}
                  placeholder="Map name (optional)"
                  style={{ width: "100%", background: "rgba(18,32,48,0.6)", border: `1px solid ${border}`, borderRadius: 3, color: text, fontFamily: fontBody, fontSize: 14, padding: "7px 10px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {isLarge && (
              <div style={{ background: "rgba(180,130,40,0.12)", border: "1px solid rgba(180,130,40,0.3)", borderRadius: 3, padding: "8px 12px", fontFamily: fontBody, fontSize: 13, color: "#c8a050", marginBottom: 14 }}>
                Large image — big maps can load slowly on mobile. Files over 50 MB are blocked.
              </div>
            )}

            {uploading && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: accent, borderRadius: 2, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontFamily: fontUI, fontSize: 11, color: textMuted, textAlign: "right" }}>{progress}%</div>
              </div>
            )}

            {error && <div style={{ color: "#c06060", fontFamily: fontBody, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setFile(null); setName(""); setError(""); }} disabled={uploading}
                style={{ flex: 1, background: "transparent", border: `1px solid ${border}`, borderRadius: 4, color: textMuted, fontFamily: fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "9px 0", cursor: uploading ? "not-allowed" : "pointer" }}>
                ← Back
              </button>
              <button onClick={handleUpload} disabled={uploading}
                style={{ flex: 2, background: uploading ? "rgba(18,32,48,0.3)" : "rgba(18,32,48,0.6)", border: `1px solid ${accent}`, borderRadius: 4, color: accentBright, fontFamily: fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "9px 0", cursor: uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Uploading…" : "Upload Map →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
