const BASE = import.meta.env.VITE_API_URL;
const OPTIONAL_ENDPOINT_SUPPORT = {
  rollHistory: null,
  characterRolls: null,
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

async function requestOptional(path, options, supportKey, fallbackValue) {
  if (OPTIONAL_ENDPOINT_SUPPORT[supportKey] === false) {
    return typeof fallbackValue === "function" ? fallbackValue() : fallbackValue;
  }

  try {
    const data = await request(path, options);
    OPTIONAL_ENDPOINT_SUPPORT[supportKey] = true;
    return data;
  } catch (err) {
    if (err?.status === 404 || err instanceof TypeError) {
      OPTIONAL_ENDPOINT_SUPPORT[supportKey] = false;
      return typeof fallbackValue === "function" ? fallbackValue() : fallbackValue;
    }
    throw err;
  }
}

export const listCharacters = () =>
  request("/characters");

export const getCharacter = (slug) =>
  request(`/characters/${slug}`);

export const createCharacter = (charData, password) =>
  request("/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...charData, password }),
  });

export const updateCharacter = (slug, charData, password) =>
  request(`/characters/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify(charData),
  });

export const deleteCharacter = (slug, password) =>
  request(`/characters/${slug}`, {
    method: "DELETE",
    headers: { "x-character-password": password },
  });

export const verifyPassword = (slug, password) =>
  request(`/characters/${slug}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

export const postCharacterRoll = (slug, payload) =>
  requestOptional(`/characters/${slug}/rolls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "characterRolls", { success: false, unsupported: true });

export const getPortraitUploadUrl = (slug, password, contentType) =>
  request(`/characters/${slug}/portrait-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, contentType }),
  });

export const getDmParty = (dmPassword) =>
  request("/dm/party", {
    headers: { "x-character-password": dmPassword },
  });

export const getPartyRoster = () =>
  request("/party-roster");

export const putPartyRoster = (members, dmPassword) =>
  request("/party-roster", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify({ members }),
  });

export const patchSession = (slug, fields, password) =>
  request(`/characters/${slug}/session`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(password ? { "x-character-password": password } : {}),
    },
    body: JSON.stringify(fields),
  });

export const patchDmNote = (slug, action, dmPassword) =>
  request(`/characters/${slug}/dm-notes`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(action),
  });

export const getInitiative = (dmPassword) =>
  request("/initiative", {
    headers: { "x-character-password": dmPassword },
  });

export const putInitiative = (dmPassword, data) =>
  request("/initiative", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(data),
  });

export const getNpcCombat = (dmPassword) =>
  request("/npc-combat", {
    headers: { "x-character-password": dmPassword },
  });

export const putNpcCombat = (dmPassword, data) =>
  request("/npc-combat", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(data),
  });

export const getRollHistory = (dmPassword) =>
  requestOptional("/roll-history", {
    headers: { "x-character-password": dmPassword },
  }, "rollHistory", { rolls: [], unsupported: true });

export const getMapLibrary = () =>
  request("/maps");

export const presignMap = (filename, contentType, size, dmPassword) =>
  request("/maps/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ filename, contentType, size }),
  });

export const postMap = (mapData, dmPassword) =>
  request("/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify(mapData),
  });

export const putMapActive = (mapId, dmPassword) =>
  request("/maps/active", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ mapId }),
  });

export const putMapView = (mapView, dmPassword) =>
  request("/maps/view", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify(mapView),
  });

export const patchMap = (mapId, name, dmPassword) =>
  request(`/maps/${mapId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ name }),
  });

export const deleteMap = (mapId, dmPassword) =>
  request(`/maps/${mapId}`, {
    method: "DELETE",
    headers: { "x-character-password": dmPassword },
  });
