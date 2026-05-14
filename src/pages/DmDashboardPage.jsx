import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { getDmParty, patchSession, getInitiative, putInitiative, getNpcCombat, putNpcCombat, getRollHistory, getMapLibrary, listCharacters, getPartyRoster, putPartyRoster } from "../api";
import DmDiceRoller from "../components/DmDiceRoller";
import CharacterCard, { AwardXpModal, DistributeCoinModal } from "../features/dmDashboard/CharacterCard";
import ConfirmDialog from "../features/dmDashboard/ConfirmDialog";
import DmLoginPrompt from "../features/dmDashboard/DmLoginPrompt";
import InitiativeTracker from "../features/dmDashboard/InitiativeTracker";
import NpcCombatSection from "../features/dmDashboard/NpcCombatSection";
import MapPanel from "../features/dmDashboard/MapPanel";
import MapLibraryStrip from "../features/dmDashboard/MapLibraryStrip";
import ManagePartyModal from "../features/dmDashboard/ManagePartyModal";
import {
  PalCtx,
  initiativesEqual,
} from "../features/dmDashboard/dashboardShared";
import "./pages.css";
import { PALETTES } from "../features/characterSheet/theme";
import { cloneLiveValue, useAdaptivePolling, useQueuedRefresh } from "../lib/liveSync";

export default function DmDashboardClassicPage() {

  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(false);
  const [authState, setAuthState] = useState(() => (sessionStorage.getItem("dnd_dm_password") ? "checking" : "prompt"));
  const [showAwardXpParty, setShowAwardXpParty] = useState(false);
  const [showDistributeCoinParty, setShowDistributeCoinParty] = useState(false);
  const [showManageParty, setShowManageParty] = useState(false);
  const [party, setParty] = useState([]);
  const [libraryCharacters, setLibraryCharacters] = useState([]);
  const [partyRoster, setPartyRoster] = useState([]);
  const [initiative, setInitiative] = useState({ entries: [], activeTurnIndex: 0 });
  const [npcCombat, setNpcCombat] = useState({ npcs: [] });
  const [rollHistory, setRollHistory] = useState([]);
  const [mapLibrary, setMapLibrary] = useState({ activeMapId: null, activeMapView: null, maps: [] });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [restNotice, setRestNotice] = useState("");
  const [palKey, setPalKey] = useState(() => sessionStorage.getItem("dnd_dm_palette") || "ocean");
  const pal = PALETTES[palKey] || PALETTES.ocean;

  const cardOpenFnsRef = useRef({});
  const requestSeqRef = useRef(0);
  const activeRequestCountRef = useRef(0);
  const partyRef = useRef(party);
  const initiativeServerRef = useRef(initiative);
  const initiativeExpectedRef = useRef(null);
  const initiativeWriteInFlightRef = useRef(false);
  const queuedInitiativeRef = useRef(null);
  const npcCombatServerRef = useRef(npcCombat);

  useEffect(() => {
    partyRef.current = party;
  }, [party]);

  const fetchRosterContext = useCallback(async () => {
    const [characters, rosterData] = await Promise.all([
      listCharacters().catch(() => []),
      getPartyRoster().catch(() => ({ exists: false, members: [] })),
    ]);
    const validCharacters = (characters || []).filter((character) => (
      character &&
      typeof character === "object" &&
      typeof character.slug === "string" &&
      character.slug.trim() &&
      typeof character.name === "string" &&
      character.name.trim()
    ));
    const fallbackMembers = validCharacters.map((character) => character.slug);
    setLibraryCharacters(validCharacters);
    setPartyRoster(rosterData?.exists ? (Array.isArray(rosterData?.members) ? rosterData.members : []) : fallbackMembers);
  }, []);

  const fetchDashboardData = useCallback(async ({ background = false, force = false } = {}) => {
    if (!dmPassword) return;
    if (background && activeRequestCountRef.current > 0 && !force) return;

    const requestId = ++requestSeqRef.current;
    activeRequestCountRef.current += 1;

    try {
      const [partyData, initData, npcData, rollHistoryData, mapLibraryData] = await Promise.all([
        getDmParty(dmPassword),
        getInitiative(dmPassword),
        getNpcCombat(dmPassword),
        getRollHistory(dmPassword),
        getMapLibrary(),
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
      npcCombatServerRef.current = npcData;
      setNpcCombat(npcData);
      setRollHistory(rollHistoryData.rolls || []);
      setMapLibrary(mapLibraryData || { activeMapId: null, activeMapView: null, maps: [] });
    } catch {
      // Show stale data rather than error on poll failure.
    } finally {
      activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
    }
  }, [dmPassword]);

  const queueDashboardRefresh = useQueuedRefresh(fetchDashboardData);

  const applyPartyOptimisticUpdates = useCallback((updates) => {
    if (!Array.isArray(updates) || updates.length === 0) return;

    const updatesBySlug = new Map(
      updates
        .filter((update) => update && typeof update.slug === "string" && update.slug.trim())
        .map((update) => [update.slug, update])
    );

    setParty((current) => current.map((character) => {
      const update = updatesBySlug.get(character.slug);
      return update ? { ...character, ...update } : character;
    }));
  }, []);

  const commitPartySessionUpdates = useCallback(async (updates) => {
    if (!dmPassword || !Array.isArray(updates) || updates.length === 0) return false;

    const snapshot = partyRef.current;
    const snapshotBySlug = new Map(snapshot.map((character) => [character.slug, character]));
    const validUpdates = updates.filter((update) => update && typeof update.slug === "string" && update.slug.trim());
    if (validUpdates.length === 0) return false;

    const reverts = validUpdates.map((update) => {
      const current = snapshotBySlug.get(update.slug) || {};
      const revert = { slug: update.slug };
      Object.keys(update).forEach((key) => {
        if (key === "slug") return;
        revert[key] = cloneLiveValue(current[key]);
      });
      return revert;
    });

    applyPartyOptimisticUpdates(validUpdates);

    try {
      await Promise.all(validUpdates.map(({ slug, ...fields }) => patchSession(slug, fields, dmPassword)));
      queueDashboardRefresh(0);
      return true;
    } catch {
      applyPartyOptimisticUpdates(reverts);
      queueDashboardRefresh(0);
      return false;
    }
  }, [applyPartyOptimisticUpdates, dmPassword, queueDashboardRefresh]);

  const commitNpcCombatUpdate = useCallback(async (nextNpcCombat, { optimistic = false } = {}) => {
    if (!dmPassword) return;

    const normalized = {
      npcs: nextNpcCombat.npcs || [],
    };

    if (optimistic) {
      setNpcCombat(normalized);
    }

    try {
      await putNpcCombat(dmPassword, normalized);
      npcCombatServerRef.current = normalized;
      queueDashboardRefresh(0);
      return true;
    } catch {
      setNpcCombat(npcCombatServerRef.current);
      queueDashboardRefresh(0);
      return false;
    }
  }, [dmPassword, queueDashboardRefresh]);

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
    const updated = (npcCombat.npcs || []).map((npc) => (
      npc.id === npcId ? { ...npc, hpCurrent: npc.hpCurrent - amount } : npc
    ));
    await commitNpcCombatUpdate({ npcs: updated }, { optimistic: true });
  }, [commitNpcCombatUpdate, npcCombat.npcs]);

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

  const handleAddNpcToInitiative = useCallback(async (npcId, targetIndex = null) => {
    const npc = (npcCombat.npcs || []).find((value) => value.id === npcId);
    if (!npc) return;

    const entries = initiative.entries || [];
    const npcInitiativeEntryId = npc.initiativeEntryId ?? npc.initiativeId ?? null;
    const existingEntry = entries.find((value) => value.npcId === npcId || value.id === npcInitiativeEntryId);
    const activeEntryId = entries[initiative.activeTurnIndex ?? 0]?.id ?? null;

    let workingEntries = [...entries];
    let entryId = existingEntry?.id || npcInitiativeEntryId || `id${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

    if (existingEntry) {
      workingEntries = workingEntries.filter((value) => value.id !== existingEntry.id);
    } else {
      workingEntries.push({
        id: entryId,
        name: npc.name,
        initiative: 0,
        isPC: false,
        npcId,
      });
      workingEntries = workingEntries.filter((value) => value.id !== entryId);
    }

    const entry = existingEntry
      ? { ...existingEntry, npcId, name: npc.name }
      : {
          id: entryId,
          name: npc.name,
          initiative: 0,
          isPC: false,
          npcId,
        };

    const insertIndex = targetIndex === null
      ? workingEntries.length
      : Math.max(0, Math.min(targetIndex, workingEntries.length));
    workingEntries.splice(insertIndex, 0, entry);

    const nextActiveTurnIndex = activeEntryId
      ? Math.max(0, workingEntries.findIndex((value) => value.id === activeEntryId))
      : Math.min(initiative.activeTurnIndex ?? 0, Math.max(workingEntries.length - 1, 0));

    const updatedInitiative = {
      entries: workingEntries,
      activeTurnIndex: nextActiveTurnIndex < 0 ? 0 : nextActiveTurnIndex,
    };
    const updatedNpcCombat = {
      npcs: (npcCombat.npcs || []).map((value) =>
        value.id === npcId ? { ...value, initiativeEntryId: entryId } : value
      ),
    };

    setInitiative(updatedInitiative);
    initiativeExpectedRef.current = updatedInitiative;
    setNpcCombat(updatedNpcCombat);

    try {
      await Promise.all([
        putInitiative(dmPassword, updatedInitiative),
        putNpcCombat(dmPassword, updatedNpcCombat),
      ]);
      initiativeServerRef.current = updatedInitiative;
      npcCombatServerRef.current = updatedNpcCombat;
      queueDashboardRefresh(0);
    } catch {
      initiativeExpectedRef.current = null;
      setInitiative(initiativeServerRef.current);
      setNpcCombat(npcCombatServerRef.current);
      queueDashboardRefresh(0);
    }
  }, [dmPassword, initiative, npcCombat, queueDashboardRefresh]);

  const handleRemoveNpcFromInitiative = useCallback(async (npcId) => {
    const npc = (npcCombat.npcs || []).find((value) => value.id === npcId);
    if (!npc) return;

    const entries = initiative.entries || [];
    const npcInitiativeEntryId = npc.initiativeEntryId ?? npc.initiativeId ?? null;
    const targetEntry = entries.find((value) => value.npcId === npcId || value.id === npcInitiativeEntryId || (!value.isPC && (value.name || "").trim().toLowerCase() === (npc.name || "").trim().toLowerCase()));
    if (!targetEntry) return;

    const activeEntryId = entries[initiative.activeTurnIndex ?? 0]?.id ?? null;
    const updatedEntries = entries.filter((value) => value.id !== targetEntry.id);
    const nextActiveTurnIndex = updatedEntries.length === 0
      ? 0
      : activeEntryId === targetEntry.id
      ? Math.min(initiative.activeTurnIndex ?? 0, updatedEntries.length - 1)
      : Math.max(0, updatedEntries.findIndex((value) => value.id === activeEntryId));

    const updatedInitiative = {
      entries: updatedEntries,
      activeTurnIndex: nextActiveTurnIndex < 0 ? 0 : nextActiveTurnIndex,
    };
    const updatedNpcCombat = {
      npcs: (npcCombat.npcs || []).map((value) =>
        value.id === npcId ? { ...value, initiativeEntryId: null } : value
      ),
    };

    setInitiative(updatedInitiative);
    initiativeExpectedRef.current = updatedInitiative;
    setNpcCombat(updatedNpcCombat);

    try {
      await Promise.all([
        putInitiative(dmPassword, updatedInitiative),
        putNpcCombat(dmPassword, updatedNpcCombat),
      ]);
      initiativeServerRef.current = updatedInitiative;
      npcCombatServerRef.current = updatedNpcCombat;
      queueDashboardRefresh(0);
    } catch {
      initiativeExpectedRef.current = null;
      setInitiative(initiativeServerRef.current);
      setNpcCombat(npcCombatServerRef.current);
      queueDashboardRefresh(0);
    }
  }, [dmPassword, initiative, npcCombat, queueDashboardRefresh]);

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

  useEffect(() => {
    if (!authed) return;
    fetchRosterContext().catch(() => {});
  }, [authed, fetchRosterContext]);

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
    setShowManageParty(false);
  }

  async function handleSavePartyRoster(members) {
    if (!dmPassword) throw new Error("DM password required");

    const nextMembers = [...members];
    setPartyRoster(nextMembers);

    setParty((current) => current.filter((character) => nextMembers.includes(character.slug)));

    const allowedMemberSet = new Set(nextMembers);
    const filteredEntries = (initiative.entries || []).filter((entry) => !entry.isPC || (entry.slug && allowedMemberSet.has(entry.slug)));
    const activeEntryId = (initiative.entries || [])[initiative.activeTurnIndex ?? 0]?.id ?? null;
    const filteredActiveTurnIndex = filteredEntries.length === 0
      ? 0
      : activeEntryId
      ? Math.max(0, filteredEntries.findIndex((entry) => entry.id === activeEntryId))
      : Math.min(initiative.activeTurnIndex ?? 0, filteredEntries.length - 1);
    const nextInitiative = {
      entries: filteredEntries,
      activeTurnIndex: filteredActiveTurnIndex < 0 ? 0 : filteredActiveTurnIndex,
    };

    if (!initiativesEqual(initiative, nextInitiative)) {
      setInitiative(nextInitiative);
      initiativeExpectedRef.current = nextInitiative;
    }

    try {
      await putPartyRoster(nextMembers, dmPassword);
      if (!initiativesEqual(initiative, nextInitiative)) {
        await commitInitiativeUpdate(nextInitiative, { optimistic: false });
      }
      await fetchRosterContext();
      queueDashboardRefresh(0);
    } catch (err) {
      await fetchRosterContext().catch(() => {});
      queueDashboardRefresh(0);
      throw err;
    }
  }

  async function doLongRest() {
    setConfirmDialog(null);
    const updates = partyRef.current.map((char) => {
      const level = char.level || 1;
      const hdCurrent = char.hitDiceCurrent ?? level;
      const hdRestore = Math.max(1, Math.floor(level / 2));
      const hitDiceCurrent = Math.min(level, hdCurrent + hdRestore);
      return {
        slug: char.slug,
        hpCurrent: char.hpMax ?? char.hp ?? 0,
        spellSlots: Array.isArray(char.spellSlots) ? char.spellSlots.map((slot) => ({ ...slot, used: 0 })) : char.spellSlots,
        hitDiceCurrent,
      };
    });
    const success = await commitPartySessionUpdates(updates);
    if (!success) return;
    setRestNotice("Long rest applied — all HP, spell slots, and Hit Dice restored.");
    setTimeout(() => setRestNotice(""), 4000);
  }

  async function doShortRest() {
    setConfirmDialog(null);
    const updates = partyRef.current.map((char) => ({
      slug: char.slug,
      spellSlots: Array.isArray(char.spellSlots) ? char.spellSlots.map((slot) => slot.isPactMagic ? { ...slot, used: 0 } : slot) : char.spellSlots,
    }));
    const success = await commitPartySessionUpdates(updates);
    if (!success) return;
    setRestNotice("Short rest applied — Pact Magic slots restored.");
    setTimeout(() => setRestNotice(""), 4000);
  }

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt onSuccess={handleLoginSuccess} checking={authState === "checking"} />
      </PalCtx.Provider>
    );
  }

  // btnStyle/btnSecondary replaced by .btn-primary / .btn-ghost CSS classes

  return (
    <PalCtx.Provider value={pal}>
      <div style={{
        background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%), ${pal.bg}`,
        minHeight: "100vh",
        color: pal.text,
        fontFamily: pal.fontBody,
        WebkitFontSmoothing: "antialiased",
      }}>
        <div className="dm-sticky-header">
          <div>
            <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, letterSpacing: "0.12em", color: pal.accentBright }}>Campaign</div>
            <div className="label-ui">
              {party.length > 0 ? `${party.length} player${party.length !== 1 ? "s" : ""}` : "Loading…"}
            </div>
          </div>

          <div className="flex-row" style={{ gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            <button className="btn-ghost" onClick={() => setShowManageParty(true)}>
              Manage Party
            </button>
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
              className="btn-ghost"
              style={{ borderColor: "rgba(192,96,96,0.4)", color: "#c06060" }}
              onClick={handleEndSession}
            >End Session</button>
          </div>
        </div>

        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "12px 24px 0" }}>
          <Link
            to="/"
            className="label-ui dm-nav-link"
            style={{ fontSize: 12, letterSpacing: "0.14em", color: pal.textMuted, textDecoration: "none" }}
          >← Character Library</Link>
        </div>

        <div className="dm-layout" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 0, maxWidth: 1400, margin: "0 auto", padding: 24, alignItems: "start" }}>
          <div className="dm-party-col" style={{ paddingRight: 20 }}>
            <MapPanel
              mapLibrary={mapLibrary}
              dmPassword={dmPassword}
              pal={pal}
              onLibraryChange={() => fetchDashboardData({ background: true, force: true })}
            />
            <div className="label-ui" style={{ marginBottom: 14 }}>Party</div>

            {(() => {
              const activeEntry = (initiative.entries || [])[initiative.activeTurnIndex ?? 0];
              const activeTurnSlug = activeEntry?.slug ?? null;
              return party.length === 0 ? (
                <div className="label-ui" style={{ fontSize: 13, padding: "20px 0" }}>No characters found.</div>
              ) : (
                party.map((char) => (
                  <CharacterCard
                    key={char.slug}
                    char={char}
                    dmPassword={dmPassword}
                    onUpdate={handleCardUpdate}
                    onCommitSessionUpdates={commitPartySessionUpdates}
                    onRegisterOpen={handleRegisterOpen}
                    isActiveTurn={activeTurnSlug === char.slug}
                    allParty={party}
                  />
                ))
              );
            })()}

            <div style={{ marginTop: 16 }}>
              <div className="label-ui" style={{ marginBottom: 10 }}>Party-Wide Actions</div>
              <div className="flex-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
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
                    className="btn-ghost"
                    style={{ flex: 1 }}
                  >{label}</button>
                ))}
                {party.some((c) => (c.levelingMode || "milestone") === "xp") && (
                  <button
                    onClick={() => setShowAwardXpParty(true)}
                    className="btn-ghost"
                  >✦ Award XP to Party</button>
                )}
                <button
                  onClick={() => setShowDistributeCoinParty(true)}
                  className="btn-ghost"
                  style={{ borderColor: "rgba(200,160,64,0.3)", color: "rgba(200,160,64,0.7)" }}
                >◈ Distribute Coin</button>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 0, width: 620, maxWidth: "100%" }}>
            <div style={{ display: "grid", gridTemplateColumns: "320px 300px", gap: 0 }}>
              <NpcCombatSection
                npcCombat={npcCombat}
                initiative={initiative}
                dmPassword={dmPassword}
                onUpdate={() => queueDashboardRefresh(0)}
                onCommitNpcCombat={commitNpcCombatUpdate}
                onAddNpcToInitiative={handleAddNpcToInitiative}
                onRemoveNpcFromInitiative={handleRemoveNpcFromInitiative}
              />
              <InitiativeTracker
                initiative={initiative}
                party={party}
                npcCombat={npcCombat}
                onCommitInitiative={commitInitiativeUpdate}
                onPromoteToNpc={handlePromoteToNpc}
              />
            </div>
            <MapLibraryStrip
              mapLibrary={mapLibrary}
              dmPassword={dmPassword}
              onLibraryChange={() => fetchDashboardData({ background: true, force: true })}
            />
          </div>
        </div>

        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}

        {showAwardXpParty && (
          <AwardXpModal
            char={null}
            dmPassword={dmPassword}
            onClose={() => setShowAwardXpParty(false)}
            onUpdate={() => queueDashboardRefresh(0)}
            onOptimisticUpdate={applyPartyOptimisticUpdates}
            forParty={true}
            party={party}
          />
        )}

        {showDistributeCoinParty && (
          <DistributeCoinModal
            char={null}
            dmPassword={dmPassword}
            onClose={() => setShowDistributeCoinParty(false)}
            onUpdate={() => queueDashboardRefresh(0)}
            onOptimisticUpdate={applyPartyOptimisticUpdates}
            forParty={true}
            party={party}
          />
        )}

        {showManageParty && (
          <ManagePartyModal
            characters={libraryCharacters}
            rosterMembers={partyRoster}
            onClose={() => setShowManageParty(false)}
            onSave={handleSavePartyRoster}
          />
        )}
      </div>
    </PalCtx.Provider>
  );
}
