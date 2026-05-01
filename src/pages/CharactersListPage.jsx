import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listCharacters, verifyPassword } from "../api";
import { PALETTES } from "../components/CharacterSheet";

export default function CharactersListPage() {
  const [characters,  setCharacters]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dmPrompt,    setDmPrompt]    = useState(false);
  const [dmInput,     setDmInput]     = useState("");
  const [dmError,     setDmError]     = useState(null);
  const [dmActive,    setDmActive]    = useState(() => !!sessionStorage.getItem("dnd_dm_password"));
  const navigate = useNavigate();

  useEffect(() => {
    listCharacters()
      .then(setCharacters)
      .catch(() => setCharacters([]))
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

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0f14", color: "#c8bfaf",
      fontFamily: "'Crimson Text', Georgia, serif", padding: "0 32px 80px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Top nav */}
        <div style={{
          padding: "18px 0 16px",
          marginBottom: 32,
          borderBottom: "1px solid rgba(100,130,160,0.2)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}>
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
              <button onClick={() => setDmPrompt(true)} style={{
                background: "transparent", border: "1px solid rgba(100,130,160,0.2)",
                borderRadius: 3, color: "#3a5a6a", fontFamily: "'IM Fell English', Georgia, serif",
                fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                padding: "5px 12px", cursor: "pointer",
                whiteSpace: "nowrap",
              }}>
                DM Login
              </button>
            )}
          </div>

          {dmActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Link
                to="/dm"
                style={{
                  background: "transparent", border: "1px solid rgba(100,130,160,0.3)",
                  borderRadius: 3, color: "#6a8fa8", fontFamily: "'IM Fell English', Georgia, serif",
                  fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                  padding: "5px 12px", textDecoration: "none", display: "inline-block",
                }}
              >
                Campaign
              </Link>
              <button onClick={handleDmLogout} style={{
                background: "transparent", border: "1px solid rgba(192,96,96,0.4)",
                borderRadius: 3, color: "#c06060", fontFamily: "'IM Fell English', Georgia, serif",
                fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                padding: "5px 12px", cursor: "pointer",
              }}>
                End Session
              </button>
            </div>
          )}
          {!dmActive && (
            <div style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#3a5a6a" }}>
              View and manage your party roster
            </div>
          )}
        </div>

        {/* DM password modal */}
        {dmPrompt && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.75)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 24,
          }}>
            <div style={{
              background: "#111e2c", border: "1px solid rgba(100,130,160,0.18)",
              borderRadius: 6, padding: "32px 28px", width: "100%", maxWidth: 340,
            }}>
              <div style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#3a5a6a", marginBottom: 8 }}>
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
                  style={{
                    background: "rgba(18,32,48,0.55)", border: "1px solid rgba(100,130,160,0.18)",
                    borderRadius: 3, color: "#c8bfaf", fontFamily: "'Crimson Text', Georgia, serif",
                    fontSize: 16, padding: "9px 13px", width: "100%", outline: "none", marginBottom: 8,
                  }}
                />
                {dmError && (
                  <div style={{ color: "#c06060", fontSize: 14, fontFamily: "'Crimson Text', Georgia, serif", marginBottom: 10 }}>
                    {dmError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => { setDmPrompt(false); setDmInput(""); setDmError(null); }} style={{
                    background: "transparent", border: "1px solid rgba(100,130,160,0.18)",
                    borderRadius: 3, color: "#6a8fa8", fontFamily: "'Crimson Text', Georgia, serif",
                    fontSize: 14, padding: "8px 16px", cursor: "pointer", flex: 1,
                  }}>
                    Cancel
                  </button>
                  <button type="submit" style={{
                    background: "rgba(18,58,78,0.5)", border: "1px solid #6a8fa8",
                    borderRadius: 3, color: "#a0c0d0", fontFamily: "'IM Fell English', Georgia, serif",
                    fontSize: 14, letterSpacing: "0.08em", padding: "9px 18px",
                    cursor: "pointer", flex: 2,
                  }}>
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
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 20, marginBottom: 32,
          }}>
            {characters.map(c => {
              const p = PALETTES[c.palette] || PALETTES.ember;
              return (
                <button
                  key={c.slug}
                  onClick={() => navigate(`/characters/${c.slug}`)}
                  style={{
                    background: "transparent", border: `1px solid ${p.border}`,
                    borderRadius: 4, padding: 0, cursor: "pointer", textAlign: "left",
                    transition: "border-color 0.18s, transform 0.12s",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = p.accent;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = p.border;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
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
                    <div style={{
                      width: "100%", aspectRatio: "4/3",
                      background: p.surface, display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
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
            <button
              onClick={() => navigate("/characters/new")}
              style={{
                background: "transparent",
                border: "1px dashed rgba(100,130,160,0.25)",
                borderRadius: 4, cursor: "pointer", padding: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                minHeight: 200, transition: "border-color 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.25)"; }}
            >
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
