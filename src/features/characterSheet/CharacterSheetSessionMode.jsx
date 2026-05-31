/**
 * CharacterSheetSessionMode
 *
 * Story 27: Player Sheet — Profile Mode vs. Session Mode.
 *
 * Renders the session-mode two-column combat reference surface.
 * Profile mode redirects to the existing CharacterSheet via the
 * /characters/:slug route.
 *
 * Props:
 *   initialData       — character object from API
 *   slug              — character slug
 *   mode              — "profile" | "session"
 *   setMode           — (newMode: string) => void
 *   onSave            — (charData, password) => Promise<void>
 *   onDelete          — (password) => Promise<void>
 *   onSessionSync     — () => void (trigger background refresh)
 *   activeMap         — map object | null
 *   activeMapView     — map view state | null
 *   partyStatus       — { visible: boolean, members: [] }
 *   initiativeData    — { round, activeTurnIndex, entries: [] }
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PALETTES } from "./theme";
import { modOf, fmtMod, CONDITIONS } from "./constants";
import { patchSession } from "../../api";
import DiceRoller from "../../components/DiceRoller";
import MapViewer from "../maps/MapViewer";
import "./characterSheet.css";

// Stat abbreviation map
const STAT_ABBR = {
  Strength: "STR",
  Dexterity: "DEX",
  Constitution: "CON",
  Wisdom: "WIS",
  Intelligence: "INT",
  Charisma: "CHA",
};

function hpBarColor(current, max) {
  if (max <= 0) return "cs-sm-hp-bar-healthy";
  const pct = current / max;
  if (pct <= 0.2) return "cs-sm-hp-bar-critical";
  if (pct <= 0.5) return "cs-sm-hp-bar-wounded";
  return "cs-sm-hp-bar-healthy";
}

function hpNumClass(current, max) {
  if (current <= 0) return "death";
  if (max > 0 && current / max <= 0.2) return "critical";
  if (max > 0 && current / max <= 0.5) return "wounded";
  return "";
}

function partyRowClass(member) {
  if (!member) return "";
  const { hpCurrent, hpMax, deathSaves } = member;
  if (hpCurrent <= 0) {
    if (deathSaves?.failures >= 3) return "down";
    return "down";
  }
  if (hpMax > 0 && hpCurrent / hpMax <= 0.2) return "critical";
  if (hpMax > 0 && hpCurrent / hpMax <= 0.5) return "bloodied";
  return "";
}

function avatarInitial(name) {
  return (name || "?")[0].toUpperCase();
}

// Compute total ability modifier including item bonuses
function computeMod(stat, weapons, equipment) {
  const base = modOf(stat.score);
  const attrName = stat.stat;
  let bonus = 0;
  for (const item of [...(weapons || []), ...(equipment || [])]) {
    if (item.equipped === false) continue;
    for (const mod of (item.mods || [])) {
      if (mod.attribute === attrName) bonus += (mod.value || 0);
    }
  }
  return base + bonus;
}

// Build weapon meta line from mods (Attack Bonus + Damage)
function weaponMeta(weapon) {
  const atkMod = (weapon.mods || []).find((m) => m.attribute === "Attack Bonus");
  const dmgMod = (weapon.mods || []).find((m) => m.attribute === "Damage");
  const parts = [];
  if (atkMod) parts.push(`${fmtMod(atkMod.value)} hit`);
  if (dmgMod) parts.push(dmgMod.value);
  return parts.join(" · ") || "";
}

// DamageHealModal — simple number input modal
function DamageHealModal({ type, onConfirm, onClose, pal }) {
  const [val, setVal] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && val) onConfirm(Number(val));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onConfirm, val]);

  const isDmg = type === "damage";
  const accentColor = isDmg ? "#c06060" : (pal?.gem || "#7ec8a4");

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: pal?.surfaceSolid || "#111e2c",
        border: `1px solid ${accentColor}44`,
        borderRadius: 6,
        padding: "28px 28px 24px",
        width: "100%",
        maxWidth: 340,
      }}>
        <div style={{
          fontFamily: pal?.fontUI || "IM Fell English",
          fontSize: 11,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: accentColor,
          marginBottom: 16,
        }}>
          {isDmg ? "Deal Damage" : "Heal"}
        </div>
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${accentColor}66`,
            borderRadius: 3,
            color: pal?.text || "#c8d8e4",
            fontFamily: pal?.fontDisplay || "Cinzel",
            fontSize: 32,
            padding: "8px 12px",
            textAlign: "center",
            outline: "none",
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${pal?.border || "rgba(106,143,168,0.18)"}`,
              borderRadius: 3,
              color: pal?.textMuted || "#3a5a6a",
              fontFamily: pal?.fontUI || "IM Fell English",
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >Cancel</button>
          <button
            onClick={() => val && onConfirm(Number(val))}
            disabled={!val || isNaN(Number(val))}
            style={{
              background: "transparent",
              border: `1px solid ${accentColor}`,
              borderRadius: 3,
              color: accentColor,
              fontFamily: pal?.fontUI || "IM Fell English",
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "8px 16px",
              cursor: "pointer",
              opacity: (!val || isNaN(Number(val))) ? 0.5 : 1,
            }}
          >{isDmg ? "Apply Damage" : "Apply Heal"}</button>
        </div>
      </div>
    </div>
  );
}

// ConditionPickerModal — 14-condition grid
function ConditionPickerModal({ activeConditions, onSave, onClose, pal }) {
  const [selected, setSelected] = useState(new Set(activeConditions || []));

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(cond) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cond)) next.delete(cond);
      else next.add(cond);
      return next;
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: pal?.surfaceSolid || "#111e2c",
        border: `1px solid ${pal?.border || "rgba(106,143,168,0.18)"}`,
        borderRadius: 6,
        padding: "24px 24px 20px",
        width: "100%",
        maxWidth: 440,
      }}>
        <div style={{
          fontFamily: pal?.fontUI,
          fontSize: 11,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: pal?.textMuted,
          marginBottom: 16,
        }}>Conditions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {CONDITIONS.map((cond) => {
            const isActive = selected.has(cond);
            return (
              <button
                key={cond}
                onClick={() => toggle(cond)}
                style={{
                  background: isActive ? `${pal?.accentDim}` : "transparent",
                  border: `1px solid ${isActive ? pal?.accent : pal?.border}`,
                  borderRadius: 14,
                  color: isActive ? pal?.accentBright : pal?.textMuted,
                  fontFamily: pal?.fontUI,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "4px 12px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >{cond}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${pal?.border}`,
              borderRadius: 3,
              color: pal?.textMuted,
              fontFamily: pal?.fontUI,
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >Cancel</button>
          <button
            onClick={() => onSave([...selected])}
            style={{
              background: "transparent",
              border: `1px solid ${pal?.accent}`,
              borderRadius: 3,
              color: pal?.accentBright,
              fontFamily: pal?.fontUI,
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >Save</button>
        </div>
      </div>
    </div>
  );
}

export default function CharacterSheetSessionMode({
  initialData,
  slug,
  mode,
  setMode,
  // onSave and onDelete reserved for Story 28 (in-session profile editing)
  onSessionSync,
  activeMap,
  // activeMapView reserved for map scroll/zoom restoration
  partyStatus,
  initiativeData,
}) {
  const navigate = useNavigate();
  const [char, setChar] = useState(initialData);

  // Keep char in sync when initialData changes (polling)
  useEffect(() => {
    setChar(initialData);
  }, [initialData]);

  const pal = PALETTES[char?.palette] || PALETTES.ember;

  // ── Local HP state for optimistic updates ─────────────────────────────────
  const [localHp, setLocalHp] = useState(char?.hpCurrent ?? 0);
  const hpServerRef = useRef(char?.hpCurrent ?? 0);
  const hpFlushRef = useRef(null);
  const [hpFlash, setHpFlash] = useState(null); // "dmg" | "heal" | null

  useEffect(() => {
    const incoming = initialData?.hpCurrent ?? 0;
    hpServerRef.current = incoming;
    setLocalHp(incoming);
  }, [initialData?.hpCurrent]);

  const flushHp = useCallback(async (targetHp) => {
    try {
      await patchSession(slug, { hpCurrent: targetHp }, null);
      hpServerRef.current = targetHp;
      onSessionSync?.();
    } catch {
      setLocalHp(hpServerRef.current);
    }
  }, [slug, onSessionSync]);

  const changeHp = useCallback((delta) => {
    setLocalHp((prev) => {
      const next = Math.max(0, prev + delta);
      clearTimeout(hpFlushRef.current);
      hpFlushRef.current = setTimeout(() => flushHp(next), 300);
      setHpFlash(delta < 0 ? "dmg" : "heal");
      setTimeout(() => setHpFlash(null), 400);
      return next;
    });
  }, [flushHp]);

  // ── HP modal ──────────────────────────────────────────────────────────────
  const [hpModal, setHpModal] = useState(null); // "damage" | "heal" | null

  const applyDamageHeal = useCallback(async (type, amount) => {
    const hpMax = char?.hpMax ?? 0;
    const next = type === "damage"
      ? Math.max(0, localHp - amount)
      : Math.min(hpMax, localHp + amount);
    setLocalHp(next);
    setHpFlash(type === "damage" ? "dmg" : "heal");
    setTimeout(() => setHpFlash(null), 400);
    setHpModal(null);
    try {
      await patchSession(slug, { hpCurrent: next }, null);
      hpServerRef.current = next;
      onSessionSync?.();
    } catch {
      setLocalHp(hpServerRef.current);
    }
  }, [char, localHp, slug, onSessionSync]);

  // ── Condition manager ─────────────────────────────────────────────────────
  const [condPickerOpen, setCondPickerOpen] = useState(false);

  const saveConditions = useCallback(async (conditions) => {
    setChar((prev) => ({ ...prev, conditions }));
    setCondPickerOpen(false);
    try {
      await patchSession(slug, { conditions }, null);
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, conditions: initialData?.conditions || [] }));
    }
  }, [slug, onSessionSync, initialData?.conditions]);

  // ── Concentration ─────────────────────────────────────────────────────────
  const [concInput, setConcInput] = useState("");
  const [concInputOpen, setConcInputOpen] = useState(false);

  const dropConcentration = useCallback(async () => {
    setChar((prev) => ({ ...prev, concentration: { active: false, spell: "" } }));
    try {
      await patchSession(slug, { concentration: { active: false, spell: "" } }, null);
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, concentration: initialData?.concentration }));
    }
  }, [slug, onSessionSync, initialData?.concentration]);

  const setConcentration = useCallback(async (spell) => {
    const conc = { active: true, spell };
    setChar((prev) => ({ ...prev, concentration: conc }));
    setConcInput("");
    setConcInputOpen(false);
    try {
      await patchSession(slug, { concentration: conc }, null);
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, concentration: initialData?.concentration }));
    }
  }, [slug, onSessionSync, initialData?.concentration]);

  // ── Inspiration ───────────────────────────────────────────────────────────
  const toggleInspiration = useCallback(async () => {
    const next = !char.inspiration;
    setChar((prev) => ({ ...prev, inspiration: next }));
    try {
      await patchSession(slug, { inspiration: next }, null);
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, inspiration: !next }));
    }
  }, [char, slug, onSessionSync]);

  // ── Session sub-tab state ─────────────────────────────────────────────────
  const storedSubtab = sessionStorage.getItem(`dnd_session_subtab_${slug}`) || "combat";
  const [sessionSubTab, setSessionSubTabState] = useState(storedSubtab);
  const setSessionSubTab = useCallback((tab) => {
    setSessionSubTabState(tab);
    sessionStorage.setItem(`dnd_session_subtab_${slug}`, tab);
  }, [slug]);

  // ── Initiative collapse (mobile) ──────────────────────────────────────────
  const [initExpanded, setInitExpanded] = useState(false);

  // ── Weapon expand state ───────────────────────────────────────────────────
  const [expandedWeapons, setExpandedWeapons] = useState(new Set());
  const toggleWeapon = (id) => setExpandedWeapons((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ── Derived values ────────────────────────────────────────────────────────
  const hpMax = char?.hpMax ?? 0;
  const hpPct = hpMax > 0 ? Math.min(100, (localHp / hpMax) * 100) : 0;
  const activeConditions = char?.conditions || [];
  const concentration = char?.concentration || { active: false, spell: "" };
  const spellSlots = char?.spellSlots || [];
  const weapons = char?.weapons || [];
  const equipment = char?.equipment || [];
  const stats = char?.stats || [];

  // Ability modifiers
  const abilityMods = stats.map((s) => ({
    name: s.stat,
    abbr: STAT_ABBR[s.stat] || s.stat.slice(0, 3).toUpperCase(),
    mod: computeMod(s, weapons, equipment),
  }));

  // AC and Speed from item mods
  const acBonus = [...weapons, ...equipment]
    .filter((i) => i.equipped !== false)
    .flatMap((i) => i.mods || [])
    .filter((m) => m.attribute === "Armor")
    .reduce((acc, m) => acc + (m.value || 0), 0);
  const speedBonus = [...weapons, ...equipment]
    .filter((i) => i.equipped !== false)
    .flatMap((i) => i.mods || [])
    .filter((m) => m.attribute === "Speed")
    .reduce((acc, m) => acc + (m.value || 0), 0);
  const acTotal = (char?.armorTotal || 0) + acBonus;

  // Initiative entries
  const entries = initiativeData?.entries || [];
  const activeTurnIndex = initiativeData?.activeTurnIndex ?? 0;
  const round = initiativeData?.round ?? 1;
  const hasInitiative = entries.length > 0;

  // Determine if it's our turn
  const activeEntry = entries[activeTurnIndex] ?? null;
  const isOurTurn = activeEntry?.slug === slug;

  // Party strip (filter out self)
  const partyMembers = (partyStatus?.members || []).filter((m) => m.slug !== slug);
  const partyVisible = partyStatus?.visible !== false;

  // Auto-expand dice roller on first session mode entry
  useEffect(() => {
    if (mode === "session") {
      const key = `dnd_dice_open_${slug}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "true");
      }
    }
  }, [mode, slug]);

  // ── Profile mode: redirect to the plain CharacterSheet ───────────────────
  if (mode === "profile") {
    return (
      <div
        style={{
          "--pal-bg": pal.bg,
          "--pal-surface": pal.surface,
          "--pal-surface-solid": pal.surfaceSolid,
          "--pal-border": pal.border,
          "--pal-accent": pal.accent,
          "--pal-accent-bright": pal.accentBright,
          "--pal-accent-dim": pal.accentDim,
          "--pal-text": pal.text,
          "--pal-text-body": pal.textBody,
          "--pal-text-muted": pal.textMuted,
          "--pal-gem": pal.gem,
          "--pal-gem-low": pal.gemLow,
          "--font-display": pal.fontDisplay,
          "--font-body": pal.fontBody,
          "--font-ui": pal.fontUI,
          minHeight: "100vh",
          background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%),
                       ${pal.bg}`,
        }}
        className="cs-session-root"
      >
        {/* Top bar */}
        <div className="cs-session-topbar">
          <a
            href="/"
            style={{
              fontFamily: pal.fontUI,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: pal.textMuted,
              textDecoration: "none",
            }}
          >← All Characters</a>
          <span className="cs-session-topbar-title">{char?.name}</span>
          <ModToggle mode={mode} setMode={setMode} pal={pal} />
        </div>

        {/* Mobile mode toggle row */}
        <div className="cs-mobile-mode-row">
          <div className="cs-mode-toggle" style={{ width: "100%" }}>
            <ModSegment label="Profile" glyph="❡" mode={mode} value="profile" setMode={setMode} pal={pal} />
            <ModSegment label="Session" glyph="⚔" mode={mode} value="session" setMode={setMode} pal={pal} />
          </div>
        </div>

        {/* Profile content — link to the classic character page */}
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "40px 28px 80px" }}>
          <div className="cs-sm-profile-placeholder">
            <p className="cs-sm-profile-note">
              Profile mode shows the full character sheet.
            </p>
            <button
              onClick={() => navigate(`/characters/${slug}`)}
              style={{
                background: "transparent",
                border: `1px solid ${pal.accent}`,
                borderRadius: 3,
                color: pal.accentBright,
                fontFamily: pal.fontUI,
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                padding: "9px 20px",
                cursor: "pointer",
              }}
            >Open Full Character Sheet</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Session mode ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        "--pal-bg": pal.bg,
        "--pal-surface": pal.surface,
        "--pal-surface-solid": pal.surfaceSolid,
        "--pal-border": pal.border,
        "--pal-accent": pal.accent,
        "--pal-accent-bright": pal.accentBright,
        "--pal-accent-dim": pal.accentDim,
        "--pal-text": pal.text,
        "--pal-text-body": pal.textBody,
        "--pal-text-muted": pal.textMuted,
        "--pal-gem": pal.gem,
        "--pal-gem-low": pal.gemLow,
        "--font-display": pal.fontDisplay,
        "--font-body": pal.fontBody,
        "--font-ui": pal.fontUI,
        minHeight: "100vh",
        background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%),
                     radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%),
                     ${pal.bg}`,
      }}
      className="cs-session-root"
    >
      {/* ── Top bar ── */}
      <div className="cs-session-topbar">
        <a
          href="/"
          style={{
            fontFamily: pal.fontUI,
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: pal.textMuted,
            textDecoration: "none",
          }}
        >← All Characters</a>
        <span className="cs-session-topbar-title">{char?.name}</span>
        {/* Desktop mode toggle in topbar */}
        <div className="cs-session-mode-header" style={{ display: undefined }}>
          <ModToggle mode={mode} setMode={setMode} pal={pal} />
        </div>
      </div>

      {/* Mobile mode toggle (sticky, below topbar) */}
      <div className="cs-mobile-mode-row">
        <div className="cs-mode-toggle" style={{ width: "100%" }}>
          <ModSegment label="Profile" glyph="❡" mode={mode} value="profile" setMode={setMode} pal={pal} />
          <ModSegment label="Session" glyph="⚔" mode={mode} value="session" setMode={setMode} pal={pal} />
        </div>
      </div>

      {/* ── Two-column shell ── */}
      <div className="cs-session-shell">

        {/* ════════════ LEFT COLUMN ════════════ */}
        <div className="cs-session-left">

          {/* Desktop mode toggle at top of left column */}
          <div style={{ display: "none" }} className="cs-session-mode-header-left">
            <ModToggle mode={mode} setMode={setMode} pal={pal} />
          </div>

          {/* Identity strip */}
          <div className="cs-sm-identity">
            <div
              className={`cs-sm-portrait${isOurTurn ? " own-turn" : ""}`}
              style={{ background: pal.accentDim, borderColor: `${pal.accent}55` }}
            >
              {char?.portraitUrl
                ? <img src={char.portraitUrl} alt={char.name} />
                : avatarInitial(char?.name)
              }
            </div>
            <div className="cs-sm-identity-info">
              <span className="cs-sm-identity-name" style={{ color: pal.accentBright }}>
                {char?.name}
              </span>
              <span className="cs-sm-identity-sub">
                {[char?.charClass, char?.subclass].filter(Boolean).join(" · ")}
                {char?.level ? ` · Level ${char.level}` : ""}
              </span>
              <div className="cs-sm-identity-badges">
                {acTotal > 0 && (
                  <span className="cs-sm-badge">AC {acTotal}</span>
                )}
                {speedBonus !== 0 && (
                  <span className="cs-sm-badge">Spd {30 + speedBonus}</span>
                )}
                {char?.inspiration && (
                  <span className="cs-sm-badge" style={{ borderColor: `${pal.gem}44`, color: pal.gem }}>
                    ◆ Inspired
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ability modifier chips */}
          <hr className="cs-sm-rule" />
          <span className="cs-sm-label">Abilities</span>
          <div className="cs-sm-ability-grid">
            {abilityMods.map((a) => (
              <div key={a.name} className="cs-sm-ability-chip">
                <span className="cs-sm-ability-mod" style={{ color: pal.gem }}>
                  {fmtMod(a.mod)}
                </span>
                <span className="cs-sm-ability-name">{a.abbr}</span>
              </div>
            ))}
          </div>

          {/* Initiative strip */}
          <hr className="cs-sm-rule" />
          <div className="cs-sm-init-header">
            <span className="cs-sm-label" style={{ marginBottom: 0 }}>Initiative</span>
            {hasInitiative && (
              <span className="cs-sm-init-round" style={{ color: pal.accentBright }}>
                Round {round}
              </span>
            )}
          </div>

          {/* Mobile collapsed line */}
          {hasInitiative && (
            <div className="cs-sm-init-collapsed">
              <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.12em", color: pal.accentBright }}>
                R{round}{activeEntry ? ` · ${activeEntry.name}` : ""}
                {isOurTurn ? " · YOUR TURN" : ""}
              </span>
              <button
                className="cs-sm-init-expand-btn"
                onClick={() => setInitExpanded((v) => !v)}
              >
                <span style={{ color: pal.textMuted }}>Show order</span>
                <span className={`cs-sm-init-expand-arrow${initExpanded ? " open" : ""}`}>▼</span>
              </button>
            </div>
          )}

          {/* Initiative list */}
          <div className={`cs-sm-init-expandable${!initExpanded ? " collapsed" : ""}`}>
            <div className="cs-sm-init-list">
              {!hasInitiative ? (
                <span className="cs-sm-init-empty">No initiative set.</span>
              ) : (
                entries.map((entry, idx) => {
                  const isActive = idx === activeTurnIndex;
                  const isSelf = entry.slug === slug;
                  const healthTier = entry.healthTier;
                  let rowClass = "cs-sm-init-row";
                  if (isActive) rowClass += " active";
                  if (healthTier === "wounded") rowClass += " bloodied";
                  if (healthTier === "critical" || healthTier === "down") rowClass += " neardeath";

                  // Palette accent for this PC entry
                  const entryPalette = entry.palette ? (PALETTES[entry.palette] || null) : null;
                  const nameColor = isSelf
                    ? pal.accentBright
                    : entryPalette
                    ? entryPalette.accent
                    : pal.textBody;

                  return (
                    <div key={entry.id || idx} className={rowClass}>
                      {isActive ? (
                        <span className="cs-sm-init-arrow">▸</span>
                      ) : (
                        <span style={{ width: 10, flexShrink: 0 }} />
                      )}
                      {entry.type === "pc" && entryPalette && (
                        <span
                          className="cs-sm-init-dot"
                          style={{ background: entryPalette.accent, flexShrink: 0 }}
                        />
                      )}
                      <span
                        className={`cs-sm-init-name${isSelf ? " self" : ""}`}
                        style={{ color: nameColor }}
                      >
                        {entry.name}
                      </span>
                      {isActive && isSelf && (
                        <span className="cs-sm-your-turn">Your Turn</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Party status strip */}
          <hr className="cs-sm-rule" />
          <span className="cs-sm-label">Party</span>

          {!partyVisible ? (
            <p className="cs-sm-party-hidden">Party status hidden by DM.</p>
          ) : partyMembers.length === 0 ? (
            <p className="cs-sm-party-empty">Solo adventure — no other party members.</p>
          ) : (
            <div className="cs-sm-party-list">
              {partyMembers.map((member) => {
                const memberPal = member.palette ? (PALETTES[member.palette] || null) : null;
                const memberAccent = memberPal?.accent || pal.accent;
                const memberHpPct = member.hpMax > 0
                  ? Math.min(100, (member.hpCurrent / member.hpMax) * 100)
                  : 0;
                const isActive = entries[activeTurnIndex]?.slug === member.slug;
                const rowCls = `cs-sm-party-row${partyRowClass(member) ? ` ${partyRowClass(member)}` : ""}`;
                const hpNumCls = `cs-sm-party-hp-nums${member.hpMax > 0 && member.hpCurrent / member.hpMax <= 0.2 ? " critical" : ""}`;
                const hpBarCls = hpBarColor(member.hpCurrent, member.hpMax);
                const deathFallen = (member.deathSaves?.failures >= 3);

                return (
                  <div
                    key={member.slug}
                    className={rowCls}
                    style={{
                      "--cs-party-accent": memberAccent,
                    }}
                  >
                    <div
                      className={`cs-sm-party-avatar${isActive ? " active-turn" : " resting"}`}
                      style={{
                        background: memberPal?.accentDim || pal.accentDim,
                        borderColor: `${memberAccent}44`,
                      }}
                    >
                      {member.portraitUrl
                        ? <img src={member.portraitUrl} alt={member.name} />
                        : avatarInitial(member.name)
                      }
                    </div>
                    <div className="cs-sm-party-info">
                      <span className="cs-sm-party-name" style={{ color: memberAccent }}>
                        {member.name}
                      </span>
                      {member.hpCurrent <= 0 ? (
                        <div className="cs-sm-party-down-label">
                          {deathFallen ? "FALLEN" : "DOWN"}
                        </div>
                      ) : (
                        <div className="cs-sm-party-hp-row">
                          <span className={hpNumCls}>
                            {member.hpCurrent}/{member.hpMax}
                          </span>
                          <div className="cs-sm-party-hp-bar">
                            <div
                              className={`cs-sm-party-hp-fill ${hpBarCls}`}
                              style={{ width: `${memberHpPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {member.conditions?.length > 0 && (
                        <div className="cs-sm-party-conditions">
                          {member.conditions.slice(0, 2).map((c) => (
                            <span key={c} className="cs-sm-party-cond-chip">{c}</span>
                          ))}
                          {member.conditions.length > 2 && (
                            <span className="cs-sm-party-cond-chip">+{member.conditions.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
        {/* ════════════ END LEFT COLUMN ════════════ */}

        {/* ════════════ RIGHT COLUMN ════════════ */}
        <div className="cs-session-right">

          {/* Concentration banner */}
          {concentration.active ? (
            <div className="cs-sm-conc-banner">
              <div className="cs-sm-conc-dot" />
              <span className="cs-sm-conc-text">
                Concentrating: <strong>{concentration.spell}</strong>
              </span>
              <button className="cs-sm-conc-drop" onClick={dropConcentration}>Drop</button>
            </div>
          ) : concInputOpen ? (
            <div className="cs-sm-conc-input-row">
              <input
                type="text"
                value={concInput}
                onChange={(e) => setConcInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && concInput.trim()) setConcentration(concInput.trim());
                  if (e.key === "Escape") { setConcInputOpen(false); setConcInput(""); }
                }}
                placeholder="Spell name…"
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.25)",
                  border: `1px solid ${pal.border}`,
                  borderRadius: 3,
                  color: pal.text,
                  fontFamily: pal.fontBody,
                  fontSize: 15,
                  padding: "6px 10px",
                  outline: "none",
                }}
                autoFocus
              />
              <button
                onClick={() => concInput.trim() && setConcentration(concInput.trim())}
                style={{
                  background: pal.accentDim,
                  border: `1px solid ${pal.accent}`,
                  borderRadius: 3,
                  color: pal.accentBright,
                  fontFamily: pal.fontUI,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >Set</button>
              <button
                onClick={() => { setConcInputOpen(false); setConcInput(""); }}
                style={{
                  background: "transparent",
                  border: `1px solid ${pal.border}`,
                  borderRadius: 3,
                  color: pal.textMuted,
                  fontFamily: pal.fontUI,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >Cancel</button>
            </div>
          ) : (
            <button
              className="cs-sm-conc-add-btn"
              onClick={() => setConcInputOpen(true)}
            >+ Concentration</button>
          )}

          {/* HP hero card */}
          <div className={`cs-sm-hp-hero${localHp <= 0 ? " death" : hpFlash === "dmg" ? " flash-dmg" : hpFlash === "heal" ? " flash-heal" : ""}`}>
            <div className="cs-sm-hp-nums-row">
              {localHp <= 0 ? (
                <span className="cs-sm-hp-unconscious">Unconscious</span>
              ) : (
                <>
                  <span className={`cs-sm-hp-current ${hpNumClass(localHp, hpMax)}`}>{localHp}</span>
                  <span className="cs-sm-hp-sep">/</span>
                  <span className="cs-sm-hp-max">{hpMax}</span>
                  {(char?.tempHP || 0) > 0 && (
                    <span className="cs-sm-hp-temp">+{char.tempHP} temp</span>
                  )}
                </>
              )}
            </div>
            <div className="cs-sm-hp-bar-wrap">
              <div
                className={`cs-sm-hp-bar-fill ${hpBarColor(localHp, hpMax)}`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <div className="cs-sm-hp-controls">
              <button
                className="cs-sm-hp-stepper"
                onClick={() => changeHp(-1)}
                aria-label="Minus 1 HP"
              >−</button>
              <button
                className="cs-sm-hp-stepper"
                onClick={() => changeHp(1)}
                aria-label="Plus 1 HP"
              >+</button>
              <span className="cs-sm-hp-spacer" />
              <button
                className="cs-sm-hp-action-btn dmg"
                onClick={() => setHpModal("damage")}
              >⚔ Damage</button>
              <button
                className="cs-sm-hp-action-btn heal"
                onClick={() => setHpModal("heal")}
              >✦ Heal</button>
            </div>
          </div>

          {/* Conditions */}
          <hr className="cs-sm-rule" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="cs-sm-label" style={{ marginBottom: 0 }}>Conditions</span>
            <button className="cs-sm-cond-manage-btn" onClick={() => setCondPickerOpen(true)}>
              ✎ Manage
            </button>
          </div>
          <div className="cs-sm-conditions-row">
            {activeConditions.length === 0 ? (
              <span className="cs-sm-cond-none">None</span>
            ) : (
              activeConditions.map((c) => (
                <span key={c} className="cs-sm-cond-chip">{c}</span>
              ))
            )}
          </div>

          {/* Spell slots */}
          {spellSlots.length > 0 && (
            <>
              <hr className="cs-sm-rule" />
              <span className="cs-sm-label">Spell Slots</span>
              <div className="cs-sm-slots-wrap">
                {spellSlots.map((slot, i) => {
                  const available = slot.max - (slot.used || 0);
                  return (
                    <div key={i} className="cs-sm-slot-group">
                      <span className="cs-sm-slot-lbl">L{slot.level}</span>
                      {Array.from({ length: slot.max }).map((_, pipIdx) => (
                        <div
                          key={pipIdx}
                          className="cs-sm-slot-pip"
                          style={{
                            borderColor: pipIdx < available ? pal.gem : pal.border,
                            background: pipIdx < available ? pal.gem : "transparent",
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Inspiration */}
          <hr className="cs-sm-rule" />
          <div className="cs-sm-inspo-row">
            <button className="cs-sm-inspo-toggle" onClick={toggleInspiration}>
              <div className={`cs-sm-inspo-gem${char?.inspiration ? " active" : ""}`} />
              <span className={`cs-sm-inspo-label${char?.inspiration ? " active" : ""}`}>
                Inspiration
              </span>
            </button>
          </div>

          {/* Session sub-tabs */}
          <hr className="cs-sm-rule" />
          <div className="cs-sm-tabs">
            {[
              { key: "combat", label: "Combat" },
              { key: "loadout", label: "Loadout" },
              { key: "map", label: "Map", disabled: !activeMap },
              { key: "notes", label: "Notes" },
            ].map(({ key, label, disabled }) => (
              <button
                key={key}
                className={`cs-sm-tab${sessionSubTab === key ? " active" : ""}${disabled ? " disabled" : ""}`}
                onClick={() => !disabled && setSessionSubTab(key)}
              >{label}</button>
            ))}
          </div>

          {/* ── COMBAT sub-tab (read-only weapon quick-ref) ── */}
          <div className={`cs-sm-tab-panel${sessionSubTab === "combat" ? " active" : ""}`}>
            {weapons.length === 0 ? (
              <p className="cs-sm-combat-empty">No weapons configured. Go to Profile mode to add weapons.</p>
            ) : (
              weapons.map((w) => {
                const meta = weaponMeta(w);
                const expanded = expandedWeapons.has(w.id);
                return (
                  <div key={w.id}>
                    <div className="cs-sm-weapon-row">
                      <span className="cs-sm-weapon-name">{w.name}</span>
                      {meta && (
                        <span className="cs-sm-weapon-meta">{meta}</span>
                      )}
                      {w.description && (
                        <button
                          className={`cs-sm-weapon-expand${expanded ? " open" : ""}`}
                          onClick={() => toggleWeapon(w.id)}
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >▼</button>
                      )}
                    </div>
                    {expanded && w.description && (
                      <div className="cs-sm-weapon-desc">{w.description}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── LOADOUT sub-tab ── */}
          <div className={`cs-sm-tab-panel${sessionSubTab === "loadout" ? " active" : ""}`}>
            {/* Two-column grid identical to Inventory tab */}
            <div className="cs-sm-loadout-grid">
              {/* Weapons column */}
              <div>
                <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 8 }}>
                  Weapons
                </div>
                {weapons.map((w) => {
                  const isEquipped = w.equipped !== false;
                  return (
                    <div
                      key={w.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 0",
                        borderBottom: `1px solid ${pal.border}`,
                      }}
                    >
                      <span style={{
                        flex: 1,
                        fontFamily: pal.fontBody,
                        fontSize: 15,
                        color: isEquipped ? pal.text : pal.textMuted,
                      }}>{w.name}</span>
                      {w.requiresAttunement && (
                        <span style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: w.attuned ? pal.gem : "transparent",
                          border: `1.5px solid ${w.attuned ? pal.gem : pal.border}`,
                          flexShrink: 0,
                        }} />
                      )}
                    </div>
                  );
                })}
                {weapons.length === 0 && (
                  <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>
                    No weapons
                  </span>
                )}
              </div>

              {/* Equipment column */}
              <div>
                <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 8 }}>
                  Equipment
                </div>
                {equipment.map((e) => {
                  const isEquipped = e.equipped !== false;
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 0",
                        borderBottom: `1px solid ${pal.border}`,
                      }}
                    >
                      <span style={{
                        flex: 1,
                        fontFamily: pal.fontBody,
                        fontSize: 15,
                        color: isEquipped ? pal.text : pal.textMuted,
                      }}>{e.name}</span>
                      {e.qty != null && (
                        <span style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted }}>
                          ×{e.qty}
                        </span>
                      )}
                    </div>
                  );
                })}
                {equipment.length === 0 && (
                  <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>
                    No equipment
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── MAP sub-tab ── */}
          <div className={`cs-sm-tab-panel${sessionSubTab === "map" ? " active" : ""}`}>
            {activeMap ? (
              <MapViewer
                imageUrl={activeMap.imageUrl}
                name={activeMap.name}
                height={480}
                pal={pal}
              />
            ) : (
              <p className="cs-sm-map-empty">The DM hasn{"'"}t loaded a map yet.</p>
            )}
          </div>

          {/* ── NOTES sub-tab ── */}
          <div className={`cs-sm-tab-panel${sessionSubTab === "notes" ? " active" : ""}`}>
            <SessionNotesSection char={char} slug={slug} pal={pal} onSessionSync={onSessionSync} />
          </div>

          {/* Dice roller */}
          <DiceRoller
            weapons={weapons}
            stats={stats}
            pal={pal}
            slug={slug}
          />

        </div>
        {/* ════════════ END RIGHT COLUMN ════════════ */}

      </div>
      {/* ── end two-column shell ── */}

      {/* Modals */}
      {hpModal && (
        <DamageHealModal
          type={hpModal}
          pal={pal}
          onConfirm={(amount) => applyDamageHeal(hpModal, amount)}
          onClose={() => setHpModal(null)}
        />
      )}

      {condPickerOpen && (
        <ConditionPickerModal
          activeConditions={activeConditions}
          pal={pal}
          onSave={saveConditions}
          onClose={() => setCondPickerOpen(false)}
        />
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModToggle({ mode, setMode, pal }) {
  return (
    <div className="cs-mode-toggle">
      <ModSegment label="Profile" glyph="❡" mode={mode} value="profile" setMode={setMode} pal={pal} />
      <ModSegment label="Session" glyph="⚔" mode={mode} value="session" setMode={setMode} pal={pal} />
    </div>
  );
}

function ModSegment({ label, glyph, mode, value, setMode }) {
  const isActive = mode === value;
  return (
    <button
      className={`cs-mode-seg${isActive ? " active" : ""}`}
      onClick={() => setMode(value)}
      aria-pressed={isActive}
    >
      {glyph} {label}
    </button>
  );
}

// Session notes section (read/write without auth via patchSession)
function SessionNotesSection({ char, slug, pal, onSessionSync }) {
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const notes = char?.playerNotes || [];

  async function addNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    const next = [
      ...notes,
      { id: "n" + Date.now(), text: newNote.trim(), sharedWithDm: false, createdAt: new Date().toISOString() },
    ];
    try {
      await patchSession(slug, { playerNotes: next }, null);
      onSessionSync?.();
      setNewNote("");
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div>
      {notes.length === 0 ? (
        <p className="cs-sm-notes-empty">No session notes yet.</p>
      ) : (
        notes.map((note) => (
          <div key={note.id} className="cs-sm-notes-row">
            <div className="cs-sm-note-text">{note.text}</div>
            {note.sharedWithDm && (
              <span className="cs-sm-note-meta">Shared with DM</span>
            )}
          </div>
        ))
      )}
      <div className="cs-sm-note-input-row">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
          placeholder="Add a session note…"
          style={{
            flex: 1,
            background: "rgba(0,0,0,0.25)",
            border: `1px solid ${pal.border}`,
            borderRadius: 3,
            color: pal.text,
            fontFamily: pal.fontBody,
            fontSize: 15,
            padding: "6px 10px",
            outline: "none",
          }}
        />
        <button
          onClick={addNote}
          disabled={saving || !newNote.trim()}
          style={{
            background: "transparent",
            border: `1px solid ${pal.accent}`,
            borderRadius: 3,
            color: pal.accentBright,
            fontFamily: pal.fontUI,
            fontSize: 11,
            letterSpacing: "0.1em",
            padding: "6px 12px",
            cursor: "pointer",
            opacity: (!newNote.trim() || saving) ? 0.5 : 1,
          }}
        >Add</button>
      </div>
    </div>
  );
}
