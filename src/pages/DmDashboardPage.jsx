import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { getDmParty, patchSession, putInitiative, putNpcCombat, putMapActive, listCharacters, getPartyRoster, putPartyRoster, getNpcLibrary, putNpcLibrary, getSessionState } from "../api";
import DmDiceRoller from "../components/DmDiceRoller";
import CharacterCard, { AwardXpModal, DistributeCoinModal } from "../features/dmDashboard/CharacterCard";
import ConfirmDialog from "../features/dmDashboard/ConfirmDialog";
import DmLoginPrompt from "../features/dmDashboard/DmLoginPrompt";
import InitiativeTracker from "../features/dmDashboard/InitiativeTracker";
import NpcCombatSection from "../features/dmDashboard/NpcCombatSection";
import MapPanel from "../features/dmDashboard/MapPanel";
import CounterWheelsPanel from "../features/dmDashboard/CounterWheelsPanel";
import MapLibraryStrip from "../features/dmDashboard/MapLibraryStrip";
import ManagePartyModal from "../features/dmDashboard/ManagePartyModal";
import EnemiesGalleryModal from "../features/dmDashboard/EnemiesGalleryModal";
import WorldGuideDrawer from "../features/worldGuide/WorldGuideDrawer";
import {
  PalCtx,
  initiativesEqual,
} from "../features/dmDashboard/dashboardShared";
import { PALETTES } from "../features/characterSheet/theme";
import TopNav, { NavSegment } from "../components/TopNav";
import { cloneLiveValue, liveValuesEqual, useAdaptivePolling, useQueuedRefresh, ACTIVE_POLL_MS, BACKGROUND_POLL_MS } from "../lib/liveSync";
import { useSessionSocket } from "../lib/useSessionSocket";
import { reportServerBuildVersion } from "../lib/staleClient";

const COMBAT_MODE_STORAGE_KEY = "dnd_dm_dashboard_combat";
const LEGACY_COMBAT_MODE_STORAGE_KEY = "dnd_dm_dashboard_prototype_combat";
const ADVENTURE_MAP_KEY = "dnd_dm_adventure_map";
const BATTLE_MAP_KEY = "dnd_dm_battle_map";
const TEXT_SCALE_STORAGE_KEY = "dnd_dm_text_scale";
const MAP_TRANSITION_MS = 320;
const CARD_FLIP_MS = 460;
const CARD_COMPACT_MS = 240;
const DICE_EXIT_MS = 240;
const DICE_ENTER_MS = 420;
const TEXT_SCALE_STEP = 0.1;
const TEXT_SCALE_MIN = 0.9;
const TEXT_SCALE_MAX = 1.4;

function clampTextScale(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
}

export default function DmDashboardPage() {

  const initialCombatMode = (
    sessionStorage.getItem(COMBAT_MODE_STORAGE_KEY) ??
    sessionStorage.getItem(LEGACY_COMBAT_MODE_STORAGE_KEY)
  ) === "true";
  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(false);
  const [authState, setAuthState] = useState(() => (sessionStorage.getItem("dnd_dm_password") ? "checking" : "prompt"));
  const [showAwardXpParty, setShowAwardXpParty] = useState(false);
  const [showDistributeCoinParty, setShowDistributeCoinParty] = useState(false);
  const [showManageParty, setShowManageParty] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openCardPopoverSlug, setOpenCardPopoverSlug] = useState(null);
  const [combatMode, setCombatMode] = useState(initialCombatMode);
  const [mapCollapsed, setMapCollapsed] = useState(initialCombatMode);
  const [combatLayoutActive, setCombatLayoutActive] = useState(initialCombatMode);
  const [diceLayoutActive, setDiceLayoutActive] = useState(initialCombatMode);
  const [diceVisible, setDiceVisible] = useState(true);
  const [wheelsVisible, setWheelsVisible] = useState(true);
  const [cardsCompact, setCardsCompact] = useState(initialCombatMode);
  const [combatPanelsVisible, setCombatPanelsVisible] = useState(initialCombatMode);
  const [nonCombatChromeVisible, setNonCombatChromeVisible] = useState(!initialCombatMode);
  const [party, setParty] = useState([]);
  const [libraryCharacters, setLibraryCharacters] = useState([]);
  const [partyRoster, setPartyRoster] = useState([]);
  const [partyVisibilityEnabled, setPartyVisibilityEnabled] = useState(true);
  const [initiative, setInitiative] = useState({ entries: [], activeTurnIndex: 0 });
  const [npcCombat, setNpcCombat] = useState({ npcs: [] });
  const [rollHistory, setRollHistory] = useState([]);
  const [mapLibrary, setMapLibrary] = useState({ activeMapId: null, activeMapView: null, maps: [] });
  const [npcLibrary, setNpcLibrary] = useState({ templates: [] });
  const [showEnemiesGallery, setShowEnemiesGallery] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [restNotice, setRestNotice] = useState("");
  const [palKey, setPalKey] = useState(() => sessionStorage.getItem("dnd_dm_palette") || "ocean");
  const [textScale, setTextScale] = useState(() =>
    clampTextScale(parseFloat(sessionStorage.getItem(TEXT_SCALE_STORAGE_KEY) || "1"))
  );
  const pal = PALETTES[palKey] || PALETTES.ocean;

  const cardOpenFnsRef = useRef({});
  const cardItemRefs = useRef(new Map());
  const pendingCardFlipRef = useRef(null);
  const activeCardAnimationsRef = useRef([]);
  const transitionTimersRef = useRef([]);
  const requestSeqRef = useRef(0);
  const activeRequestCountRef = useRef(0);
  const partyRef = useRef(party);
  const partyExpectedValuesRef = useRef(new Map());
  const partyRosterExpectedRef = useRef(null);
  const initiativeServerRef = useRef(initiative);
  const initiativeExpectedRef = useRef(null);
  const initiativeWriteInFlightRef = useRef(false);
  const queuedInitiativeRef = useRef(null);
  const npcCombatServerRef = useRef(npcCombat);
  const npcCombatExpectedRef = useRef(null);
  // Ref to MapPanel's handleToggleBattleMode, registered via onRegisterBattleToggle prop
  const battleToggleFnRef = useRef(null);

  useEffect(() => {
    partyRef.current = party;
  }, [party]);

  useEffect(() => () => {
    transitionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    transitionTimersRef.current = [];
    activeCardAnimationsRef.current.forEach((animation) => animation.cancel());
    activeCardAnimationsRef.current = [];
  }, []);

  useEffect(() => {
    sessionStorage.setItem(COMBAT_MODE_STORAGE_KEY, String(combatMode));
    sessionStorage.removeItem(LEGACY_COMBAT_MODE_STORAGE_KEY);
  }, [combatMode]);

  useEffect(() => {
    sessionStorage.setItem(TEXT_SCALE_STORAGE_KEY, String(textScale));
  }, [textScale]);


  useLayoutEffect(() => {
    const pendingFlip = pendingCardFlipRef.current;
    if (!pendingFlip) return;

    activeCardAnimationsRef.current.forEach((animation) => animation.cancel());
    activeCardAnimationsRef.current = [];

    const animations = [];
    pendingFlip.rects.forEach((previousRect, slug) => {
      const node = cardItemRefs.current.get(slug);
      if (!node) return;
      const nextRect = node.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      const scaleX = previousRect.width / Math.max(nextRect.width, 1);
      const scaleY = previousRect.height / Math.max(nextRect.height, 1);
      const hasMovement = Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1 || Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;
      if (!hasMovement) return;

      const animation = node.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
            transformOrigin: "top left",
          },
          {
            transform: "translate(0px, 0px) scale(1, 1)",
            transformOrigin: "top left",
          },
        ],
        {
          duration: CARD_FLIP_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
        }
      );

      animation.onfinish = () => {
        node.style.transform = "";
      };
      animation.oncancel = () => {
        node.style.transform = "";
      };
      animations.push(animation);
    });

    activeCardAnimationsRef.current = animations;
    pendingCardFlipRef.current = null;
  }, [combatLayoutActive, party.length]);

  const queueTransitionStep = useCallback((fn, delay) => {
    const timerId = window.setTimeout(fn, delay);
    transitionTimersRef.current.push(timerId);
  }, []);

  const clearTransitionSteps = useCallback(() => {
    transitionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    transitionTimersRef.current = [];
  }, []);

  const triggerCardFlip = useCallback((nextLayoutActive) => {
    pendingCardFlipRef.current = {
      rects: new Map(
        Array.from(cardItemRefs.current.entries()).map(([slug, node]) => [slug, node.getBoundingClientRect()])
      ),
    };
    setCombatLayoutActive(nextLayoutActive);
  }, []);

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
    if (rosterData?.exists && typeof rosterData?.partyVisibilityEnabled === "boolean") {
      setPartyVisibilityEnabled(rosterData.partyVisibilityEnabled);
    }
  }, []);

  const fetchDashboardData = useCallback(async ({ background = false, force = false } = {}) => {
    if (!dmPassword) return;
    if (background && activeRequestCountRef.current > 0 && !force) return;

    const requestId = ++requestSeqRef.current;
    activeRequestCountRef.current += 1;

    try {
      // Story 35 — one consolidated request per poll tick instead of 5.
      const sessionData = await getSessionState({ dmPassword });
      const partyData = sessionData.party || [];
      const initData = sessionData.initiative || { entries: [], activeTurnIndex: 0 };
      const npcData = sessionData.npcCombat || { npcs: [] };
      const rollHistoryData = sessionData.rollHistory || { rolls: [] };
      const mapLibraryData = sessionData.mapLibrary || { activeMapId: null, activeMapView: null, maps: [] };
      if (requestId !== requestSeqRef.current) return;
      const expectedRoster = partyRosterExpectedRef.current;
      let nextPartyData = partyData;
      if (expectedRoster) {
        const incomingSlugs = partyData.map((character) => character.slug);
        const rosterMatches = incomingSlugs.length === expectedRoster.length
          && incomingSlugs.every((slug, index) => slug === expectedRoster[index]);
        if (rosterMatches) {
          partyRosterExpectedRef.current = null;
        } else {
          nextPartyData = partyRef.current;
        }
      }

      const currentPartyBySlug = new Map(partyRef.current.map((character) => [character.slug, character]));
      const reconciledParty = nextPartyData.map((incomingCharacter) => {
        const currentCharacter = currentPartyBySlug.get(incomingCharacter.slug);
        const expectedFields = partyExpectedValuesRef.current.get(incomingCharacter.slug);
        if (!currentCharacter || !expectedFields || expectedFields.size === 0) {
          return incomingCharacter;
        }

        const mergedCharacter = { ...currentCharacter, ...incomingCharacter };
        const remainingExpectedFields = new Map();
        expectedFields.forEach((expectedValue, fieldName) => {
          if (liveValuesEqual(incomingCharacter[fieldName], expectedValue)) {
            mergedCharacter[fieldName] = incomingCharacter[fieldName];
          } else {
            mergedCharacter[fieldName] = currentCharacter[fieldName];
            remainingExpectedFields.set(fieldName, expectedValue);
          }
        });

        if (remainingExpectedFields.size > 0) {
          partyExpectedValuesRef.current.set(incomingCharacter.slug, remainingExpectedFields);
        } else {
          partyExpectedValuesRef.current.delete(incomingCharacter.slug);
        }

        return mergedCharacter;
      });

      setParty(reconciledParty);
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
      if (npcCombatExpectedRef.current && !liveValuesEqual(npcData, npcCombatExpectedRef.current)) {
        // Keep optimistic NPC state until server catches up or write fails.
      } else {
        if (npcCombatExpectedRef.current && liveValuesEqual(npcData, npcCombatExpectedRef.current)) {
          npcCombatExpectedRef.current = null;
        }
        setNpcCombat(npcData);
      }
      setRollHistory(rollHistoryData.rolls || []);
      setMapLibrary(mapLibraryData || { activeMapId: null, activeMapView: null, maps: [] });
      reportServerBuildVersion(sessionData.buildVersion);
    } catch {
      // Show stale data rather than error on poll failure.
    } finally {
      activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
    }
  }, [dmPassword]);

  const queueDashboardRefresh = useQueuedRefresh(fetchDashboardData);

  // Story 36 — WebSocket nudge channel. When connected, a "changed" push
  // triggers an immediate refetch and the adaptive poll interval relaxes to
  // the 30s safety net; when not connected, ADR-011 cadence resumes unchanged.
  const handleSessionChanged = useCallback(() => queueDashboardRefresh(0), [queueDashboardRefresh]);
  const { connected: wsConnected } = useSessionSocket(handleSessionChanged);

  const applyPartyOptimisticUpdates = useCallback((updates) => {
    if (!Array.isArray(updates) || updates.length === 0) return;

    const updatesBySlug = new Map(
      updates
        .filter((update) => update && typeof update.slug === "string" && update.slug.trim())
        .map((update) => [update.slug, update])
    );

    updatesBySlug.forEach((update, slug) => {
      const expectedFields = partyExpectedValuesRef.current.get(slug) || new Map();
      Object.entries(update).forEach(([fieldName, fieldValue]) => {
        if (fieldName === "slug") return;
        expectedFields.set(fieldName, cloneLiveValue(fieldValue));
      });
      if (expectedFields.size > 0) {
        partyExpectedValuesRef.current.set(slug, expectedFields);
      }
    });

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
      npcCombatExpectedRef.current = normalized;
      setNpcCombat(normalized);
    }

    try {
      await putNpcCombat(dmPassword, normalized);
      npcCombatServerRef.current = normalized;
      queueDashboardRefresh(0);
      return true;
    } catch {
      npcCombatExpectedRef.current = null;
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
    npcCombatExpectedRef.current = updatedNpcCombat;
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
      npcCombatExpectedRef.current = null;
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
    npcCombatExpectedRef.current = updatedNpcCombat;
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
      npcCombatExpectedRef.current = null;
      setInitiative(initiativeServerRef.current);
      setNpcCombat(npcCombatServerRef.current);
      queueDashboardRefresh(0);
    }
  }, [dmPassword, initiative, npcCombat, queueDashboardRefresh]);

  // handleSaveToLibrary — called by NpcCombatSection with up to 4 args:
  //   (npc, existingEntry)           — save/update from ⋯ overflow menu
  //   (null, null, bumpedTemplate)   — MRU bump on library picker select
  //   (null, null, null, deleteId)   — delete from library picker
  const handleSaveToLibrary = useCallback(async (npc, existingEntry, bumpedTemplate, deleteId) => {
    if (!dmPassword) return;
    const now = new Date().toISOString();
    const current = npcLibrary.templates || [];
    let nextTemplates;

    if (deleteId) {
      // Delete a template by id
      nextTemplates = current.filter((t) => t.id !== deleteId);
    } else if (bumpedTemplate) {
      // MRU bump: update updatedAt for the selected template
      nextTemplates = current.map((t) =>
        t.id === bumpedTemplate.id ? { ...t, updatedAt: bumpedTemplate.updatedAt || now } : t
      );
    } else if (existingEntry) {
      // Update existing template from ⋯ overflow
      nextTemplates = current.map((t) =>
        t.id === existingEntry.id
          ? {
              ...t,
              name: npc.name ?? t.name,
              hpMax: Number.isFinite(npc.hpMax) ? npc.hpMax : t.hpMax,
              abilities: Array.isArray(npc.abilities) ? npc.abilities : t.abilities,
              portraitUrl: typeof npc.portraitUrl === "string" ? npc.portraitUrl : t.portraitUrl,
              updatedAt: now,
            }
          : t
      );
    } else if (npc) {
      // Create new template from ⋯ overflow (fresh save)
      const newEntry = {
        id: "tpl-" + Date.now() + Math.random().toString(36).slice(2, 6),
        name: npc.name || "Unnamed",
        hpMax: Number.isFinite(npc.hpMax) ? npc.hpMax : null,
        abilities: Array.isArray(npc.abilities) ? npc.abilities : [],
        portraitUrl: typeof npc.portraitUrl === "string" ? npc.portraitUrl : null,
        updatedAt: now,
      };
      nextTemplates = [newEntry, ...current];
    } else {
      return;
    }

    setNpcLibrary({ templates: nextTemplates });
    await putNpcLibrary(dmPassword, nextTemplates);
  }, [dmPassword, npcLibrary]);

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
        partyRosterExpectedRef.current = null;
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

  useEffect(() => {
    if (!authed || !dmPassword) return;
    getNpcLibrary(dmPassword)
      .then((data) => setNpcLibrary(data || { templates: [] }))
      .catch(() => {});
  }, [authed, dmPassword]); // eslint-disable-line react-hooks/exhaustive-deps

  useAdaptivePolling({
    enabled: authed,
    poll: fetchDashboardData,
    activeMs: wsConnected ? BACKGROUND_POLL_MS : ACTIVE_POLL_MS,
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

  async function handleSavePartyRoster(members, nextPartyVisibilityEnabled) {
    if (!dmPassword) throw new Error("DM password required");

    const nextMembers = [...members];
    setPartyRoster(nextMembers);
    partyRosterExpectedRef.current = nextMembers;
    if (typeof nextPartyVisibilityEnabled === "boolean") {
      setPartyVisibilityEnabled(nextPartyVisibilityEnabled);
    }

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
      await putPartyRoster(nextMembers, dmPassword, typeof nextPartyVisibilityEnabled === "boolean" ? nextPartyVisibilityEnabled : partyVisibilityEnabled);
      if (!initiativesEqual(initiative, nextInitiative)) {
        await commitInitiativeUpdate(nextInitiative, { optimistic: false });
      }
      await fetchRosterContext();
      queueDashboardRefresh(0);
    } catch (err) {
      partyRosterExpectedRef.current = null;
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

  async function handleSetActiveTurnForSlug(slug) {
    const entries = initiative.entries || [];
    const nextIndex = entries.findIndex((entry) => entry.slug === slug);
    if (nextIndex < 0) return;
    await commitInitiativeUpdate({ entries, activeTurnIndex: nextIndex }, { optimistic: true });
  }

  function toggleCombatMode() {
    clearTransitionSteps();

    // Dual map memory: record the outgoing mode's active map, restore the incoming mode's
    const enteringCombat = !combatMode;
    const outgoingKey = enteringCombat ? ADVENTURE_MAP_KEY : BATTLE_MAP_KEY;
    const incomingKey = enteringCombat ? BATTLE_MAP_KEY : ADVENTURE_MAP_KEY;
    const currentActiveMapId = mapLibrary.activeMapId;
    if (currentActiveMapId) sessionStorage.setItem(outgoingKey, currentActiveMapId);
    const storedId = sessionStorage.getItem(incomingKey);
    const incomingMap = storedId ? (mapLibrary.maps || []).find((m) => m.id === storedId) : null;
    if (incomingMap && incomingMap.id !== currentActiveMapId) {
      putMapActive(incomingMap.id, dmPassword).then(() => queueDashboardRefresh(0)).catch(() => {});
    }

    if (!combatMode) {
      setCombatMode(true);
      setMapCollapsed(true);
      setNonCombatChromeVisible(false);
      setDiceVisible(false);
      setWheelsVisible(false);
      queueTransitionStep(() => {
        triggerCardFlip(true);
      }, MAP_TRANSITION_MS);
      queueTransitionStep(() => {
        setDiceLayoutActive(true);
      }, MAP_TRANSITION_MS + DICE_EXIT_MS);
      queueTransitionStep(() => {
        setCardsCompact(true);
        setCombatPanelsVisible(true);
      }, MAP_TRANSITION_MS + CARD_FLIP_MS);
      queueTransitionStep(() => {
        setDiceVisible(true);
      }, MAP_TRANSITION_MS + CARD_FLIP_MS + 120);
      queueTransitionStep(() => {
        setWheelsVisible(true);
      }, MAP_TRANSITION_MS + CARD_FLIP_MS + 180);
      return;
    }

    setCombatMode(false);
    setCombatPanelsVisible(false);
    setDiceVisible(false);
    queueTransitionStep(() => {
      setWheelsVisible(false);
    }, 60);
    queueTransitionStep(() => {
      setDiceLayoutActive(false);
      setCardsCompact(false);
    }, DICE_EXIT_MS);
    queueTransitionStep(() => {
      triggerCardFlip(false);
    }, DICE_EXIT_MS + CARD_COMPACT_MS);
    queueTransitionStep(() => {
      setDiceVisible(true);
      setWheelsVisible(true);
    }, DICE_EXIT_MS + CARD_COMPACT_MS + 120);
    queueTransitionStep(() => {
      setMapCollapsed(false);
      setNonCombatChromeVisible(true);
    }, DICE_EXIT_MS + CARD_COMPACT_MS + 120 + DICE_ENTER_MS);
  }

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt onSuccess={handleLoginSuccess} checking={authState === "checking"} />
      </PalCtx.Provider>
    );
  }

  const topButtonStyle = {
    background: "transparent",
    border: "1px solid rgba(100,130,160,0.32)",
    borderRadius: 3,
    color: pal.textMuted,
    fontFamily: pal.fontUI,
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "7px 14px",
    cursor: "pointer",
    transition: "border-color 0.18s, color 0.18s, background 0.18s",
  };
  const panelStyle = {
    background: pal.surface,
    border: `1px solid ${pal.border}`,
    borderRadius: 5,
    overflow: "hidden",
  };
  const activeEntry = (initiative.entries || [])[initiative.activeTurnIndex ?? 0];
  const activeTurnSlug = activeEntry?.slug ?? null;
  const partyHasXp = party.some((character) => (character.levelingMode || "milestone") === "xp");
  const partyCardItems = party.length === 0 ? (
    <div style={{ ...panelStyle, padding: "20px 16px", fontFamily: pal.fontUI, fontSize: 13, color: pal.textMuted }}>
      No characters found.
    </div>
  ) : (
    party.map((char) => (
      <div
        key={char.slug}
        className="dm-prototype-card-item"
        style={{ zIndex: openCardPopoverSlug === char.slug ? 260 : 0 }}
        ref={(node) => {
          if (node) cardItemRefs.current.set(char.slug, node);
          else cardItemRefs.current.delete(char.slug);
        }}
      >
        <CharacterCard
          char={char}
          dmPassword={dmPassword}
          onUpdate={handleCardUpdate}
          onCommitSessionUpdates={commitPartySessionUpdates}
          onRegisterOpen={handleRegisterOpen}
          onPopoverOpenChange={(open) => {
            setOpenCardPopoverSlug((current) => {
              if (open) return char.slug;
              return current === char.slug ? null : current;
            });
          }}
          isActiveTurn={combatLayoutActive && activeTurnSlug === char.slug}
          dimmed={combatLayoutActive && !!activeTurnSlug && activeTurnSlug !== char.slug}
          showTier2={!cardsCompact}
          onHeaderClick={combatLayoutActive ? () => handleSetActiveTurnForSlug(char.slug) : undefined}
          allParty={party}
        />
      </div>
    ))
  );
  const partyActionButtons = [
    {
      key: "short-rest",
      label: "Short Rest",
      action: () => setConfirmDialog({
        title: "Short Rest",
        message: "Reset Pact Magic (Warlock) spell slots for all characters. Standard spell slots and HP are not affected.",
        onConfirm: doShortRest,
      }),
    },
    {
      key: "long-rest",
      label: "Long Rest",
      action: () => setConfirmDialog({
        title: "Long Rest",
        message: "Reset all spell slots and restore all characters to max HP. This cannot be undone.",
        onConfirm: doLongRest,
      }),
    },
  ];
  const roundedTextScalePct = Math.round(textScale * 100);
  const canDecreaseTextScale = textScale > TEXT_SCALE_MIN;
  const canIncreaseTextScale = textScale < TEXT_SCALE_MAX;


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
  };

  return (
    <PalCtx.Provider value={pal}>
      <WorldGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} pal={pal} />
      <div style={{
        ...palVars,
        background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%), ${pal.bg}`,
        minHeight: "100vh",
        color: pal.text,
        fontFamily: pal.fontBody,
        WebkitFontSmoothing: "antialiased",
        zoom: textScale,
      }}>
        <TopNav
          backTo="/"
          title="Campaign"
          center={(
            <NavSegment
              options={[
                { key: "adventure", label: "Adventure" },
                { key: "battle", label: "Combat" },
              ]}
              value={combatMode ? "battle" : "adventure"}
              onChange={(key) => { if ((key === "battle") !== combatMode) toggleCombatMode(); }}
            />
          )}
          showLive={true}
          wsConnected={wsConnected}
          onBookClick={() => setGuideOpen((o) => !o)}
          bookOpen={guideOpen}
          menuItems={[
            { label: combatMode ? "✕ End Combat" : "⚔ Start Combat", onClick: toggleCombatMode },
            { label: "Manage Party", onClick: () => setShowManageParty(true) },
            { label: "Enemies Gallery", onClick: () => setShowEnemiesGallery(true) },
            { divider: true },
            {
              stepper: true,
              label: "Text Size",
              value: `${roundedTextScalePct}%`,
              onDecrement: () => setTextScale((current) => clampTextScale(Number((current - TEXT_SCALE_STEP).toFixed(2)))),
              onIncrement: () => setTextScale((current) => clampTextScale(Number((current + TEXT_SCALE_STEP).toFixed(2)))),
            },
            { divider: true },
            { label: "Sign Out", onClick: handleEndSession, destructive: true },
          ]}
        />

        <div style={{ maxWidth: 1720, margin: "0 auto", padding: "20px 20px 56px" }}>
          {restNotice && (
            <div style={{ marginBottom: 12, fontFamily: pal.fontUI, fontSize: 11, color: "#88c888", letterSpacing: "0.08em" }}>
              {restNotice}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <MapPanel
              mapLibrary={mapLibrary}
              dmPassword={dmPassword}
              pal={pal}
              collapsedOverride={mapCollapsed}
              onLibraryChange={() => fetchDashboardData({ background: true, force: true })}
              party={party}
              npcCombat={npcCombat}
              combatMode={combatMode}
              onRegisterBattleToggle={(fn) => { battleToggleFnRef.current = fn; }}
            />
          </div>

          <div
            className="dm-prototype-shell"
            data-combat={combatLayoutActive ? "true" : "false"}
            data-dice-combat={diceLayoutActive ? "true" : "false"}
            data-dice-visible={diceVisible ? "true" : "false"}
            data-wheels-visible={wheelsVisible ? "true" : "false"}
            data-chrome={nonCombatChromeVisible ? "true" : "false"}
            data-panels={combatPanelsVisible ? "true" : "false"}
          >
            <div className="dm-prototype-cards-panel">
              <div className="dm-prototype-cards">
                {partyCardItems}
              </div>
            </div>

            <div
              className="dm-prototype-party-actions"
              style={{
                overflow: "hidden",
                maxHeight: nonCombatChromeVisible ? 160 : 0,
                opacity: nonCombatChromeVisible ? 1 : 0,
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={toggleCombatMode}
                  style={{ ...topButtonStyle, borderColor: "rgba(90,138,96,0.5)", color: "#88b888" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#88b888"; e.currentTarget.style.color = "#88b888"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(90,138,96,0.5)"; e.currentTarget.style.color = "#88b888"; }}
                >Start Combat</button>
                {partyActionButtons.map(({ key, label, action }) => (
                  <button
                    key={key}
                    onClick={action}
                    style={{ ...topButtonStyle, minWidth: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accentBright; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.color = pal.textMuted; }}
                  >{label}</button>
                ))}
                {partyHasXp && (
                  <button
                    onClick={() => setShowAwardXpParty(true)}
                    style={topButtonStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accentBright; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.color = pal.textMuted; }}
                  >Award XP</button>
                )}
                <button
                  onClick={() => setShowDistributeCoinParty(true)}
                  style={{ ...topButtonStyle, borderColor: "rgba(200,160,64,0.3)", color: "rgba(200,160,64,0.75)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a040"; e.currentTarget.style.color = "#c8a040"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(200,160,64,0.3)"; e.currentTarget.style.color = "rgba(200,160,64,0.75)"; }}
                >Distribute Coin</button>
              </div>
            </div>

            <div className="dm-prototype-col2-stack">
              <div className="dm-prototype-wheels-wrapper">
                <CounterWheelsPanel
                  pal={pal}
                  dmPassword={dmPassword}
                  initiativeEntries={initiative.entries}
                />
              </div>

              <div className="dm-prototype-dice-panel">
                <DmDiceRoller
                  pal={pal}
                  party={party.map((character) => ({ slug: character.slug, name: character.name, palette: character.palette }))}
                  npcs={(npcCombat.npcs || []).map((npc) => ({ id: npc.id, name: npc.name }))}
                  dmPassword={dmPassword}
                  onApplyDamage={handleApplyDamage}
                  onApplyNpcDamage={handleApplyNpcDamage}
                  remoteHistory={rollHistory}
                  marginTop={0}
                />
              </div>
            </div>

            <div className="dm-prototype-side-panel">
              <div className="dm-prototype-side-col">
                <InitiativeTracker
                  initiative={initiative}
                  party={party}
                  npcCombat={npcCombat}
                  onCommitInitiative={commitInitiativeUpdate}
                  onPromoteToNpc={handlePromoteToNpc}
                />
                <NpcCombatSection
                  npcCombat={npcCombat}
                  initiative={initiative}
                  dmPassword={dmPassword}
                  onUpdate={() => queueDashboardRefresh(0)}
                  onCommitNpcCombat={commitNpcCombatUpdate}
                  onAddNpcToInitiative={handleAddNpcToInitiative}
                  onRemoveNpcFromInitiative={handleRemoveNpcFromInitiative}
                  showEndCombatButton={false}
                  npcLibrary={npcLibrary}
                  onSaveToLibrary={handleSaveToLibrary}
                  onOpenEnemiesGallery={() => setShowEnemiesGallery(true)}
                />
              </div>
            </div>
          </div>

          <div
            className="dm-prototype-map-strip"
            style={{
              overflow: "hidden",
              maxHeight: nonCombatChromeVisible ? 200 : 0,
              opacity: nonCombatChromeVisible ? 1 : 0,
              transition: "max-height 0.22s ease-in, opacity 0.22s ease-in",
              marginTop: 18,
            }}
          >
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
            partyVisibilityEnabled={partyVisibilityEnabled}
            onClose={() => setShowManageParty(false)}
            onSave={handleSavePartyRoster}
          />
        )}

        {showEnemiesGallery && (
          <EnemiesGalleryModal
            templates={npcLibrary.templates || []}
            dmPassword={dmPassword}
            onClose={() => setShowEnemiesGallery(false)}
            onTemplatesChange={(nextTemplates) => {
              setNpcLibrary({ templates: nextTemplates });
            }}
          />
        )}
      </div>
    </PalCtx.Provider>
  );
}
