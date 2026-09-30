import { useEffect, useState } from "react";
import { listCharacters, verifyPassword } from "../../api";

// Story 69 follow-up — a Chronicle link opened in a fresh tab (e.g. shared in
// chat) has no saved sign-in, so the page is read-only. This lets a player
// unlock their character right here, the same way the character sheet does:
// the password goes into this tab's sessionStorage.
export default function ChronicleSignIn({ onSignedIn }) {
  const [characters, setCharacters] = useState([]);
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listCharacters()
      .then((list) => {
        if (cancelled) return;
        const sorted = (list || [])
          .filter((c) => c?.slug)
          .sort((a, b) => String(a.name || a.slug).localeCompare(String(b.name || b.slug)));
        setCharacters(sorted);
      })
      .catch(() => { if (!cancelled) setError("Couldn't load the character list."); });
    return () => { cancelled = true; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!slug || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyPassword(slug, password);
      if (!result?.valid) {
        setError("That password didn't work.");
        return;
      }
      try {
        if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", password);
        else sessionStorage.setItem(`dnd_char_${slug}`, password);
      } catch {
        setError("This browser won't let the page remember your sign-in.");
        return;
      }
      onSignedIn?.(slug);
    } catch {
      setError("Couldn't check the password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="chr-signin" onSubmit={submit} aria-labelledby="chr-signin-h">
      <p id="chr-signin-h" className="chr-signin-title">Sign in to add your recollections or edit the summary</p>
      <div className="chr-signin-row">
        <label className="chr-field">
          <span className="chr-label">Character</span>
          <select value={slug} onChange={(e) => { setSlug(e.target.value); setError(null); }}>
            <option value="" disabled>Choose…</option>
            {characters.map((c) => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}
          </select>
        </label>
        <label className="chr-field">
          <span className="chr-label">Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
        </label>
        <button type="submit" className="chr-btn chr-btn--primary" disabled={!slug || busy}>{busy ? "Checking…" : "Sign in"}</button>
      </div>
      {error && <p className="chr-error" role="alert">{error}</p>}
    </form>
  );
}
