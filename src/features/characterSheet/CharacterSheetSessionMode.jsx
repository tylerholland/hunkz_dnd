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
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { PALETTES } from "./theme";
import { fmtMod, CONDITIONS, normalizeSpells, buildAttackEntries, buildUnarmedStrike, spellRoleGlyph, applyLongRest, applyShortRest } from "./constants";
import CharacterTalents from "./CharacterTalents";
import { patchSession, postCharacterRoll, moveMapToken } from "../../api";
import { clearExpectedFields, isFieldPending, markExpectedFields, mergeOptimisticLiveFields } from "../../lib/liveSync";
import DiceRoller from "../../components/DiceRoller";
import TopNav, { NavSegment } from "../../components/TopNav";
import MapViewer from "../maps/MapViewer";
import WorldGuideDrawer from "../worldGuide/WorldGuideDrawer";
import { TokenChip } from "../dmDashboard/battleMode/BattleModeController";
import ConditionGlyphSprite from "../dmDashboard/battleMode/ConditionGlyphSprite";
import CombatFxLayer from "../maps/combatFx/CombatFxLayer";
import { buildStrikeEvents, collectTokenHits } from "../maps/combatFx/strikeEvents";
import {
  resolveDamageState,
  assignAoEStagger,
  resolveCondBand,
  computeEffectivePx,
  useDebouncedValue,
  usePrefersReducedMotion,
  shimmerPhaseOffsetMs,
  useTokenExitGhosts,
} from "../dmDashboard/battleMode/tokenEffects";
import CombatTransitionOverlay from "./CombatTransitionOverlay";
import { playCombatEnterSound, playCombatExitSound } from "../../lib/combatSound";
import { useTextScale, PLAYER_TEXT_SCALE_KEY } from "../../lib/useTextScale";
import AttackDeclarationBar from "./AttackDeclarationBar";
import ItemEditorModal from "./ItemEditorModal";
import SessionQuickAdd from "./SessionQuickAdd";
import SessionLoadoutRow from "./SessionLoadoutRow";
import SessionLedger from "./SessionLedger";
import { applyDelta, normalizeCoin } from "./sessionLoadout";
import { abilityModifier } from "../dmDashboard/cardStats";
import { abilityCheckExpr, DEFAULT_HOUSE_RULES } from "../../lib/houseRules";
import { resolveMapBandOpen } from "./sessionMapBand";
import RollOverlay from "../../components/RollOverlay";
import "../dmDashboard/battleMode.css";
import "./characterSheet.css";

// Story 57 — is a spell's slot at `level` exhausted? Cantrips (level 0) and
// spells with no authored level (unspecified — never coerced from an empty
// input via `|| 0`, ADR-025) are always available. A level with no tracked
// slots at all (max === 0 / no entries) fails OPEN — same "don't assert
// something you can't verify" posture as the rest of the app's
// invisible/hidden derivations.
function isSpellSlotSpent(level, spellSlots) {
  if (!Number.isFinite(level) || level <= 0) return false;
  const relevant = (spellSlots || []).filter((s) => s.level === level && (s.max || 0) > 0);
  if (relevant.length === 0) return false;
  return relevant.every((s) => (s.used || 0) >= s.max);
}

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

// Fields Session mode writes live (mirrors backend session.js SESSION_FIELDS).
const SESSION_LIVE_FIELDS = [
  "hpCurrent", "tempHP", "spellSlots", "conditions", "exhaustionLevel", "concentration", "inspiration",
  "weapons", "equipment", "playerNotes", "hitDiceCurrent", "xpCurrent", "coin", "deathSaves",
];

function avatarInitial(name) {
  return (name || "?")[0].toUpperCase();
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
          fontFamily: pal?.fontUI || "'Cinzel Numerals', 'IM Fell English', Georgia, serif",
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
            background: pal?.surfaceSolid || "#111e2c",
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
              fontFamily: pal?.fontUI || "'Cinzel Numerals', 'IM Fell English', Georgia, serif",
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
              fontFamily: pal?.fontUI || "'Cinzel Numerals', 'IM Fell English', Georgia, serif",
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
  activeMapView,
  isBattleMode,
  sessionPassword,
  partyStatus,
  initiativeData,
  npcCombat,
  wsConnected,
  // Stories 52–54 — GET /session-state's serverTime for damage/condition age
  // arithmetic (see PlayerMapViewer).
  serverTime,
  // DM Settings house rules (GET /session-state) — e.g. ability-check dice.
  houseRules,
  // Shared roll feed — lets the map's combat FX match a hit to its declared attack.
  rollHistory,
}) {
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);
  const [char, setChar] = useState(initialData);

  // Pending-write guard: every session write records the value it expects
  // (patchLive below); incoming polls leave those fields alone until the
  // server echoes them or the expectation expires — so a poll that was
  // already in flight can't snap an instant update back.
  const expectedRef = useRef(new Map());
  const patchLive = useCallback(async (fields) => {
    markExpectedFields(expectedRef, fields);
    try {
      return await patchSession(slug, fields, sessionPassword);
    } catch (err) {
      clearExpectedFields(expectedRef, Object.keys(fields));
      throw err;
    }
  }, [slug, sessionPassword]);

  // Keep char in sync when initialData changes (polling), minus pending fields
  useEffect(() => {
    setChar((prev) => (prev ? mergeOptimisticLiveFields(prev, initialData, SESSION_LIVE_FIELDS, expectedRef) : initialData));
  }, [initialData]);

  const pal = PALETTES[char?.palette] || PALETTES.ember;

  // ── Local HP state for optimistic updates ─────────────────────────────────
  const [localHp, setLocalHp] = useState(char?.hpCurrent ?? 0);
  const hpServerRef = useRef(char?.hpCurrent ?? 0);
  const hpFlushRef = useRef(null);
  const [hpFlash, setHpFlash] = useState(null); // "dmg" | "heal" | null
  const diceRollerRef = useRef(null);

  useEffect(() => {
    const incoming = initialData?.hpCurrent ?? 0;
    if (isFieldPending(expectedRef, "hpCurrent", incoming)) return;
    hpServerRef.current = incoming;
    setLocalHp(incoming);
  }, [initialData?.hpCurrent]);

  const flushHp = useCallback(async (targetHp) => {
    try {
      await patchLive({ hpCurrent: targetHp });
      hpServerRef.current = targetHp;
      onSessionSync?.();
    } catch {
      setLocalHp(hpServerRef.current);
    }
  }, [onSessionSync, patchLive]);

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
      await patchLive({ hpCurrent: next });
      hpServerRef.current = next;
      onSessionSync?.();
    } catch {
      setLocalHp(hpServerRef.current);
    }
  }, [char, localHp, onSessionSync, patchLive]);

  // ── Condition manager ─────────────────────────────────────────────────────
  const [condPickerOpen, setCondPickerOpen] = useState(false);

  const saveConditions = useCallback(async (conditions) => {
    setChar((prev) => ({ ...prev, conditions }));
    setCondPickerOpen(false);
    try {
      await patchLive({ conditions });
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, conditions: initialData?.conditions || [] }));
    }
  }, [onSessionSync, initialData?.conditions, patchLive]);

  // ── Concentration ─────────────────────────────────────────────────────────
  const [concInput, setConcInput] = useState("");
  const [concInputOpen, setConcInputOpen] = useState(false);

  const dropConcentration = useCallback(async () => {
    setChar((prev) => ({ ...prev, concentration: { active: false, spell: "" } }));
    try {
      await patchLive({ concentration: { active: false, spell: "" } });
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, concentration: initialData?.concentration }));
    }
  }, [onSessionSync, initialData?.concentration, patchLive]);

  const setConcentration = useCallback(async (spell) => {
    const conc = { active: true, spell };
    setChar((prev) => ({ ...prev, concentration: conc }));
    setConcInput("");
    setConcInputOpen(false);
    try {
      await patchLive({ concentration: conc });
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, concentration: initialData?.concentration }));
    }
  }, [onSessionSync, initialData?.concentration, patchLive]);

  // ── Inspiration ───────────────────────────────────────────────────────────
  const toggleInspiration = useCallback(async () => {
    const next = !char.inspiration;
    setChar((prev) => ({ ...prev, inspiration: next }));
    try {
      await patchLive({ inspiration: next });
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, inspiration: !next }));
    }
  }, [char, onSessionSync, patchLive]);

  // ── Spell slots — tap to spend/restore + rests (Story 63) ─────────────────
  // localSpellSlots is the optimistic display value; slotServerRef tracks the
  // freshest polled array so a debounced flush rebases onto it, never onto a
  // stale render snapshot (load-bearing once the DM can party-rest mid-tap).
  const [localSpellSlots, setLocalSpellSlots] = useState(initialData?.spellSlots || []);
  const slotServerRef = useRef(initialData?.spellSlots || []);
  const slotFlushTimerRef = useRef(null);
  const slotPendingDeltaRef = useRef({});
  const [slotUndo, setSlotUndo] = useState(null); // { level, delta, timer } | null

  useEffect(() => {
    if (isFieldPending(expectedRef, "spellSlots", initialData?.spellSlots || [])) return;
    slotServerRef.current = initialData?.spellSlots || [];
    setLocalSpellSlots(initialData?.spellSlots || []);
  }, [initialData?.spellSlots]);

  const flushSpellSlots = useCallback(async () => {
    const deltas = slotPendingDeltaRef.current;
    slotPendingDeltaRef.current = {};
    slotFlushTimerRef.current = null;
    const activeDeltas = Object.entries(deltas).filter(([, d]) => d !== 0);
    if (activeDeltas.length === 0) return;
    const deltaMap = Object.fromEntries(activeDeltas);
    const base = slotServerRef.current;
    const next = base.map((s) => {
      const d = deltaMap[s.level];
      if (!d) return s;
      return { ...s, used: Math.min(s.max, Math.max(0, (s.used || 0) + d)) };
    });
    try {
      await patchLive({ spellSlots: next });
      slotServerRef.current = next;
      onSessionSync?.();
    } catch {
      setLocalSpellSlots(slotServerRef.current);
    }
  }, [onSessionSync, patchLive]);

  const tapSlot = useCallback((level, spend) => {
    if (!slug) return;
    setLocalSpellSlots((prev) => prev.map((s) => {
      if (s.level !== level) return s;
      const used = spend ? Math.min(s.max, (s.used || 0) + 1) : Math.max(0, (s.used || 0) - 1);
      return { ...s, used };
    }));
    slotPendingDeltaRef.current[level] = (slotPendingDeltaRef.current[level] || 0) + (spend ? 1 : -1);
    clearTimeout(slotFlushTimerRef.current);
    slotFlushTimerRef.current = setTimeout(flushSpellSlots, 400);

    setSlotUndo((prev) => {
      clearTimeout(prev?.timer);
      const timer = setTimeout(() => setSlotUndo(null), 3000);
      return { level, delta: spend ? 1 : -1, timer };
    });
  }, [slug, flushSpellSlots]);

  const undoSlotTap = useCallback(() => {
    setSlotUndo((prev) => {
      if (!prev) return prev;
      clearTimeout(prev.timer);
      // The reversal is itself a tap in the opposite direction — if it lands
      // inside the still-open 400ms debounce window the pending delta nets
      // to zero and flushSpellSlots skips the network call entirely.
      tapSlot(prev.level, prev.delta < 0);
      return null;
    });
  }, [tapSlot]);

  const [restConfirm, setRestConfirm] = useState(null); // "short" | "long" | null
  const restConfirmTimerRef = useRef(null);

  const armRestConfirm = useCallback((kind) => {
    clearTimeout(restConfirmTimerRef.current);
    setRestConfirm(kind);
    restConfirmTimerRef.current = setTimeout(() => setRestConfirm(null), 5000);
  }, []);

  const commitRest = useCallback(async (kind) => {
    if (!slug) return;
    clearTimeout(restConfirmTimerRef.current);
    setRestConfirm(null);
    // A rest supersedes any pending pip taps — drop them rather than let a
    // stale flush overwrite the rest's result a moment later.
    clearTimeout(slotFlushTimerRef.current);
    slotFlushTimerRef.current = null;
    slotPendingDeltaRef.current = {};

    const prevSlots = slotServerRef.current;
    const prevHitDice = char?.hitDiceCurrent;
    const patch = kind === "long"
      ? applyLongRest({ ...char, spellSlots: prevSlots })
      : applyShortRest({ ...char, spellSlots: prevSlots });

    slotServerRef.current = patch.spellSlots;
    setLocalSpellSlots(patch.spellSlots);
    if (kind === "long") setChar((prev) => ({ ...prev, hitDiceCurrent: patch.hitDiceCurrent }));

    try {
      await patchLive(patch);
      onSessionSync?.();
      if (kind === "long") {
        postCharacterRoll(slug, { type: "wheel", name: "☾ Long Rest", note: "slots restored" }).catch(() => {});
      }
    } catch {
      slotServerRef.current = prevSlots;
      setLocalSpellSlots(prevSlots);
      if (kind === "long") setChar((prev) => ({ ...prev, hitDiceCurrent: prevHitDice }));
    }
  }, [char, slug, onSessionSync, patchLive]);

  // ── Story 58 — Loadout capture + coin/XP ledger ──────────────────────────
  // Every commit rebases on the freshest polled value (charRef), never on a
  // snapshot taken when the compose row or pad opened.
  const charRef = useRef(char);
  useEffect(() => { charRef.current = char; }, [char]);

  // Story 59 — exhaustion stepper (0–6), moved here from the classic Combat tab.
  const setExhaustion = useCallback(async (level) => {
    const prevLevel = charRef.current?.exhaustionLevel ?? 0;
    const next = Math.max(0, Math.min(6, level));
    if (next === prevLevel) return;
    setChar((prev) => ({ ...prev, exhaustionLevel: next }));
    try {
      await patchLive({ exhaustionLevel: next });
      onSessionSync?.();
    } catch {
      setChar((prev) => ({ ...prev, exhaustionLevel: prevLevel }));
    }
  }, [onSessionSync, patchLive]);

  const [recentAdds, setRecentAdds] = useState({}); // id → stagger index
  const [itemDetails, setItemDetails] = useState(null); // { kind, seed }
  const [quickAddOpen, setQuickAddOpen] = useState(null); // "weapons" | "equipment" | null

  const addLoadoutItems = useCallback(async (kind, items) => {
    if (!slug || items.length === 0) return false;
    const next = [...(charRef.current?.[kind] || []), ...items];
    const addedIds = new Set(items.map((item) => item.id));
    setChar((prev) => ({ ...prev, [kind]: next }));
    setRecentAdds((prev) => {
      const merged = { ...prev };
      items.forEach((item, index) => { merged[item.id] = index; });
      return merged;
    });
    setTimeout(() => setRecentAdds((prev) => {
      const rest = { ...prev };
      addedIds.forEach((id) => delete rest[id]);
      return rest;
    }), 1000);
    try {
      await patchLive({ [kind]: next });
      onSessionSync?.();
      return true;
    } catch {
      setChar((prev) => ({ ...prev, [kind]: (prev?.[kind] || []).filter((item) => !addedIds.has(item.id)) }));
      return false;
    }
  }, [slug, onSessionSync, patchLive]);

  // Edit / equip / delete apply a transform to the latest array by item id,
  // so a concurrent change to a different item is never clobbered.
  const writeLoadout = useCallback(async (kind, transform) => {
    if (!slug) return false;
    const prev = charRef.current?.[kind] || [];
    const next = transform(prev);
    setChar((current) => ({ ...current, [kind]: next }));
    try {
      await patchLive({ [kind]: next });
      onSessionSync?.();
      return true;
    } catch {
      setChar((current) => ({ ...current, [kind]: prev }));
      return false;
    }
  }, [slug, onSessionSync, patchLive]);

  const updateLoadoutItem = useCallback((kind, id, changes) => writeLoadout(kind, (items) => items.map((item) => {
    if (item.id !== id) return item;
    // A full item from the editor replaces the row; a partial (equip toggle) merges.
    return changes.id === id ? changes : { ...item, ...changes };
  })), [writeLoadout]);

  const deleteLoadoutItem = useCallback((kind, id) => writeLoadout(kind, (items) => items.filter((item) => item.id !== id)), [writeLoadout]);

  // Use one of a qty-tracked item (potion, arrows, rations). Stops at 0.
  const consumeLoadoutItem = useCallback((kind, id) => writeLoadout(kind, (items) => items.map((item) => (
    item.id === id && item.qty != null ? { ...item, qty: Math.max(0, item.qty - 1) } : item
  ))), [writeLoadout]);

  const adjustLoadoutQty = useCallback((kind, id, delta) => writeLoadout(kind, (items) => items.map((item) => (
    item.id === id && item.qty != null ? { ...item, qty: Math.max(0, item.qty + delta) } : item
  ))), [writeLoadout]);

  const [expandedLoadout, setExpandedLoadout] = useState(() => new Set());
  const toggleLoadoutExpanded = (id) => setExpandedLoadout((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const commitCoin = useCallback(async (denom, op, amount) => {
    const prevCoin = normalizeCoin(charRef.current?.coin);
    const { value, clamped } = applyDelta(prevCoin[denom], op, amount);
    const nextCoin = { ...prevCoin, [denom]: value };
    setChar((prev) => ({ ...prev, coin: nextCoin }));
    try {
      await patchLive({ coin: nextCoin });
      onSessionSync?.();
      return { ok: true, clamped };
    } catch {
      setChar((prev) => ({ ...prev, coin: prevCoin }));
      return { ok: false, clamped: false };
    }
  }, [onSessionSync, patchLive]);

  const commitXp = useCallback(async (op, amount) => {
    const prevXp = charRef.current?.xpCurrent ?? 0;
    const { value, clamped } = applyDelta(prevXp, op, amount);
    setChar((prev) => ({ ...prev, xpCurrent: value }));
    try {
      await patchLive({ xpCurrent: value });
      onSessionSync?.();
      return { ok: true, clamped };
    } catch {
      setChar((prev) => ({ ...prev, xpCurrent: prevXp }));
      return { ok: false, clamped: false };
    }
  }, [onSessionSync, patchLive]);

  const rowEnterProps = (id) => (id in recentAdds
    ? { className: "cs-spell-row-enter", style: { animationDelay: `${recentAdds[id] * 40}ms` } }
    : {});

  const saveNotes = useCallback(async (nextNotes) => {
    const prevNotes = charRef.current?.playerNotes || [];
    setChar((prev) => ({ ...prev, playerNotes: nextNotes }));
    try {
      await patchLive({ playerNotes: nextNotes });
      onSessionSync?.();
      return true;
    } catch {
      setChar((prev) => ({ ...prev, playerNotes: prevNotes }));
      return false;
    }
  }, [patchLive, onSessionSync]);

  // ── Session sub-tab state ─────────────────────────────────────────────────
  // Story 60 — "map" is no longer a sub-tab (the map is a persistent band).
  const rawStoredSubtab = sessionStorage.getItem(`dnd_session_subtab_${slug}`);
  const storedSubtab = rawStoredSubtab && rawStoredSubtab !== "map" ? rawStoredSubtab : "combat";
  const [sessionSubTab, setSessionSubTabState] = useState(storedSubtab);
  const setSessionSubTab = useCallback((tab) => {
    setSessionSubTabState(tab);
    sessionStorage.setItem(`dnd_session_subtab_${slug}`, tab);
  }, [slug]);

  // ── Story 60 — persistent map band ────────────────────────────────────────
  const mapPrefKey = `dnd_session_map_open_${slug}`;
  const [mapPref, setMapPref] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(mapPrefKey)); } catch { return null; }
  });
  const mapOpen = resolveMapBandOpen(mapPref, isBattleMode);
  const toggleMap = () => {
    const next = { open: !mapOpen, combat: !!isBattleMode };
    setMapPref(next);
    try { sessionStorage.setItem(mapPrefKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  // ── Initiative collapse (mobile) ──────────────────────────────────────────
  const [initExpanded, setInitExpanded] = useState(false);

  // ── Weapon expand state ───────────────────────────────────────────────────
  const [expandedWeapons, setExpandedWeapons] = useState(new Set());
  const toggleWeapon = (id) => setExpandedWeapons((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Story 56 — collapsed-by-default Spells reference row, below Spell Slots.
  const [spellsRefOpen, setSpellsRefOpen] = useState(false);

  // ── Derived values ────────────────────────────────────────────────────────
  const hpMax = char?.hpMax ?? 0;
  const hpPct = hpMax > 0 ? Math.min(100, (localHp / hpMax) * 100) : 0;
  const activeConditions = char?.conditions || [];
  const concentration = char?.concentration || { active: false, spell: "" };
  const spellSlots = localSpellSlots;
  const hasPactSlot = spellSlots.some((s) => s.isPactMagic && (s.max || 0) > 0);
  const totalSlotsSpent = spellSlots.reduce((sum, s) => sum + (s.used || 0), 0);
  const pactSlotsSpent = spellSlots.filter((s) => s.isPactMagic).reduce((sum, s) => sum + (s.used || 0), 0);
  const longRestIsNoop = totalSlotsSpent === 0 && (char?.hitDiceCurrent ?? (char?.level || 1)) >= (char?.level || 1);
  const shortRestIsNoop = pactSlotsSpent === 0;
  const skills = char?.skills || [];
  const specialAbilities = char?.specialAbilities || [];
  const weapons = char?.weapons || [];
  const equipment = char?.equipment || [];
  const stats = char?.stats || [];
  // Story 56 — tolerant read of `spells` (ADR-024), memoized against the raw
  // field so the merged attacks list + reference row don't remint ids on
  // every poll tick. Depend on char?.weapons (the raw field), not the
  // `weapons` local above — that's a fresh `[]` reference every render.
  const spells = useMemo(() => normalizeSpells(char?.spells), [char?.spells]);
  const attackEntries = useMemo(
    () => buildAttackEntries({ weapons: char?.weapons || [], spells }),
    [char?.weapons, spells]
  );

  // ── Story 57 — Attack Declaration Bar ───────────────────────────────────
  // Transient client state only, owned here per the story's Architect Notes
  // — deliberately NEVER written to sessionStorage (a declaration restored
  // after a reload would misrepresent a board that has moved on).
  // Shape: { target: {tokenId, sourceId, name}, attack: {id,kind,name,toHit,
  // damage,level} | null, lastRoll: {step,total,...} | null, gone: boolean }
  const [declaration, setDeclaration] = useState(null);
  const [barRolling, setBarRolling] = useState(false);
  const [rollOverlay, setRollOverlay] = useState(null); // { open, result }
  const goneMissTicksRef = useRef(0);
  // Mirrors DiceRoller's own advMode state so the bar's Adv/Dis strip
  // re-renders reactively — a ref-exposed value alone wouldn't trigger a
  // re-render here when it changes (see DiceRoller's onAdvModeChange).
  const [mirroredAdvMode, setMirroredAdvMode] = useState("normal");

  // Chips for the bar's PICK picker — same weapons-then-spells order as
  // attackEntries.entries (Story 56, consumed unchanged), each annotated
  // with whether its spell slot (if any) is exhausted.
  // Unarmed Strike is always offered (after weapons, before spells) so a
  // character with nothing equipped — or a monk — can still attack a target.
  const unarmedStrike = useMemo(
    () => buildUnarmedStrike({
      weapons: char?.weapons || [],
      charClass: char?.charClass,
      level: char?.level,
      mods: { Strength: abilityModifier(char, "Strength"), Dexterity: abilityModifier(char, "Dexterity") },
    }),
    [char]
  );
  const attackChips = useMemo(
    () => [
      ...attackEntries.weaponEntries,
      ...(unarmedStrike ? [unarmedStrike] : []),
      ...attackEntries.spellEntries,
    ].map((entry) => ({
      ...entry,
      spent: entry.kind === "spell" ? isSpellSlotSpent(entry.level, spellSlots) : false,
    })),
    [attackEntries, unarmedStrike, spellSlots]
  );
  const hasRollableAttacks = useMemo(
    () => attackChips.some((e) => e.toHit || e.damage),
    [attackChips]
  );

  // Read from a ref (updated in an effect below), not closed-over props, so
  // this callback has an EMPTY dependency array and a permanently stable
  // identity — it's threaded down through PlayerMapViewer (memo'd) into
  // every TokenChip (memo'd); a fresh function reference on every poll tick
  // would defeat both (Architect Notes, Performance).
  const targetLookupRef = useRef({ tokens: activeMap?.tokens, npcs: npcCombat?.npcs });
  useEffect(() => {
    targetLookupRef.current = { tokens: activeMap?.tokens, npcs: npcCombat?.npcs };
  }, [activeMap?.tokens, npcCombat]);

  const handleTargetToken = useCallback((tokenId) => {
    setDeclaration((prev) => {
      // Hold on the already-targeted token — untarget (brief §7.2).
      if (prev?.target?.tokenId === tokenId) return null;
      const { tokens, npcs } = targetLookupRef.current;
      const token = (tokens || []).find((t) => t.id === tokenId);
      if (!token) return prev;
      const npcName = npcs?.find((n) => n.id === token.sourceId)?.name || "Unknown";
      // Retarget-while-armed: keep the chosen attack, clear any landed roll
      // (a result belonged to the old target) — brief "attack retained".
      return {
        target: { tokenId, sourceId: token.sourceId, name: npcName },
        attack: prev?.attack ?? null,
        lastRoll: null,
        gone: false,
      };
    });
    goneMissTicksRef.current = 0;
  }, []);

  const handleSelectAttack = useCallback((chip) => {
    setDeclaration((prev) => (prev ? {
      ...prev,
      attack: { id: chip.id, kind: chip.kind, name: chip.name, toHit: chip.toHit, damage: chip.damage, level: chip.level },
      lastRoll: null,
    } : prev));
  }, []);

  const handleReopenPicker = useCallback(() => {
    setDeclaration((prev) => (prev ? { ...prev, attack: null, lastRoll: null } : prev));
  }, []);

  const handleCancelDeclaration = useCallback(() => {
    setDeclaration(null);
  }, []);

  const handleBarRoll = useCallback(({ step, exprOverride }) => {
    if (!declaration?.attack || !diceRollerRef.current || barRolling) return;
    setBarRolling(true);
    setRollOverlay({ open: true, result: null });
    diceRollerRef.current.rollAttack({
      attackEntry: declaration.attack,
      step,
      exprOverride,
      target: { type: "npc", sourceId: declaration.target.sourceId, name: declaration.target.name },
      attack: { kind: declaration.attack.kind, id: declaration.attack.id, name: declaration.attack.name },
      onComplete: (result) => {
        setBarRolling(false);
        if (!result) { setRollOverlay(null); return; } // already-rolling no-op (ADR-027)
        setDeclaration((prev) => (prev ? { ...prev, lastRoll: { ...result, step } } : prev));
        setRollOverlay({ open: true, result });
      },
    });
  }, [declaration, barRolling]);

  // GONE liveness (brief §5/§8) — 2 consecutive poll ticks of absence, so
  // one degraded response can't flicker the bar out mid-turn. Derived from
  // the already-polled activeMap.tokens[]; no extra scan on every render.
  useEffect(() => {
    if (!declaration || declaration.gone) { goneMissTicksRef.current = 0; return; }
    const stillThere = (activeMap?.tokens || []).some((t) => t.id === declaration.target.tokenId);
    if (stillThere) { goneMissTicksRef.current = 0; return; }
    goneMissTicksRef.current += 1;
    if (goneMissTicksRef.current >= 2) {
      setDeclaration((prev) => (prev ? { ...prev, gone: true } : prev));
      setTimeout(() => setDeclaration((prev) => (prev?.gone ? null : prev)), 1400);
    }
  }, [activeMap?.tokens, declaration]);

  // Leaving session mode clears the declaration (brief §7.1's framing —
  // the bar/reticle exist only while a declaration is live in session mode).
  useEffect(() => {
    if (mode !== "session" && declaration) setDeclaration(null);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ability modifiers
  // Shared with the DM card (base score + equipped item mods) so a check
  // shows and rolls the same modifier on every screen.
  const abilityMods = stats.map((s) => ({
    name: s.stat,
    abbr: STAT_ABBR[s.stat] || s.stat.slice(0, 3).toUpperCase(),
    mod: abilityModifier(char, s.stat),
  }));
  const abilityModsByName = Object.fromEntries(abilityMods.map((a) => [a.name, a.mod]));
  const checkDice = houseRules?.abilityCheckDice || DEFAULT_HOUSE_RULES.abilityCheckDice;

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

  const modeOptions = [
    { key: "profile", label: "❡ Profile" },
    { key: "session", label: "⚔ Session" },
  ];

  const modeSegment = (
    <NavSegment
      options={modeOptions}
      value={mode}
      onChange={setMode}
    />
  );

  const { textScale, textScaleMenuItem } = useTextScale(PLAYER_TEXT_SCALE_KEY);

  const sharedPalVars = {
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
  };

  // ── Profile mode: redirect to the plain CharacterSheet ───────────────────
  if (mode === "profile") {
    return (
      <div
        style={{
          ...sharedPalVars,
          minHeight: "100vh",
          background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%),
                       ${pal.bg}`,
          zoom: textScale,
        }}
        className="cs-session-root"
      >
        <WorldGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} pal={pal} />
        <TopNav
          backTo="/"
          title={char?.name}
          center={modeSegment}
          showLive={true}
          wsConnected={wsConnected}
          onBookClick={() => setGuideOpen((o) => !o)}
          bookOpen={guideOpen}
          menuItems={[
            { label: "Export JSON", href: `/characters/${slug}` },
            { label: "All Characters", href: "/" },
            { label: "Chronicle", href: "/chronicle" },
            { divider: true },
            textScaleMenuItem,
          ]}
        />

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
        ...sharedPalVars,
        minHeight: "100vh",
        background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%),
                     radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%),
                     ${pal.bg}`,
        zoom: textScale,
      }}
      className="cs-session-root"
    >
      <WorldGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} pal={pal} />
      {/* ── Top bar (shared TopNav) ── */}
      <TopNav
        backTo="/"
        title={char?.name}
        center={modeSegment}
        showLive={true}
        wsConnected={wsConnected}
        onBookClick={() => setGuideOpen((o) => !o)}
        bookOpen={guideOpen}
        menuItems={[
          { label: "Export JSON", href: `/characters/${slug}` },
          { label: "All Characters", href: "/" },
          { label: "Chronicle", href: "/chronicle" },
          { divider: true },
          textScaleMenuItem,
        ]}
      />

      {/* ── Two-column shell ── */}
      <div className="cs-session-shell">

        {/* ════════════ LEFT COLUMN ════════════ */}
        <div className="cs-session-left">

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
              <div
                key={a.name}
                className="cs-sm-ability-chip"
                style={{ cursor: "pointer" }}
                title={`Roll ${a.abbr} check (${abilityCheckExpr(a.mod, checkDice)})`}
                onClick={() => diceRollerRef.current?.rollAbility(a.name)}
              >
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
                          <div className="cs-sm-party-hp-bar">
                            <div
                              className={`cs-sm-party-hp-fill ${hpBarCls}`}
                              style={{ width: `${memberHpPct}%` }}
                            />
                          </div>
                          <span className={hpNumCls}>
                            {member.hpCurrent}/{member.hpMax}
                          </span>
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

          {/* Story 60 — persistent, collapsible map band (was the Map sub-tab).
              The viewer stays mounted while collapsed so token state, damage
              freshness and combat transitions keep tracking. */}
          {activeMap && (
            <section className={`cs-sm-mapband${mapOpen ? " open" : ""}`}>
              <button type="button" className="cs-sm-mapband-head" onClick={toggleMap} aria-expanded={mapOpen}>
                <span className="cs-sm-mapband-caret" aria-hidden="true">▸</span>
                <span className="cs-sm-mapband-label">Map</span>
                <span className="cs-sm-mapband-name">{activeMap.name}</span>
                {isBattleMode && <span className="cs-sm-mapband-combat">Combat</span>}
              </button>
              <div className="cs-sm-mapband-body" hidden={!mapOpen}>
                <PlayerMapViewer
                  activeMap={activeMap}
                  activeMapView={activeMapView}
                  isBattleMode={isBattleMode}
                  pal={pal}
                  slug={slug}
                  partyStatus={partyStatus}
                  npcCombat={npcCombat}
                  serverTime={serverTime}
                  initiativeData={initiativeData}
                  ownCharacter={char}
                  targetedTokenId={(isBattleMode && hasRollableAttacks) ? declaration?.target?.tokenId ?? null : null}
                  onTargetToken={(isBattleMode && hasRollableAttacks) ? handleTargetToken : undefined}
                  rollHistory={rollHistory}
                  height={380}
                />
              </div>
            </section>
          )}

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
                  background: pal.surfaceSolid,
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
          <div className={`cs-sm-exhaustion${(char?.exhaustionLevel ?? 0) > 0 ? " active" : ""}`}>
            <span className="cs-sm-exhaustion-label">Exhaustion</span>
            <button
              type="button"
              className="cs-sm-exhaustion-btn"
              onClick={() => setExhaustion((char?.exhaustionLevel ?? 0) - 1)}
              disabled={(char?.exhaustionLevel ?? 0) <= 0}
              aria-label="Decrease exhaustion"
            >−</button>
            <span className="cs-sm-exhaustion-level" aria-live="polite">{char?.exhaustionLevel ?? 0}</span>
            <button
              type="button"
              className="cs-sm-exhaustion-btn"
              onClick={() => setExhaustion((char?.exhaustionLevel ?? 0) + 1)}
              disabled={(char?.exhaustionLevel ?? 0) >= 6}
              aria-label="Increase exhaustion"
            >+</button>
          </div>

          {/* Spell slots — tap a pip to spend/restore; rests in the header row (Story 63) */}
          {spellSlots.length > 0 && (
            <>
              <hr className="cs-sm-rule" />
              <div className="cs-sm-slots-header">
                <span className="cs-sm-label" style={{ marginBottom: 0 }}>Spell Slots</span>
                <div className="cs-sm-rest-btns">
                  {hasPactSlot && (
                    <button
                      type="button"
                      className="cs-sm-rest-btn"
                      disabled={shortRestIsNoop}
                      onClick={() => (restConfirm === "short" ? commitRest("short") : armRestConfirm("short"))}
                    >
                      {restConfirm === "short" ? `Restore ${pactSlotsSpent} Pact?` : "Short Rest"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="cs-sm-rest-btn"
                    disabled={longRestIsNoop}
                    onClick={() => (restConfirm === "long" ? commitRest("long") : armRestConfirm("long"))}
                  >
                    {restConfirm === "long" ? `Restore All ${totalSlotsSpent}?` : "Long Rest"}
                  </button>
                </div>
              </div>
              <div className="cs-sm-slots-wrap">
                {spellSlots.map((slot, i) => {
                  const available = slot.max - (slot.used || 0);
                  return (
                    <div key={i} className="cs-sm-slot-group">
                      <span className="cs-sm-slot-lbl">L{slot.level}</span>
                      {Array.from({ length: slot.max }).map((_, pipIdx) => (
                        <button
                          key={pipIdx}
                          type="button"
                          className="cs-sm-slot-pip-btn"
                          onClick={() => tapSlot(slot.level, pipIdx < available)}
                          aria-label={pipIdx < available ? `Spend a level ${slot.level} slot` : `Restore a level ${slot.level} slot`}
                        >
                          <span
                            className="cs-sm-slot-pip"
                            style={{
                              borderColor: pipIdx < available ? pal.gem : pal.border,
                              background: pipIdx < available ? pal.gem : "transparent",
                            }}
                          />
                        </button>
                      ))}
                      <span className="cs-sm-slot-count">
                        {slotUndo?.level === slot.level ? (
                          <button type="button" className="cs-sm-slot-undo" onClick={undoSlotTap}>↺ Undo</button>
                        ) : (
                          `${available}/${slot.max}`
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Spells — collapsed-by-default reference row (Story 56) */}
          {spells.length > 0 && (
            <>
              <hr className="cs-sm-rule" />
              <button
                type="button"
                className="cs-sm-spells-toggle"
                onClick={() => setSpellsRefOpen((v) => !v)}
                aria-expanded={spellsRefOpen}
              >
                <span className="cs-sm-label">Spells · {spells.length}</span>
                <span className={`cs-sm-weapon-expand${spellsRefOpen ? " open" : ""}`}>▼</span>
              </button>
              {spellsRefOpen && (
                <div className="cs-sm-spells-wrap">
                  {spells.map((spell) => (
                    <span key={spell.id} className="cs-sm-spell-chip" title={spell.description || spell.name}>
                      {spell.role && <span className={`cs-spell-glyph${spell.role === "heal" ? " heal" : ""}`}>{spellRoleGlyph(spell.role)}</span>}
                      {spell.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Skills & Special Abilities */}
          {(skills.length > 0 || specialAbilities.length > 0) && (
            <>
              <hr className="cs-sm-rule" />
              <span className="cs-sm-label">Skills &amp; Abilities</span>
              <CharacterTalents pal={pal} skills={skills} specialAbilities={specialAbilities} compact />
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
              { key: "loadout", label: "Inventory" },
              { key: "notes", label: "Notes" },
            ].map(({ key, label, disabled }) => (
              <button
                key={key}
                className={`cs-sm-tab${sessionSubTab === key ? " active" : ""}${disabled ? " disabled" : ""}`}
                onClick={() => !disabled && setSessionSubTab(key)}
              >{label}</button>
            ))}
          </div>

          {/* ── COMBAT sub-tab (read-only weapon + attack-spell quick-ref) ── */}
          <div className={`cs-sm-tab-panel${sessionSubTab === "combat" ? " active" : ""}`}>
            {weapons.length === 0 && attackEntries.spellEntries.length === 0 ? (
              <p className="cs-sm-combat-empty">No weapons or attack spells configured. Go to Profile mode to add them.</p>
            ) : (
              <>
                <span className="cs-sm-label">{attackEntries.header}</span>
                {weapons.map((w) => {
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
                })}
                {attackEntries.spellEntries.length > 0 && (
                  <>
                    {weapons.length > 0 && <div className="divider" style={{ margin: "6px 0" }} />}
                    {attackEntries.spellEntries.map((entry) => {
                      const expandKey = `spell:${entry.id}`;
                      const expanded = expandedWeapons.has(expandKey);
                      return (
                        <div key={entry.id}>
                          <div className="cs-sm-weapon-row">
                            <span className="cs-spell-glyph">✶</span>
                            <span className="cs-sm-weapon-name">{entry.name}</span>
                            {entry.description && (
                              <button
                                className={`cs-sm-weapon-expand${expanded ? " open" : ""}`}
                                onClick={() => toggleWeapon(expandKey)}
                                aria-label={expanded ? "Collapse" : "Expand"}
                              >▼</button>
                            )}
                          </div>
                          {expanded && entry.description && (
                            <div className="cs-sm-weapon-desc">{entry.description}</div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>

          {/* ── LOADOUT sub-tab ── */}
          <div className={`cs-sm-tab-panel${sessionSubTab === "loadout" ? " active" : ""}`}>
            {/* Two-column grid identical to Inventory tab */}
            <div className="cs-sm-loadout-grid">
              {/* Weapons column */}
              <div>
                <div className="cs-col-header">
                  <div className="cs-col-label">Weapons</div>
                  <button
                    type="button"
                    className={`cs-sm-ld-addbtn${quickAddOpen === "weapons" ? " active" : ""}`}
                    // Keep focus in an open compose row so its blur-to-close
                    // doesn't fire first and turn this toggle into a reopen.
                    onMouseDown={(e) => { if (quickAddOpen === "weapons") e.preventDefault(); }}
                    onClick={() => setQuickAddOpen((current) => (current === "weapons" ? null : "weapons"))}
                    aria-expanded={quickAddOpen === "weapons"}
                  >+ Add Weapon</button>
                </div>
                <SessionQuickAdd
                  kind="weapons"
                  label="Weapon"
                  open={quickAddOpen === "weapons"}
                  onClose={() => setQuickAddOpen((current) => (current === "weapons" ? null : current))}
                  onAdd={(items) => addLoadoutItems("weapons", items)}
                  onOpenDetails={(seed) => setItemDetails({ kind: "weapons", seed })}
                />
                {weapons.map((w) => (
                  <SessionLoadoutRow
                    key={w.id}
                    item={w}
                    kind="weapons"
                    enterProps={rowEnterProps(w.id)}
                    onEdit={() => setItemDetails({ kind: "weapons", item: w })}
                    expanded={expandedLoadout.has(w.id)}
                    onToggleExpand={() => toggleLoadoutExpanded(w.id)}
                    onUse={() => consumeLoadoutItem("weapons", w.id)}
                    onAdjustQty={(delta) => adjustLoadoutQty("weapons", w.id, delta)}
                    onToggleEquipped={() => updateLoadoutItem("weapons", w.id, { equipped: w.equipped === false })}
                  />
                ))}
              </div>

              {/* Equipment column */}
              <div>
                <div className="cs-col-header">
                  <div className="cs-col-label">Equipment</div>
                  <button
                    type="button"
                    className={`cs-sm-ld-addbtn${quickAddOpen === "equipment" ? " active" : ""}`}
                    // Keep focus in an open compose row so its blur-to-close
                    // doesn't fire first and turn this toggle into a reopen.
                    onMouseDown={(e) => { if (quickAddOpen === "equipment") e.preventDefault(); }}
                    onClick={() => setQuickAddOpen((current) => (current === "equipment" ? null : "equipment"))}
                    aria-expanded={quickAddOpen === "equipment"}
                  >+ Add Item</button>
                </div>
                <SessionQuickAdd
                  kind="equipment"
                  label="Item"
                  open={quickAddOpen === "equipment"}
                  onClose={() => setQuickAddOpen((current) => (current === "equipment" ? null : current))}
                  onAdd={(items) => addLoadoutItems("equipment", items)}
                  onOpenDetails={(seed) => setItemDetails({ kind: "equipment", seed })}
                />
                {equipment.map((e) => (
                  <SessionLoadoutRow
                    key={e.id}
                    item={e}
                    kind="equipment"
                    enterProps={rowEnterProps(e.id)}
                    onEdit={() => setItemDetails({ kind: "equipment", item: e })}
                    expanded={expandedLoadout.has(e.id)}
                    onToggleExpand={() => toggleLoadoutExpanded(e.id)}
                    onUse={() => consumeLoadoutItem("equipment", e.id)}
                    onAdjustQty={(delta) => adjustLoadoutQty("equipment", e.id, delta)}
                    onToggleEquipped={() => updateLoadoutItem("equipment", e.id, { equipped: e.equipped === false })}
                  />
                ))}
              </div>
            </div>
            <SessionLedger char={char} onCommitCoin={commitCoin} onCommitXp={commitXp} />
          </div>

          {/* ── NOTES sub-tab ── */}
          <div className={`cs-sm-tab-panel${sessionSubTab === "notes" ? " active" : ""}`}>
            <SessionNotesSection char={char} pal={pal} onSaveNotes={saveNotes} />
          </div>

          {/* Dice roller */}
          <DiceRoller
            ref={diceRollerRef}
            weapons={weapons}
            stats={stats}
            pal={pal}
            slug={slug}
            onAdvModeChange={setMirroredAdvMode}
            checkDice={checkDice}
            abilityMods={abilityModsByName}
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

      {itemDetails && (
        <ItemEditorModal
          item={itemDetails.item}
          seed={itemDetails.seed}
          pal={pal}
          showType={itemDetails.kind === "equipment"}
          onClose={() => setItemDetails(null)}
          onSave={(item) => {
            const { kind, item: existing } = itemDetails;
            setItemDetails(null);
            if (existing) updateLoadoutItem(kind, existing.id, item);
            else addLoadoutItems(kind, [item]);
          }}
          onDelete={itemDetails.item ? () => {
            const { kind, item: existing } = itemDetails;
            setItemDetails(null);
            deleteLoadoutItem(kind, existing.id);
          } : undefined}
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

      {/* Story 57 — Attack Declaration Bar. Fixed to the viewport, present
          only while a declaration is live; survives a sub-tab switch for
          free (it isn't inside any .cs-sm-tab-panel). */}
      {declaration && (
        <AttackDeclarationBar
          pal={pal}
          declaration={declaration}
          chips={attackChips}
          rolling={barRolling}
          advMode={mirroredAdvMode}
          onSetAdvMode={(mode) => diceRollerRef.current?.setAdvMode(mode)}
          getAttackExpr={(entry, step) => diceRollerRef.current?.getAttackExpr(entry, step) ?? ""}
          onSelectAttack={handleSelectAttack}
          onReopenPicker={handleReopenPicker}
          onCancel={handleCancelDeclaration}
          onRoll={handleBarRoll}
        />
      )}

      {rollOverlay?.open && (
        <RollOverlay
          pal={pal}
          playing={rollOverlay.open}
          result={rollOverlay.result}
          onDismiss={() => setRollOverlay(null)}
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

// Session notes section (owner/DM auth enforced by CharacterModePage + API)
// Notes save instantly: the note appears (and the input clears) before the
// write; a failed save removes it and puts the text back.
function SessionNotesSection({ char, pal, onSaveNotes }) {
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState(false);
  const notes = char?.playerNotes || [];

  async function addNote() {
    const text = newNote.trim();
    if (!text) return;
    const next = [
      ...notes,
      { id: "n" + Date.now(), text, sharedWithDm: false, createdAt: new Date().toISOString() },
    ];
    setNewNote("");
    setError(false);
    const ok = await onSaveNotes(next);
    if (!ok) {
      setNewNote((current) => current || text);
      setError(true);
    }
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
            background: pal.surfaceSolid,
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
          disabled={!newNote.trim()}
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
            opacity: !newNote.trim() ? 0.5 : 1,
          }}
        >Add</button>
      </div>
      {error && <p className="cs-sm-notes-empty" role="alert" style={{ color: "#c06060" }}>Couldn{"'"}t save that note — try again.</p>}
    </div>
  );
}

// ── PlayerMapViewer ────────────────────────────────────────────────────────
// Read-only token layer for the player's Map sub-tab.
// Stable empty-array reference (not [] inline) so a map with no tokens field
// doesn't create a fresh array identity on every render — the `tokens` value
// below feeds several Stories 52–54 useMemo/useEffect dependency arrays.
const EMPTY_TOKENS = [];

const PlayerMapViewer = memo(function PlayerMapViewer({ activeMap, activeMapView, isBattleMode, pal, slug, partyStatus, npcCombat, serverTime, initiativeData, ownCharacter, targetedTokenId, onTargetToken, rollHistory, height = 480 }) {
  const [viewerState, setViewerState] = useState(null);
  // Stories 52–54 — persists the last-rendered damage stamp per token id
  // across renders (freshness gate), reset when the active map changes.
  const seenStampsRef = useRef(new Map());
  const prevMapIdRef = useRef(activeMap?.id);
  useEffect(() => {
    if (prevMapIdRef.current !== activeMap?.id) {
      seenStampsRef.current = new Map();
      prevMapIdRef.current = activeMap?.id;
    }
  }, [activeMap?.id]);

  // Detect mapMode transitions and trigger the dramatic overlay + sound.
  // undefined = not yet initialized (first render never fires a transition).
  const prevModeRef = useRef(undefined);
  const [transitionType, setTransitionType] = useState(null);
  const transitionTimerRef = useRef(null);

  useEffect(() => {
    // isBattleMode comes from mapLibrary.combatMode (see ADR-029) — updates
    // atomically with putMapActive so there's no race against patchMapTokens's
    // PutCommand, same as the old battleMapId-comparison scheme it replaced.
    if (prevModeRef.current === undefined) { prevModeRef.current = isBattleMode; return; }
    const wasCombat = prevModeRef.current;
    prevModeRef.current = isBattleMode;
    if (isBattleMode !== wasCombat) {
      const type = isBattleMode ? "entering" : "leaving";
      setTransitionType(type);
      if (type === "entering") playCombatEnterSound();
      else playCombatExitSound();
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => setTransitionType(null), 3200);
    }
  }, [activeMap?.id, isBattleMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(transitionTimerRef.current), []);

  const tokens = activeMap?.tokens || EMPTY_TOKENS;
  const partyVisible = partyStatus?.visible !== false;
  const tokenScale = activeMap?.tokenScale ?? 1;
  const viewerZoom = viewerState?.scale ?? 1;
  const labelsHidden = tokenScale * viewerZoom < 0.6;
  // Story 34 — suppresses MapViewer's own pan while the player is dragging
  // their own token; a plain ref (not state) so it never triggers a re-render.
  const panSuppressedRef = useRef(false);

  // Not memoized — this is only invoked on pointerup, not on every render,
  // so a fresh closure per render costs nothing and keeps it simple.
  const handleMoveOwnToken = (tokenId, x, y) => {
    if (!activeMap?.id) return Promise.reject(new Error("no active map"));
    return moveMapToken(activeMap.id, tokenId, x, y, slug);
  };

  // Story 53 — "own token always shows its own badges." When
  // partyVisibilityEnabled is false, partyStatus.members is [], so without
  // this merge the player's own token would resolve member === undefined —
  // no conditions, no HP. The player's own full record is already fetched
  // (ownCharacter, the `?slug=` character payload) — merge it in rather than
  // firing a second request.
  // Memoized (not just an IIFE) so its identity stays stable across pure pan/
  // zoom re-renders — otherwise every downstream Stories 52–54 computation
  // below would recompute every frame and defeat TokenChip's memo().
  const partyForTokens = useMemo(() => {
    const members = partyStatus?.members || [];
    if (!ownCharacter?.slug) return members;
    if (members.some((m) => m.slug === ownCharacter.slug)) return members;
    return [
      ...members,
      {
        slug: ownCharacter.slug,
        name: ownCharacter.name,
        palette: ownCharacter.palette,
        portraitUrl: ownCharacter.portraitUrl,
        hpCurrent: ownCharacter.hpCurrent,
        hpMax: ownCharacter.hpMax,
        tempHP: ownCharacter.tempHP,
        conditions: ownCharacter.conditions || [],
        exhaustionLevel: ownCharacter.exhaustionLevel ?? 0,
        concentration: ownCharacter.concentration,
        inspiration: ownCharacter.inspiration,
        deathSaves: ownCharacter.deathSaves,
        lastDamagedAt: ownCharacter.lastDamagedAt ?? null,
        lastDamageAmount: ownCharacter.lastDamageAmount ?? null,
        // Story 55 — so the player's own token can still draw a tracer to
        // itself when partyVisibilityEnabled is off (the only path where
        // this fallback merge, rather than partyStatus.members, is what
        // resolvedByTokenId reads from for this token's subject).
        lastDamageFrom: ownCharacter.lastDamageFrom ?? null,
      },
    ];
  }, [partyStatus, ownCharacter]);

  // Determine which tokens this player can see per ADR-017. Server already
  // omits invisible NPC tokens entirely (Story 54) — no client-side filter
  // is added here for invisibility, only the pre-existing party-visibility
  // rule for ally PC tokens. Memoized so the array keeps a stable identity
  // across pure pan/zoom re-renders (see resolvedByTokenId below).
  const visibleTokens = useMemo(() => (isBattleMode ? tokens.filter((t) => {
    if (t.type === "npc") return true;
    if (t.sourceId === slug) return true;
    return partyVisible;
  }) : []), [isBattleMode, tokens, slug, partyVisible]);

  // Story 54 — the vanish. Diff-driven against NPC tokens only (a PC token
  // disappearing because partyVisibilityEnabled just toggled off is a
  // privacy setting, not "it went invisible," and must not play the vanish).
  const npcVisibleTokens = useMemo(
    () => visibleTokens.filter((t) => t.type === "npc"),
    [visibleTokens]
  );
  const exitGhosts = useTokenExitGhosts(npcVisibleTokens, activeMap?.id);

  const inCombat = (initiativeData?.entries?.length || 0) > 0;
  const activeEntry = (initiativeData?.entries || [])[initiativeData?.activeTurnIndex ?? 0] || null;
  const debouncedZoom = useDebouncedValue(viewerZoom, 80);

  // Computed in an effect (not useMemo) because it reads/mutates
  // seenStampsRef — refs may only be touched outside render — and stored in
  // state, so the resolved objects keep a stable identity across pure pan/
  // zoom renders (unaffected by this effect) and TokenChip's memo() keeps
  // working. One render's lag between new poll data landing and the
  // resolved effects appearing is imperceptible against a ~1–2s poll
  // cadence. debouncedZoom only changes on its own tick.
  const reducedMotion = usePrefersReducedMotion();
  const [resolvedByTokenId, setResolvedByTokenId] = useState(new Map());
  // ADR-031 — combat FX strike events (see MapPanel for the DM twin).
  const [strikeEvents, setStrikeEvents] = useState([]);
  const healSeenRef = useRef(new Map());
  const missSeenRef = useRef(new Map());
  useEffect(() => {
    const npcList = npcCombat?.npcs || [];
    const rawDamageStates = new Map();
    const freshKeysInOrder = [];
    const hits = [];
    for (const token of visibleTokens) {
      const member = token.type === "character" ? partyForTokens.find((m) => m.slug === token.sourceId) : null;
      const npc = token.type === "npc" ? npcList.find((n) => n.id === token.sourceId) : null;
      const subject = member || npc;
      const isCurrentlyActiveTurn = token.type === "character"
        ? activeEntry?.slug === token.sourceId
        : activeEntry?.npcId === token.sourceId;
      const state = resolveDamageState(
        token.id,
        {
          lastDamagedAt: subject?.lastDamagedAt ?? null,
          lastDamageAmount: subject?.lastDamageAmount ?? null,
          hpCurrent: subject?.hpCurrent ?? null,
          hpMax: subject?.hpMax ?? subject?.hp ?? null,
        },
        { serverTime, isCurrentlyActiveTurn, turnStartedAt: initiativeData?.turnStartedAt, inCombat },
        seenStampsRef.current
      );
      rawDamageStates.set(token.id, state);
      if (state.phaseAFresh) freshKeysInOrder.push(token.id);
      // ADR-031/032 — every damage/heal plays a strike (Story 52's freshness
      // gate, reused); a chosen action (lastFx) or a miss plays exactly as
      // chosen. Attacker refs are already stripped server-side when hidden.
      hits.push(...collectTokenHits({
        token,
        subject,
        damageFresh: state.phaseAFresh,
        serverTime,
        healSeen: healSeenRef.current,
        missSeen: missSeenRef.current,
      }));
    }
    // Evict stale entries — otherwise every token id this viewer has ever
    // seen across a multi-day session accumulates a permanent entry here. A
    // token that drops out of visibleTokens (party-visibility toggle, went
    // Invisible) and later returns is correctly treated as "first seen"
    // again — consistent with the freshness gate's existing first-paint
    // rule, not a new behavior.
    const liveTokenIds = new Set(visibleTokens.map((t) => t.id));
    for (const id of seenStampsRef.current.keys()) {
      if (!liveTokenIds.has(id)) seenStampsRef.current.delete(id);
    }
    for (const seen of [healSeenRef.current, missSeenRef.current]) {
      for (const id of seen.keys()) if (!liveTokenIds.has(id)) seen.delete(id);
    }
    const staggerByKey = assignAoEStagger(freshKeysInOrder);
    const result = new Map();
    for (const token of visibleTokens) {
      const rawState = rawDamageStates.get(token.id);
      const stagger = staggerByKey.get(token.id);
      const damageState = rawState && {
        ...rawState,
        // ADR-031 — the combat FX layer owns the moment of impact now.
        phaseAFresh: false,
        delayMs: stagger?.delayMs ?? 0,
        washOnly: !!stagger?.washOnly,
      };
      const effectivePx = computeEffectivePx({ tokenScale: token.scale, mapTokenScale: tokenScale, zoom: debouncedZoom });
      const condBand = resolveCondBand(effectivePx);
      // Story 54 — player view: NPC invisible tokens never reach this array
      // at all (server omission), so `token.invisible` here only ever
      // describes a veiled ally PC — VEILED, never SECRET (no ◇ on the
      // player's own map).
      const veil = token.invisible ? { veiled: true, secret: false } : { veiled: false, secret: false };
      result.set(token.id, {
        damageState,
        condBand,
        veil,
        shimmerDelayMs: shimmerPhaseOffsetMs(token.id),
      });
    }
    setResolvedByTokenId(result);

    // visibleTokens (not the raw token list) is what the attacker resolves
    // against — an attacker this viewer can't see plays as impact-only.
    const strikes = buildStrikeEvents({
      hits,
      tokens: visibleTokens,
      party: partyForTokens,
      rolls: rollHistory || [],
      imageW: viewerState?.naturalSize?.w,
      imageH: viewerState?.naturalSize?.h,
      mapTokenScale: tokenScale,
    });
    if (strikes.length > 0) setStrikeEvents(strikes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTokens, partyForTokens, npcCombat, serverTime, initiativeData, tokenScale, debouncedZoom, viewerState?.naturalSize?.w, viewerState?.naturalSize?.h]);

  function buildChip(token, opts = {}) {
    const resolved = resolvedByTokenId.get(token.id) || {};
    return (
      <TokenChip
        key={token.id}
        token={token}
        imageW={viewerState?.naturalSize?.w || 1}
        imageH={viewerState?.naturalSize?.h || 1}
        party={partyForTokens}
        npcCombat={npcCombat || { npcs: [] }}
        isDm={false}
        isOwnToken={token.sourceId === slug}
        partyVisibilityEnabled={partyVisible}
        isHeld={false}
        pal={pal}
        labelHidden={labelsHidden}
        ownSlug={slug}
        onMoveToken={handleMoveOwnToken}
        panSuppressedRef={panSuppressedRef}
        damageState={resolved.damageState}
        condBand={resolved.condBand}
        veil={resolved.veil}
        shimmerDelayMs={resolved.shimmerDelayMs}
        exiting={!!opts.exiting}
        onTargetToken={onTargetToken}
        targeted={token.id === targetedTokenId}
      />
    );
  }

  const tokenChips = [
    ...visibleTokens.map((token) => buildChip(token)),
    ...exitGhosts.map((token) => buildChip(token, { exiting: true })),
  ];

  return (
    <>
      <CombatTransitionOverlay type={transitionType} />
      {/* Story 53 — condition glyph sprite, rendered once. */}
      <ConditionGlyphSprite />
      <MapViewer
        imageUrl={activeMap.imageUrl}
        name={activeMap.name}
        contentType={activeMap.contentType}
        height={height}
        pal={pal}
        publishedView={activeMapView}
        onViewChange={setViewerState}
        tokenScale={tokenScale}
        rotation={activeMap?.rotation ?? 0}
        tokenLayerChildren={isBattleMode && (visibleTokens.length > 0 || exitGhosts.length > 0) ? tokenChips : undefined}
        overlay={isBattleMode ? <CombatFxLayer events={strikeEvents} rotation={activeMap?.rotation ?? 0} reducedMotion={reducedMotion} /> : null}
        panSuppressedRef={panSuppressedRef}
      />
    </>
  );
});
