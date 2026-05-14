import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listCharacters, verifyPassword, getPartyRoster } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import "./pages.css";

const RESERVED_CHARACTER_SLUGS = new Set(["initiative", "npc-combat", "party-roster"]);

function isRenderableCharacterSummary(entry) {
  if (!entry || typeof entry !== "object") return false;
  const slug = typeof entry.slug === "string" ? entry.slug.trim() : "";
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!slug || !name) return false;
  if (RESERVED_CHARACTER_SLUGS.has(slug)) return false;
  return true;
}

export default function CharactersListPage() {
  const [characters,  setCharacters]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dmPrompt,    setDmPrompt]    = useState(false);
  const [dmInput,     setDmInput]     = useState("");
  const [dmError,     setDmError]     = useState(null);
  const [dmActive,    setDmActive]    = useState(() => !!sessionStorage.getItem("dnd_dm_password"));
  const [partyMemberSlugs, setPartyMemberSlugs] = useState(() => new Set());
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      listCharacters(),
      getPartyRoster().catch(() => ({ members: [] })),
    ])
      .then(([characterData, rosterData]) => {
        const nextCharacters = Array.isArray(characterData) ? characterData : [];
        setCharacters(nextCharacters);

        const validCharacters = nextCharacters.filter(isRenderableCharacterSummary);
        const validSlugs = new Set(validCharacters.map((character) => character.slug));
        const rosterMembers = Array.isArray(rosterData?.members) ? rosterData.members.filter((slug) => validSlugs.has(slug)) : [];
        setPartyMemberSlugs(new Set(rosterData?.exists ? rosterMembers : validCharacters.map((character) => character.slug)));
      })
      .catch(() => {
        setCharacters([]);
        setPartyMemberSlugs(new Set());
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDmLogin = async (e) => {
    e.preventDefault();
    setDmError(null);
    // Verify against the first available character
    const first = characters[0];
    if (!first) { setDmError("No characters available to verify against."); return; }
    try {
      const result = await verifyPassword(first.slug, dmInput);
      if (result.valid && result.role === "dm") {
        sessionStorage.setItem("dnd_dm_password", dmInput);
        setDmActive(true);
        setDmPrompt(false);
        setDmInput("");
      } else {
        setDmError("Incorrect DM password.");
      }
    } catch {
      setDmError("Could not verify password.");
    }
  };

  const handleDmLogout = () => {
    sessionStorage.removeItem("dnd_dm_password");
    setDmActive(false);
  };

  const pal = PALETTES.ember;
  const visibleCharacters = characters.filter(isRenderableCharacterSummary);

  // Palette CSS variables set once at root; children reference var(--pal-*)
  const palVars = {
    "--pal-bg":            pal.bg,
    "--pal-surface":       pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border":        pal.border,
    "--pal-accent":        pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim":    pal.accentDim,
    "--pal-text":          pal.text,
    "--pal-text-body":     pal.textBody,
    "--pal-text-muted":    pal.textMuted,
    "--pal-glow-1":        pal.glow1,
    "--pal-glow-2":        pal.glow2,
    "--pal-gem":           pal.gem,
    "--pal-gem-low":       pal.gemLow,
  };

  return (
    <div style={{
      ...palVars,
      minHeight: "100vh",
      background: "#0d0f14",
      color: "#c8bfaf",
      fontFamily: "'Crimson Text', Georgia, serif",
      padding: "0 32px 80px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Top nav */}
        <div style={{
          padding: "18px 0 16px",
          marginBottom: 32,
          borderBottom: "1px solid rgba(100,130,160,0.2)",
        }}>
          <div className="flex-row-spread" style={{ gap: 12, marginBottom: 10 }}>
            <div style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(1.4rem, 4vw, 2rem)",
              color: "#c8bfaf",
              letterSpacing: "0.04em",
            }}>
              Character Library
            </div>

            {dmActive ? (
              <span style={{
                background: "rgba(18,58,78,0.22)",
                border: "1px solid rgba(106,143,168,0.4)",
                borderRadius: 999,
                color: "#a0c0d0",
                fontFamily: "'IM Fell English', Georgia, serif",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "5px 12px",
                whiteSpace: "nowrap",
              }}>
                DM ✓
              </span>
            ) : (
              <button onClick={() => setDmPrompt(true)} className="btn-ghost" style={{ padding: "5px 12px" }}>
                DM Login
              </button>
            )}
          </div>

          {dmActive && (
            <div className="flex-row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Link to="/dm" className="btn-ghost" style={{ padding: "5px 12px", textDecoration: "none" }}>
                Campaign
              </Link>
              <Link to="/dm-classic" className="btn-ghost" style={{ padding: "5px 12px", textDecoration: "none" }}>
                Classic Layout
              </Link>
              <Link to="/maps" className="btn-ghost" style={{ padding: "5px 12px", textDecoration: "none" }}>
                Maps
              </Link>
              <button onClick={handleDmLogout} className="btn-ghost" style={{ padding: "5px 12px", borderColor: "rgba(192,96,96,0.4)", color: "#c06060" }}>
                End Session
              </button>
            </div>
          )}
          {!dmActive && (
            <div className="label-ui" style={{ marginTop: 4 }}>
              View and manage your party roster
            </div>
          )}
        </div>

        {/* DM password modal */}
        {dmPrompt && (
          <div className="modal-overlay" style={{ zIndex: 100 }}>
            <div className="modal-panel" style={{ maxWidth: 340 }}>
              <div className="label-ui" style={{ marginBottom: 8, letterSpacing: "0.3em" }}>
                DM Login
              </div>
              <div style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: 18, color: "#c8bfaf", marginBottom: 20 }}>
                Dungeon Master Access
              </div>
              <form onSubmit={handleDmLogin}>
                <input
                  type="password"
                  autoFocus
                  placeholder="DM password…"
                  value={dmInput}
                  onChange={e => setDmInput(e.target.value)}
                  className="input-base"
                  style={{ marginBottom: 8, fontSize: 16 }}
                />
                {dmError && (
                  <div style={{ color: "#c06060", fontSize: 14, fontFamily: "'Crimson Text', Georgia, serif", marginBottom: 10 }}>
                    {dmError}
                  </div>
                )}
                <div className="flex-row" style={{ gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => { setDmPrompt(false); setDmInput(""); setDmError(null); }}
                    className="btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" style={{ flex: 2 }}>
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Character grid */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#3a5a6a", fontStyle: "italic", fontSize: 18 }}>
            Loading characters…
          </div>
        ) : (
          <div className="char-list-grid">
            {visibleCharacters.map(c => {
              const p = PALETTES[c.palette] || PALETTES.ember;
              return (
                <button
                  key={c.slug}
                  onClick={() => navigate(`/characters/${c.slug}`)}
                  className="char-card-btn"
                  style={{ border: `1px solid ${p.border}` }}
                >
                  {/* Portrait */}
                  {c.portraitUrl ? (
                    <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden" }}>
                      <img
                        src={c.portraitUrl}
                        alt={c.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>
                  ) : (
                    <div className="char-card-portrait-placeholder" style={{ background: p.surface }}>
                      <span style={{ fontFamily: "'Cinzel', serif", fontSize: 32, color: p.accentDim }}>
                        {c.name?.[0] || "?"}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ padding: "14px 16px", background: `${p.bg}cc` }}>
                    <div style={{
                      fontFamily: "'Cinzel', Georgia, serif", fontWeight: 400,
                      fontSize: 16, color: p.text, letterSpacing: "0.04em", marginBottom: 4,
                    }}>
                      {c.name}
                    </div>
                    {partyMemberSlugs.has(c.slug) && (
                      <div style={{
                        display: "inline-block",
                        marginBottom: 6,
                        background: `${p.accentDim}55`,
                        border: `1px solid ${p.border}`,
                        borderRadius: 999,
                        color: p.accent,
                        fontFamily: "'IM Fell English', Georgia, serif",
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        padding: "2px 8px",
                      }}>
                        In Party
                      </div>
                    )}
                    {c.nameAlt && (
                      <div style={{ fontStyle: "italic", fontSize: 13, color: p.accent, marginBottom: 4 }}>
                        "{c.nameAlt}"
                      </div>
                    )}
                    <div style={{
                      fontFamily: "'IM Fell English', Georgia, serif",
                      fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
                      color: p.textMuted,
                    }}>
                      {c.race && c.charClass ? `${c.race} · ${c.charClass}` : c.charClass || c.race || ""}
                      {c.level ? ` · Lv ${c.level}` : ""}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* New character card */}
            <button onClick={() => navigate("/characters/new")} className="char-card-new">
              <div style={{ fontSize: 28, color: "rgba(100,130,160,0.4)", marginBottom: 10 }}>+</div>
              <div style={{
                fontFamily: "'IM Fell English', Georgia, serif",
                fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase",
                color: "rgba(100,130,160,0.4)",
              }}>
                New Character
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
