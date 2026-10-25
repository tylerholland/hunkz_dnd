import { usePortraitPosition } from "../lib/usePortraitPosition";

/**
 * A character portrait <img> for round frames (avatars, tokens) that centres
 * the character's `portraitFocus` when they have one. Other props pass
 * through; a passed `style` is kept.
 */
export default function PortraitImg({ src, focus, style, onLoad, ...rest }) {
  const framing = usePortraitPosition(src, focus);
  return (
    <img
      src={src}
      {...rest}
      style={framing.objectPosition ? { ...style, objectPosition: framing.objectPosition } : style}
      onLoad={(e) => { framing.onLoad?.(e); onLoad?.(e); }}
    />
  );
}
