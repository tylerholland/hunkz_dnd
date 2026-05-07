import { useState, useEffect, useRef, useCallback } from "react";
import { verifyPassword as apiVerify, updateCharacter, getPortraitUploadUrl, patchSession } from "../api";
import {
  BLANK_CHARACTER,
  LIVE_SESSION_FIELDS,
  parseModInt,
  uid,
} from "../features/characterSheet/constants";
import CharacterSheetEditMode from "../features/characterSheet/CharacterSheetEditMode";
import CharacterSheetViewMode from "../features/characterSheet/CharacterSheetViewMode";
import { PALETTES, useCharacterSheetGlobalStyles } from "../features/characterSheet/theme";
import {
  cloneLiveValue,
  mergeOptimisticLiveFields,
  useDebouncedOptimisticNumberFlush,
} from "../lib/liveSync";

export { PALETTES } from "../features/characterSheet/theme";

export default function CharacterSheet({ initialData, slug, onSave, onCreate, onDelete, onSessionSync }) {
  useCharacterSheetGlobalStyles();

  const [mode, setMode] = useState("view");
  const [char, setChar] = useState(() => initialData || BLANK_CHARACTER);
  const [active, setActive] = useState(() => {
    const first = (initialData || BLANK_CHARACTER).collections?.[0]?.sections?.[0];
    return first ? { collectionId: (initialData || BLANK_CHARACTER).collections[0].id, sectionId: first.id } : null;
  });

  const [dragInfo, setDragInfo] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const [unlockState, setUnlockState] = useState("locked");
  const [unlockIntent, setUnlockIntent] = useState("view");
  const [unlockChecking, setUnlockChecking] = useState(!!slug);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState(null);
  const [unlockedPassword, setUnlockedPassword] = useState(null);
  const [, setUnlockedRole] = useState(null);

  const [saveStatus, setSaveStatus] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [combatTab, setCombatTab] = useState(() => {
    if (slug) {
      const stored = sessionStorage.getItem(`dnd_tab_${slug}`);
      if (stored === "loadout" || stored === "persona" || stored === "combat") return stored;
    }
    return "combat";
  });
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [hoveredStat, setHoveredStat] = useState(null);

  const [hpEditMode, setHpEditMode] = useState(false);
  const [concSpellInput, setConcSpellInput] = useState("");

  const fileRef = useRef();
  const importRef = useRef();
  const charRef = useRef(initialData || BLANK_CHARACTER);
  const currentSlugRef = useRef(initialData?.slug || slug || null);
  const sessionExpectedRef = useRef(new Map());

  const hpPendingDelta = useRef(0);
  const hpServerRef = useRef(initialData?.hpCurrent ?? initialData?.hp ?? 0);
  const hpMaxRef = useRef(initialData?.hpMax ?? initialData?.hp ?? 0);
  const hpFlushInFlightRef = useRef(false);

  const exhPendingDelta = useRef(0);
  const exhServerRef = useRef(initialData?.exhaustionLevel ?? 0);
  const exhFlushInFlightRef = useRef(false);

  const tempHpServerRef = useRef(initialData?.tempHP ?? 0);
  const tempHpFlushInFlightRef = useRef(false);

  const pal = PALETTES[char.palette] || PALETTES.ember;

  useEffect(() => {
    charRef.current = char;
  }, [char]);

  const markSessionExpected = useCallback((fields) => {
    Object.entries(fields).forEach(([field, value]) => {
      sessionExpectedRef.current.set(field, cloneLiveValue(value));
    });
  }, []);

  const clearSessionExpected = useCallback((fields) => {
    fields.forEach((field) => sessionExpectedRef.current.delete(field));
  }, []);

  const requestSessionSync = useCallback(() => {
    onSessionSync?.();
  }, [onSessionSync]);

  const applySessionPatch = useCallback((fields, revertFields = null) => {
    if (!slug) return Promise.resolve();

    const fieldNames = Object.keys(fields);
    markSessionExpected(fields);

    return patchSession(slug, fields, null)
      .then(() => {
        if (Object.prototype.hasOwnProperty.call(fields, "hpCurrent")) hpServerRef.current = fields.hpCurrent;
        if (Object.prototype.hasOwnProperty.call(fields, "exhaustionLevel")) exhServerRef.current = fields.exhaustionLevel;
        if (Object.prototype.hasOwnProperty.call(fields, "tempHP")) tempHpServerRef.current = fields.tempHP;
        requestSessionSync();
      })
      .catch((err) => {
        clearSessionExpected(fieldNames);
        if (revertFields) {
          setChar((current) => ({ ...current, ...revertFields }));
        }
        throw err;
      });
  }, [clearSessionExpected, markSessionExpected, requestSessionSync, slug]);

  useEffect(() => {
    if (!slug) {
      setUnlockChecking(false);
      return;
    }

    const applyUnlock = (password, role) => {
      setUnlockedPassword(password);
      setUnlockedRole(role);
      setUnlockState("unlocked");
    };

    const tryVerify = async (password, onFail) => {
      try {
        const result = await apiVerify(slug, password);
        if (result.valid) {
          applyUnlock(password, result.role);
          if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", password);
          else sessionStorage.setItem(`dnd_char_${slug}`, password);
          return true;
        }
      } catch {}
      if (onFail) onFail();
      return false;
    };

    const dmPwd = sessionStorage.getItem("dnd_dm_password");
    const charPwd = sessionStorage.getItem(`dnd_char_${slug}`);

    const run = dmPwd
      ? tryVerify(dmPwd, () => sessionStorage.removeItem("dnd_dm_password"))
      : charPwd !== null
        ? tryVerify(charPwd, () => sessionStorage.removeItem(`dnd_char_${slug}`))
        : Promise.resolve(false);

    run.finally(() => setUnlockChecking(false));
  }, [slug]);

  useEffect(() => {
    if (!initialData) return;

    const incomingSlug = initialData.slug || slug || null;
    if (currentSlugRef.current !== incomingSlug) {
      currentSlugRef.current = incomingSlug;
      sessionExpectedRef.current.clear();
      setChar(initialData);
      charRef.current = initialData;
      hpServerRef.current = initialData.hpCurrent ?? initialData.hp ?? 0;
      hpMaxRef.current = initialData.hpMax ?? initialData.hp ?? 0;
      tempHpServerRef.current = initialData.tempHP ?? 0;
      exhServerRef.current = initialData.exhaustionLevel ?? 0;
      const first = initialData.collections?.[0]?.sections?.[0];
      setActive(first ? { collectionId: initialData.collections[0].id, sectionId: first.id } : null);
      return;
    }

    if (mode === "edit") return;

    setChar((prev) => mergeOptimisticLiveFields(prev, initialData, LIVE_SESSION_FIELDS, sessionExpectedRef));

    if (!sessionExpectedRef.current.has("hpCurrent")) {
      hpServerRef.current = initialData.hpCurrent ?? initialData.hp ?? 0;
    }
    if (!sessionExpectedRef.current.has("tempHP")) {
      tempHpServerRef.current = initialData.tempHP ?? 0;
    }
    if (!sessionExpectedRef.current.has("exhaustionLevel")) {
      exhServerRef.current = initialData.exhaustionLevel ?? 0;
    }
  }, [initialData, mode, slug]);

  useEffect(() => {
    if (!active) return;
    const collection = char.collections.find((item) => item.id === active.collectionId);
    if (!collection || !collection.sections.find((section) => section.id === active.sectionId)) {
      const first = char.collections[0]?.sections[0];
      setActive(first ? { collectionId: char.collections[0].id, sectionId: first.id } : null);
    }
  }, [char.collections, active]);

  const setTab = (tab) => {
    setCombatTab(tab);
    if (slug) sessionStorage.setItem(`dnd_tab_${slug}`, tab);
  };

  const update = (field, val) => setChar((current) => ({ ...current, [field]: val }));
  const updateStat = (index, field, val) => setChar((current) => {
    const stats = [...current.stats];
    stats[index] = { ...stats[index], [field]: field === "score" ? (parseInt(val, 10) || 0) : val };
    return { ...current, stats };
  });

  const updateCollection = (collectionId, field, val) => setChar((current) => ({
    ...current,
    collections: current.collections.map((collection) => collection.id === collectionId ? { ...collection, [field]: val } : collection),
  }));

  const addCollection = () => {
    const id = uid();
    setChar((current) => ({
      ...current,
      collections: [...current.collections, { id, label: "New Collection", sections: [] }],
    }));
  };

  const removeCollection = (collectionId) => {
    setChar((current) => ({
      ...current,
      collections: current.collections.filter((collection) => collection.id !== collectionId),
    }));
  };

  const updateSection = (collectionId, sectionId, field, val) => setChar((current) => ({
    ...current,
    collections: current.collections.map((collection) =>
      collection.id !== collectionId
        ? collection
        : {
            ...collection,
            sections: collection.sections.map((section) => section.id !== sectionId ? section : { ...section, [field]: val }),
          }
    ),
  }));

  const addSection = (collectionId, type = "prose") => {
    const id = uid();
    const newSection = type === "list"
      ? { id, title: "New Section", type: "list", items: [] }
      : { id, title: "New Section", type: "prose", content: "" };

    setChar((current) => ({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id !== collectionId ? collection : { ...collection, sections: [...collection.sections, newSection] }
      ),
    }));
    setTimeout(() => setActive({ collectionId, sectionId: id }), 50);
  };

  const removeSection = (collectionId, sectionId) => {
    setChar((current) => ({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id !== collectionId
          ? collection
          : { ...collection, sections: collection.sections.filter((section) => section.id !== sectionId) }
      ),
    }));
    setActive(null);
  };

  const updateListItem = (collectionId, sectionId, index, val) => setChar((current) => ({
    ...current,
    collections: current.collections.map((collection) =>
      collection.id !== collectionId
        ? collection
        : {
            ...collection,
            sections: collection.sections.map((section) => {
              if (section.id !== sectionId) return section;
              const items = [...section.items];
              items[index] = val;
              return { ...section, items };
            }),
          }
    ),
  }));

  const addListItem = (collectionId, sectionId) => setChar((current) => ({
    ...current,
    collections: current.collections.map((collection) =>
      collection.id !== collectionId
        ? collection
        : {
            ...collection,
            sections: collection.sections.map((section) => section.id !== sectionId ? section : { ...section, items: [...section.items, ""] }),
          }
    ),
  }));

  const removeListItem = (collectionId, sectionId, index) => setChar((current) => ({
    ...current,
    collections: current.collections.map((collection) =>
      collection.id !== collectionId
        ? collection
        : {
            ...collection,
            sections: collection.sections.map((section) =>
              section.id !== sectionId ? section : { ...section, items: section.items.filter((_, itemIndex) => itemIndex !== index) }
            ),
          }
    ),
  }));

  const updateInPlay = (index, val) => setChar((current) => {
    const inPlay = [...current.inPlay];
    inPlay[index] = val;
    return { ...current, inPlay };
  });
  const addInPlay = () => setChar((current) => ({ ...current, inPlay: [...current.inPlay, ""] }));
  const removeInPlay = (index) => setChar((current) => ({ ...current, inPlay: current.inPlay.filter((_, itemIndex) => itemIndex !== index) }));

  const addWeapon = (item) => setChar((current) => ({ ...current, weapons: [...(current.weapons || []), item] }));
  const updateWeapon = (id, item) => setChar((current) => ({ ...current, weapons: (current.weapons || []).map((weapon) => weapon.id === id ? item : weapon) }));
  const removeWeapon = (id) => setChar((current) => ({ ...current, weapons: (current.weapons || []).filter((weapon) => weapon.id !== id) }));

  const addEquipment = (item) => setChar((current) => ({ ...current, equipment: [...(current.equipment || []), item] }));
  const updateEquipment = (id, item) => setChar((current) => ({ ...current, equipment: (current.equipment || []).map((entry) => entry.id === id ? item : entry) }));
  const removeEquipment = (id) => setChar((current) => ({ ...current, equipment: (current.equipment || []).filter((entry) => entry.id !== id) }));

  const toggleExpanded = (id) => setExpandedItems((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const onDragStart = (collectionId, index) => setDragInfo({ collectionId, fromIdx: index });
  const onDragOver = (e, collectionId, index) => {
    e.preventDefault();
    setDragOver({ collectionId, toIdx: index });
  };
  const onDrop = (collectionId, index) => {
    if (!dragInfo || dragInfo.collectionId !== collectionId || dragInfo.fromIdx === index) {
      setDragInfo(null);
      setDragOver(null);
      return;
    }

    setChar((current) => ({
      ...current,
      collections: current.collections.map((collection) => {
        if (collection.id !== collectionId) return collection;
        const sections = [...collection.sections];
        const [moved] = sections.splice(dragInfo.fromIdx, 1);
        sections.splice(index, 0, moved);
        return { ...collection, sections };
      }),
    }));
    setDragInfo(null);
    setDragOver(null);
  };

  const handlePortrait = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (slug && unlockedPassword) {
      try {
        const { uploadUrl, portraitUrl } = await getPortraitUploadUrl(slug, unlockedPassword, file.type);
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        update("portraitUrl", portraitUrl);
        update("portrait", "");
        updateCharacter(slug, { portraitUrl, portrait: "" }, unlockedPassword).catch(() => {});
      } catch {
        alert("Portrait upload failed. Please try again.");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => update("portrait", event.target.result);
    reader.readAsDataURL(file);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(char, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(char.name || "character").toLowerCase().replace(/\s+/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setChar(data);
        const first = data.collections?.[0]?.sections?.[0];
        setActive(first ? { collectionId: data.collections[0].id, sectionId: first.id } : null);
        setMode("view");
      } catch {
        alert("Could not parse JSON file. Please check the file and try again.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setUnlockError(null);
    try {
      const result = await apiVerify(slug, unlockInput);
      if (result.valid) {
        setUnlockedPassword(unlockInput);
        setUnlockedRole(result.role);
        setUnlockState("unlocked");
        if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", unlockInput);
        else sessionStorage.setItem(`dnd_char_${slug}`, unlockInput);
        if (unlockIntent === "edit") setMode("edit");
        if (unlockIntent === "delete") setDeleteConfirm(true);
        setUnlockInput("");
      } else {
        setUnlockError("Incorrect password.");
      }
    } catch {
      setUnlockError("Could not verify password. Please try again.");
    }
  };

  const handleEditClick = async () => {
    if (!slug) {
      setMode("edit");
      return;
    }
    if (unlockState === "unlocked") {
      setMode("edit");
      return;
    }
    setUnlockIntent("edit");
    setUnlockLoading(true);
    const result = await apiVerify(slug, "").catch(() => ({ valid: false }));
    setUnlockLoading(false);
    if (result.valid) {
      setUnlockedPassword("");
      setUnlockedRole(result.role);
      setUnlockState("unlocked");
      if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", "");
      else sessionStorage.setItem(`dnd_char_${slug}`, "");
      setMode("edit");
    } else {
      setUnlockState("prompting");
    }
  };

  const handleViewUnlock = async () => {
    setUnlockIntent("view");
    setUnlockLoading(true);
    const result = await apiVerify(slug, "").catch(() => ({ valid: false }));
    setUnlockLoading(false);
    if (result.valid) {
      setUnlockedPassword("");
      setUnlockedRole(result.role);
      setUnlockState("unlocked");
      if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", "");
      else sessionStorage.setItem(`dnd_char_${slug}`, "");
    } else {
      setUnlockState("prompting");
    }
  };

  const handleCancelUnlock = () => {
    setUnlockState("locked");
    setUnlockInput("");
    setUnlockError(null);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaveStatus("saving");
    try {
      await onSave(char, unlockedPassword);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      setSaveStatus("error");
      alert(`Save failed: ${err.message}`);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const deletePhrase = char.name ? `DELETE ${char.name}${char.charClass ? ` ${char.charClass}` : ""}` : "";
  const handleDeleteRequest = () => {
    if (!onDelete) return;
    if (unlockState !== "unlocked") {
      setUnlockIntent("delete");
      setUnlockState("prompting");
      return;
    }
    setDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!onDelete || deleteInput !== deletePhrase) return;
    setDeleteStatus("deleting");
    try {
      await onDelete(unlockedPassword);
    } catch (err) {
      setDeleteStatus("error");
      alert(`Delete failed: ${err.message}`);
      setTimeout(() => setDeleteStatus(null), 3000);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(false);
    setDeleteInput("");
    setDeleteStatus(null);
  };

  const _itemBonuses = {};
  [...(char.weapons || []), ...(char.equipment || [])].forEach((item) => {
    (item.mods || []).forEach(({ attribute, value }) => {
      const parsed = parseModInt(value);
      if (!isNaN(parsed)) _itemBonuses[attribute] = (_itemBonuses[attribute] || 0) + parsed;
    });
  });

  const hpBonus = _itemBonuses.HP || 0;
  const hpMax = (char.hpMax ?? char.hp ?? 0) + hpBonus;
  const hpCurrent = char.hpCurrent ?? char.hp ?? 0;
  const tempHP = char.tempHP ?? 0;
  const hpPct = hpMax > 0 ? hpCurrent / hpMax : 0;
  const hpBarColor = hpPct > 0.5 ? pal.gem : hpPct > 0.2 ? "#c8a030" : "#c06060";
  const isActiveTurn = !!char.isActiveTurn;

  useEffect(() => {
    hpMaxRef.current = hpMax;
  }, [hpMax]);

  const getTargetHp = useCallback(
    () => Math.max(0, Math.min(hpMaxRef.current, charRef.current.hpCurrent ?? charRef.current.hp ?? 0)),
    []
  );
  const commitHp = useCallback(
    (targetHp) => patchSession(slug, { hpCurrent: targetHp }, null),
    [slug]
  );
  const rollbackHp = useCallback(
    (previousServerHp) => setChar((current) => ({ ...current, hpCurrent: previousServerHp })),
    []
  );
  const sharedFlushOptions = {
    enabled: !!slug,
    delay: 300,
    markExpected: markSessionExpected,
    clearExpected: clearSessionExpected,
    requestSync: requestSessionSync,
  };

  const hpFlushRef = useDebouncedOptimisticNumberFlush({
    ...sharedFlushOptions,
    fieldName: "hpCurrent",
    getTargetValue: getTargetHp,
    serverValueRef: hpServerRef,
    inFlightRef: hpFlushInFlightRef,
    pendingDeltaRef: hpPendingDelta,
    commitValue: commitHp,
    setLocalValue: rollbackHp,
  });

  const getTargetExhaustion = useCallback(
    () => Math.max(0, Math.min(6, charRef.current.exhaustionLevel || 0)),
    []
  );
  const commitExhaustion = useCallback(
    (targetExhaustion) => patchSession(slug, { exhaustionLevel: targetExhaustion }, null),
    [slug]
  );
  const rollbackExhaustion = useCallback(
    (previousServerExhaustion) => setChar((current) => ({ ...current, exhaustionLevel: previousServerExhaustion })),
    []
  );
  const exhFlushRef = useDebouncedOptimisticNumberFlush({
    ...sharedFlushOptions,
    fieldName: "exhaustionLevel",
    getTargetValue: getTargetExhaustion,
    serverValueRef: exhServerRef,
    inFlightRef: exhFlushInFlightRef,
    pendingDeltaRef: exhPendingDelta,
    commitValue: commitExhaustion,
    setLocalValue: rollbackExhaustion,
  });

  const getTargetTempHp = useCallback(
    () => Math.max(0, charRef.current.tempHP ?? 0),
    []
  );
  const commitTempHp = useCallback(
    (targetTempHp) => patchSession(slug, { tempHP: targetTempHp }, null),
    [slug]
  );
  const rollbackTempHp = useCallback(
    (previousServerTempHp) => setChar((current) => ({ ...current, tempHP: previousServerTempHp })),
    []
  );
  const tempHpFlushRef = useDebouncedOptimisticNumberFlush({
    ...sharedFlushOptions,
    fieldName: "tempHP",
    getTargetValue: getTargetTempHp,
    serverValueRef: tempHpServerRef,
    inFlightRef: tempHpFlushInFlightRef,
    commitValue: commitTempHp,
    setLocalValue: rollbackTempHp,
  });

  const inputBg = pal.surface;
  const inputStyle = {
    background: inputBg,
    border: `1px solid ${pal.border}`,
    borderRadius: 3,
    color: pal.text,
    fontFamily: pal.fontBody,
    fontSize: 16,
    padding: "7px 11px",
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s",
  };
  const taStyle = { ...inputStyle, resize: "vertical", minHeight: 130, lineHeight: 1.75 };
  const lbl = {
    fontFamily: pal.fontUI,
    fontSize: 14,
    letterSpacing: "0.22em",
    color: pal.textMuted,
    textTransform: "uppercase",
    display: "block",
    marginBottom: 6,
  };
  const secHead = {
    fontFamily: pal.fontUI,
    fontSize: 14,
    letterSpacing: "0.25em",
    color: pal.textMuted,
    textTransform: "uppercase",
    marginBottom: 16,
  };
  const rootWrap = {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
    backgroundColor: pal.bg,
    color: pal.text,
    fontFamily: pal.fontBody,
    fontSize: 16,
    lineHeight: 1.7,
    overflowX: "hidden",
    "--phoenetic-color": pal.accent,
    "--input-bg": inputBg,
    "--input-border": pal.border,
    "--input-color": pal.text,
    "--input-highlight": pal.surface,
  };
  const navBtn = (activeButton) => ({
    padding: "6px 16px",
    fontFamily: pal.fontUI,
    fontSize: 14,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    background: activeButton ? pal.accentDim : "transparent",
    border: `1px solid ${activeButton ? pal.accent : pal.border}`,
    borderRadius: 2,
    color: activeButton ? pal.accentBright : pal.textMuted,
    cursor: "pointer",
    transition: "all 0.18s",
  });

  const activeCol = char.collections.find((collection) => collection.id === active?.collectionId);
  const activeSec = activeCol?.sections.find((section) => section.id === active?.sectionId);

  const sheetCtx = {
    rootWrap,
    pal,
    secHead,
    char,
    importRef,
    importJSON,
    slug,
    onSave,
    handleSave,
    saveStatus,
    onCreate,
    setMenuOpen,
    menuOpen,
    exportJSON,
    handleDeleteRequest,
    onDelete,
    setMode,
    deleteConfirm,
    deletePhrase,
    deleteInput,
    setDeleteInput,
    inputStyle,
    cancelDelete,
    handleDelete,
    deleteStatus,
    update,
    fileRef,
    handlePortrait,
    lbl,
    updateStat,
    addInPlay,
    updateInPlay,
    removeInPlay,
    setEditingItem,
    removeWeapon,
    removeEquipment,
    unlockedPassword,
    setUnlockedPassword,
    addCollection,
    updateCollection,
    removeCollection,
    dragInfo,
    dragOver,
    onDragStart,
    onDragOver,
    onDrop,
    setDragInfo,
    setDragOver,
    updateSection,
    removeSection,
    taStyle,
    updateListItem,
    removeListItem,
    addListItem,
    addSection,
    editingItem,
    updateWeapon,
    addWeapon,
    updateEquipment,
    addEquipment,
    handleEditClick,
    unlockLoading,
    unlockChecking,
    unlockState,
    unlockIntent,
    unlockInput,
    setUnlockInput,
    unlockError,
    handleCancelUnlock,
    handleUnlockSubmit,
    handleViewUnlock,
    active,
    setActive,
    activeSec,
    navBtn,
    applySessionPatch,
    setChar,
    markSessionExpected,
    hpFlushRef,
    hpPendingDelta,
    tempHpFlushRef,
    exhFlushRef,
    exhPendingDelta,
    concSpellInput,
    setConcSpellInput,
    hpEditMode,
    setHpEditMode,
    hpMax,
    hpCurrent,
    tempHP,
    hpPct,
    hpBarColor,
    hpBonus,
    _itemBonuses,
    isActiveTurn,
    expandedItems,
    setExpandedItems,
    toggleExpanded,
    hoveredStat,
    setHoveredStat,
    combatTab,
    setTab,
  };

  if (mode === "edit") {
    return <CharacterSheetEditMode ctx={sheetCtx} />;
  }

  return <CharacterSheetViewMode ctx={sheetCtx} />;
}
