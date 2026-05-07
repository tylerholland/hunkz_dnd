export function HR({ color }) {
  return <div style={{ borderTop: `1px solid ${color}`, margin: "22px 0" }} />;
}

export function DragHandle({ color }) {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill={color} style={{ opacity: 0.45, flexShrink: 0 }}>
      <circle cx="4" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" />
      <circle cx="4" cy="9" r="1.4" /><circle cx="8" cy="9" r="1.4" />
      <circle cx="4" cy="15" r="1.4" /><circle cx="8" cy="15" r="1.4" />
    </svg>
  );
}
