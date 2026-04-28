const BASE = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
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

export const getPortraitUploadUrl = (slug, password, contentType) =>
  request(`/characters/${slug}/portrait-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, contentType }),
  });
