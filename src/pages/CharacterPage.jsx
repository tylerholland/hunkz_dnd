import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import CharacterSheet, { PALETTES } from "../components/CharacterSheet";
import { getCharacter, updateCharacter } from "../api";

export default function CharacterPage() {
  const { slug } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Read cached palette for this slug so the spinner matches on return visits
  const cachedPalette = sessionStorage.getItem(`dnd_palette_${slug}`);
  const pal = PALETTES[cachedPalette] || null;
  const spinnerColor   = pal ? pal.accent       : "rgba(255,255,255,0.35)";
  const spinnerBg      = pal ? `${pal.accent}22` : "rgba(255,255,255,0.08)";
  const spinnerPageBg  = pal ? pal.bg            : "#0d0f14";

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCharacter(slug)
      .then(d => {
        setData(d);
        if (d?.palette) sessionStorage.setItem(`dnd_palette_${slug}`, d.palette);
      })
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSave = async (charData, password) => {
    await updateCharacter(slug, charData, password);
    setData(charData);
    if (charData?.palette) sessionStorage.setItem(`dnd_palette_${slug}`, charData.palette);
  };

  if (loading) {
    return (
      <div style={{ ...centeredStyle, background: spinnerPageBg }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `2px solid ${spinnerBg}`, borderTopColor: spinnerColor,
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={centeredStyle}>
        <div style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 16, opacity: 0.5, color: "#6a8fa8", fontFamily: "sans-serif" }}>
          404
        </div>
        <div style={{ fontFamily: "'Crimson Text', Georgia, serif", fontSize: 18, color: "#6a8fa8" }}>
          No character found for <em>{slug}</em>.
        </div>
        <div style={{ marginTop: 8, fontSize: 14, opacity: 0.5, color: "#6a8fa8", fontFamily: "sans-serif" }}>
          <a href="/" style={{ color: "inherit" }}>← Back to characters</a>
        </div>
      </div>
    );
  }

  return <CharacterSheet initialData={data} slug={slug} onSave={handleSave} />;
}

const centeredStyle = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  background: "#0d0f14",
};
