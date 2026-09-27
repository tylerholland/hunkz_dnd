import { useRef, useState } from "react";

// Animated open/close for the card's loadout drawer (grid-rows 0fr ↔ 1fr).
// Children mount on open and stay mounted through the closing transition,
// then unmount so a closed drawer costs nothing. Scrolls the opened drawer
// into view once it has finished growing (not mid-animation).
export default function DrawerCollapse({ open, children }) {
  const [rendered, setRendered] = useState(open);
  const ref = useRef(null);
  if (open && !rendered) setRendered(true);

  return (
    <div
      ref={ref}
      className={`cc-collapse${open ? " open" : ""}`}
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget || e.propertyName !== "grid-template-rows") return;
        if (open) ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
        else setRendered(false);
      }}
    >
      <div className="cc-collapse-inner">{rendered && children}</div>
    </div>
  );
}
