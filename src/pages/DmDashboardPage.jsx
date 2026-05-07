import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { getDmParty, patchSession, getInitiative, putInitiative, getNpcCombat, putNpcCombat, getRollHistory } from "../api";
import DmDiceRoller from "../components/DmDiceRoller";
import CharacterCard from "../features/dmDashboard/CharacterCard";
import ConfirmDialog from "../features/dmDashboard/ConfirmDialog";
import DmLoginPrompt from "../features/dmDashboard/DmLoginPrompt";
import InitiativeTracker from "../features/dmDashboard/InitiativeTracker";
import NpcCombatSection from "../features/dmDashboard/NpcCombatSection";
import {
  PalCtx,
  initiativesEqual,
  useDashboardStyles,
} from "../features/dmDashboard/dashboardShared";
import { PALETTES } from "../features/characterSheet/theme";
import { useAdaptivePolling, useQueuedRefresh } from "../lib/liveSync";

export default function DmDashboardPage() {
  useDashboardStyles();

  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(false);
  const [authState, setAuthState] = useState(() => (sessionStorage.getItem("dnd_dm_password") ? "checking" : "prompt"));
  const [party, setParty] = useState([]);
  const [initiative, setInitiative] = useState({ entries: [], activeTurnIndex: 0 });
  const [npcCombat, setNpcCombat] = useState({ npcs: [] });
  const [rollHistory, setRollHistory] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [restNotice, setRestNotice] = useState("");
  const [palKey, setPalKey] = useState(() => sessionStorage.getItem("dnd_dm_palette") || "ocean");
  const pal = PALETTES[palKey] || PALETTES.ocean;

  const cardOpenFnsRef = useRef({});
  const requestSeqRef = useRef(0);
  const activeRequestCountRef = useRef(0);
  const initiativeServerRef = useRef(initiative);
  const initiativeExpectedRef = useRef(null);
  const initiativeWriteInFlightRef = useRef(false);
  const queuedInitiativeRef = useRef(null);

  const fetchDashboardData = useCallback(async ({ background = false, force = false } = {}) => {
    if (!dmPassword) return;
    if (background && activeRequestCountRef.current > 0 && !force) return;

    const requestId = ++requestSeqRef.current;
    activeRequestCountRef.current += 1;

    try {
      const [partyData, initData, npcData, rollHistoryData] = await Promise.all([
        getDmParty(dmPassword),
        getInitiative(dmPassword),
        getNpcCombat(dmPassword),
        getRollHistory(dmPassword),
      ]);
      if (requestId !== requestSeqRef.current) return;
      setParty(partyData);
      initiativeServerRef.current = initData;
      if (initiativeExpectedRef.current && !initiativesEqual(initData, initiativeExpectedRef.current)) {
        // Keep optimistic turn state until server catches up or write fails.
      } else {
        if (initiativeExpectedRef.current && initiativesEqual(initData, initiativeExpectedRef.current)) {
          initiativeExpectedRef.current = null;
        }
        setInitiative(initData);
      }
      setNpcCombat(npcData);
      setRollHistory(rollHistoryData.rolls || []);
    } catch {
      // Show stale data rather than error on poll failure.
    } finally {
      activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
    }
  }, [dmPassword]);

  const queueDashboardRefresh = useQueuedRefresh(fetchDashboardData);

  const commitInitiativeUpdate = useCallback(async (nextInitiative, { optimistic = false } = {}) => {
    if (!dmPassword) return;

    const normalized = {
      entries: nextInitiative.entries || [],
      activeTurnIndex: nextInitiative.activeTurnIndex ?? 0,
    };

    queuedInitiativeRef.current = normalized;

    if (optimistic) {
      initiativeExpectedRef.current = normalized;
      setInitiative(normalized);
    }

    if (initiativeWriteInFlightRef.current) return;

    while (queuedInitiativeRef.current) {
      const target = queuedInitiativeRef.current;
      queuedInitiativeRef.current = null;
      initiativeWriteInFlightRef.current = true;
      initiativeExpectedRef.current = target;

      try {
        await putInitiative(dmPassword, target);
        initiativeServerRef.current = target;
        queueDashboardRefresh(0);
      } catch {
        initiativeExpectedRef.current = null;
        queuedInitiativeRef.current = null;
        setInitiative(initiativeServerRef.current);
        queueDashboardRefresh(0);
        break;
      } finally {
        initiativeWriteInFlightRef.current = false;
      }
    }
  }, [dmPassword, queueDashboardRefresh]);

  const handleRegisterOpen = useCallback((slug, fn) => {
    cardOpenFnsRef.current[slug] = fn;
  }, []);

  const handleApplyDamage = useCallback((slug, amount) => {
    const fn = cardOpenFnsRef.current[slug];
    if (fn) fn(amount);
  }, []);

  const handleApplyNpcDamage = useCallback(async (npcId, amount) => {
    setNpcCombat((prev) => {
      const updated = (prev.npcs || []).map((npc) => npc.id === npcId ? { ...npc, hpCurrent: npc.hpCurrent - amount } : npc);
      putNpcCombat(dmPassword, { npcs: updated }).then(() => queueDashboardRefresh(0)).catch(() => {});
      return { npcs: updated };
    });
  }, [dmPassword, queueDashboardRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromoteToNpc = useCallback(async (entryId, hpMax) => {
    const entry = initiative.entries.find((value) => value.id === entryId);
    if (!entry) return;
    const npcId = "npc-" + Date.now() + Math.random().toString(36).slice(2, 5);
    const newNpc = {
      id: npcId,
      name: entry.name,
      hpMax,
      hpCurrent: hpMax,
      conditions: [],
      initiativeEntryId: entryId,
    };
    const updatedNpcs = [...(npcCombat.npcs || []), newNpc];
    const updatedEntries = initiative.entries.map((value) => value.id === entryId ? { ...value, npcId } : value);
    try {
      await Promise.all([
        putNpcCombat(dmPassword, { npcs: updatedNpcs }),
        putInitiative(dmPassword, { entries: updatedEntries, activeTurnIndex: initiative.activeTurnIndex ?? 0 }),
      ]);
      queueDashboardRefresh(0);
    } catch {}
  }, [dmPassword, initiative, npcCombat, queueDashboardRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardUpdate = useCallback((action) => {
    if (action === "shortRest") {
      setConfirmDialog({
        title: "Short Rest",
        message: "Reset Pact Magic (Warlock) spell slots for all characters. Standard spell slots and HP are not affected.",
        onConfirm: doShortRest,
      });
    } else if (action === "longRest") {
      setConfirmDialog({
        title: "Long Rest",
        message: "Reset all spell slots and restore all characters to max HP. This cannot be undone.",
        onConfirm: doLongRest,
      });
    } else {
      queueDashboardRefresh();
    }
  }, [queueDashboardRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dmPassword) {
      setAuthState("prompt");
      return;
    }
    getDmParty(dmPassword)
      .then((data) => {
        setParty(data);
        setAuthed(true);
        setAuthState("authed");
      })
      .catch(() => {
        sessionStorage.removeItem("dnd_dm_password");
        setDmPassword("");
        setAuthed(false);
        setAuthState("prompt");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authed) fetchDashboardData({ background: true, force: true });
  }, [authed, fetchDashboardData]);

  useAdaptivePolling({
    enabled: authed,
    poll: fetchDashboardData,
  });

  function handleLoginSuccess(pw) {
    setDmPassword(pw);
    setAuthed(true);
    setAuthState("authed");
  }

  function handleEndSession() {
    sessionStorage.removeItem("dnd_dm_password");
    setDmPassword("");
    setAuthed(false);
    setAuthState("prompt");
  }

  async function doLongRest() {
    setConfirmDialog(null);
    await Promise.all(
      party.map((char) => patchSession(char.slug, {
        hpCurrent: char.hpMax ?? char.hp ?? 0,
        spellSlots: Array.isArray(char.spellSlots) ? char.spellSlots.map((slot) => ({ ...slot, used: 0 })) : char.spellSlots,
      }, dmPassword))
    );
    setRestNotice("Long rest applied — all HP and spell slots restored.");
    setTimeout(() => setRestNotice(""), 4000);
    queueDashboardRefresh(0);
  }

  async function doShortRest() {
    setConfirmDialog(null);
    await Promise.all(
      party.map((char) => patchSession(char.slug, {
        spellSlots: Array.isArray(char.spellSlots) ? char.spellSlots.map((slot) => slot.isPactMagic ? { ...slot, used: 0 } : slot) : char.spellSlots,
      }, dmPassword))
    );
    setRestNotice("Short rest applied — Pact Magic slots restored.");
    setTimeout(() => setRestNotice(""), 4000);
    queueDashboardRefresh(0);
  }

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt onSuccess={handleLoginSuccess} checking={authState === "checking"} />
      </PalCtx.Provider>
    );
  }

  const btnStyle = {
    background: "rgba(18,32,48,0.5)",
    border: `1px solid ${pal.accent}`,
    borderRadius: 3,
    color: pal.accentBright,
    fontFamily: pal.fontUI,
    fontSize: 12,
    letterSpacing: "0.14em",
    padding: "7px 16px",
    cursor: "pointer",
  };

  const btnSecondary = {
    ...btnStyle,
    background: "transparent",
    borderColor: "rgba(100,130,160,0.32)",
    color: pal.textMuted,
  };

  return (
    <PalCtx.Provider value={pal}>
      <div style={{
        background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%), ${pal.bg}`,
        minHeight: "100vh",
        color: pal.text,
        fontFamily: pal.fontBody,
        WebkitFontSmoothing: "antialiased",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "14px 24px",
          borderBottom: "1px solid rgba(100,130,160,0.32)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(13,15,20,0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}>
          <div>
            <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, letterSpacing: "0.12em", color: pal.accentBright }}>Campaign</div>
            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted }}>
              {party.length > 0 ? `${party.length} player${party.length !== 1 ? "s" : ""}` : "Loading…"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            <select
              value={palKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                setPalKey(nextKey);
                sessionStorage.setItem("dnd_dm_palette", nextKey);
              }}
              style={{ background: "rgba(18,32,48,0.6)", border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "5px 8px", cursor: "pointer", outline: "none" }}
            >
              {Object.keys(PALETTES).map((key) => (
                <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
              ))}
            </select>

            {restNotice && (
              <span style={{ fontFamily: pal.fontUI, fontSize: 11, color: "#88c888", letterSpacing: "0.08em" }}>{restNotice}</span>
            )}

            <button
              style={{ ...btnSecondary, borderColor: "rgba(192,96,96,0.4)", color: "#c06060" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c06060"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(192,96,96,0.4)"; }}
              onClick={handleEndSession}
            >End Session</button>
          </div>
        </div>

        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "12px 24px 0" }}>
          <Link
            to="/"
            style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.textMuted, textDecoration: "none", display: "inline-block" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = pal.accentBright; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; }}
          >← Character Library</Link>
        </div>

        <div className="dm-layout" style={{ display: "grid", gridTemplateColumns: "1fr 320px 300px", gap: 0, maxWidth: 1400, margin: "0 auto", padding: 24, alignItems: "start" }}>
          <div className="dm-party-col" style={{ paddingRight: 20 }}>
            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 14 }}>Party</div>

            {(() => {
              const sortedEntries = [...(initiative.entries || [])].sort((a, b) => b.initiative - a.initiative);
              const activeEntry = sortedEntries[initiative.activeTurnIndex ?? 0];
              const activeTurnSlug = activeEntry?.slug ?? null;
              return party.length === 0 ? (
                <div style={{ fontFamily: pal.fontUI, fontSize: 13, color: pal.textMuted, padding: "20px 0" }}>No characters found.</div>
              ) : (
                party.map((char) => (
                  <CharacterCard
                    key={char.slug}
                    char={char}
                    dmPassword={dmPassword}
                    onUpdate={handleCardUpdate}
                    onRegisterOpen={handleRegisterOpen}
                    isActiveTurn={activeTurnSlug === char.slug}
                  />
                ))
              );
            })()}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 10 }}>Party-Wide Actions</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  {
                    label: "◑ Short Rest — Reset Pact Magic",
                    action: () => setConfirmDialog({
                      title: "Short Rest",
                      message: "Reset Pact Magic (Warlock) spell slots for all characters. Standard spell slots and HP are not affected.",
                      onConfirm: doShortRest,
                    }),
                  },
                  {
                    label: "⏾ Long Rest — Reset All Slots + HP",
                    action: () => setConfirmDialog({
                      title: "Long Rest",
                      message: "Reset all spell slots and restore all characters to max HP. This cannot be undone.",
                      onConfirm: doLongRest,
                    }),
                  },
                ].map(({ label, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    style={{ flex: 1, background: "transparent", border: "1px solid rgba(100,130,160,0.32)", borderRadius: 4, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", padding: "8px 0", cursor: "pointer", textAlign: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accentBright; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.color = pal.textMuted; }}
                  >{label}</button>
                ))}
              </div>
            </div>

            <DmDiceRoller
              pal={pal}
              party={party.map((character) => ({ slug: character.slug, name: character.name, palette: character.palette }))}
              npcs={(npcCombat.npcs || []).map((npc) => ({ id: npc.id, name: npc.name }))}
              onApplyDamage={handleApplyDamage}
              onApplyNpcDamage={handleApplyNpcDamage}
              remoteHistory={rollHistory}
            />
          </div>

          <NpcCombatSection npcCombat={npcCombat} initiative={initiative} dmPassword={dmPassword} onUpdate={() => queueDashboardRefresh(0)} />

          <InitiativeTracker initiative={initiative} party={party} npcCombat={npcCombat} onCommitInitiative={commitInitiativeUpdate} onPromoteToNpc={handlePromoteToNpc} />
        </div>

        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
      </div>
    </PalCtx.Provider>
  );
}
