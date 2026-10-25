import { useState } from "react";
import { focusObjectPosition, normalizeFocus } from "../features/home/portraitFocus";

// naturalWidth / naturalHeight by URL, so a remounted avatar frames itself at
// once instead of jumping when its image reloads from cache.
const aspectByUrl = new Map();

/**
 * Framing for a character portrait shown in a circle (tokens, avatars): with a
 * `portraitFocus` ({ x, y }), the object-position that centres it; without
 * one, nothing, so existing CSS framing is untouched. Spread `onLoad` onto the
 * <img> and put `objectPosition` in its style.
 */
export function usePortraitPosition(url, focus, { boxAspect = 1, targetY = 0.5 } = {}) {
  const [loaded, setLoaded] = useState({ url: null, aspect: 0 });
  const f = normalizeFocus(focus);
  const aspect = aspectByUrl.get(url) || (loaded.url === url ? loaded.aspect : 0);
  return {
    objectPosition: f && aspect ? focusObjectPosition(f, aspect, { boxAspect, targetY }) : undefined,
    onLoad: f
      ? (e) => {
          const a = e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1);
          if (!(a > 0)) return;
          aspectByUrl.set(url, a);
          setLoaded({ url, aspect: a });
        }
      : undefined,
  };
}
