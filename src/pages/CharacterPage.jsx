import { useParams } from "react-router-dom";
import CharacterSheet from "../components/CharacterSheet";

// Static imports — add a new line here for each character JSON file.
// Vite resolves these at build time; no fetch needed.
import aragornData from "../characters/aragorn.json";
import eoghanData  from "../characters/eoghan.json";

const CHARACTERS = {
  aragorn: aragornData,
  eoghan:  eoghanData,
};

export default function CharacterPage() {
  const { slug } = useParams();
  const data = CHARACTERS[slug] ?? null;

  if (!data) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#0d0f14", color: "#6a8fa8",
        fontFamily: "'Crimson Text', Georgia, serif", fontSize: 18,
      }}>
        <div style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 16, opacity: 0.5 }}>
          404
        </div>
        <div>No character found for <em>{slug}</em>.</div>
        <div style={{ marginTop: 8, fontSize: 14, opacity: 0.5 }}>
          Add <code>{slug}.json</code> to <code>src/characters/</code> and register it in CharacterPage.jsx.
        </div>
      </div>
    );
  }

  return <CharacterSheet initialData={data} />;
}
