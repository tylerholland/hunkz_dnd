// Small single-colour icons for strike looks (npcStats.js LOOK_GROUPS).
const PATHS = {
  bite: <><path d="M3 8c3-4 11-4 14 0M3 12c3 4 11 4 14 0" /><path d="M6 8.6l1 2 1-2.4 1 2.4 1-2.4 1 2.4 1-2.4 1 2" /><path d="M6 11.4l1-1.8 1 2.2 1-2.2 1 2.2 1-2.2 1 2.2 1-1.8" /></>,
  claw: <path d="M5 3c2 5 2 9 0 14M10 3c2 5 2 9 0 14M15 3c2 5 2 9 0 14" />,
  lash: <path d="M3 15c3 0 4-3 5-6s3-5 6-4 2 5-1 6-3-2-1-3" />,
  sting: <><path d="M4 16c4-1 7-4 9-8l3-5-5 3c-4 2-7 5-8 9z" /><path d="M13 7l1 1" /></>,
  slam: <><rect x="5" y="3" width="10" height="7" rx="2" /><path d="M10 10v4M4 17h12M6 15l-2 2M14 15l2 2" /></>,
  breath: <><path d="M3 10h4" /><path d="M7 10c3-5 7-6 10-5M7 10h10M7 10c3 5 7 6 10 5" /></>,
  spit: <><circle cx="5" cy="10" r="2" /><path d="M8 10h3M12 8l2 2-2 2M15 10h2" /></>,
  cut: <path d="M4 16L15 5M13 4l3 3" />,
  stab: <path d="M16 4l-8 5 3 3zM6 10l4 4M8 12l-4 4" />,
  chop: <path d="M6 16l8-8M12 4a4 4 0 0 1 4 4l-3 1-2-2z" />,
  flurry: <path d="M5 6l3 3M9 4l3 3M5 12l3 3M12 11l3 3" />,
  arrow: <path d="M3 17L15 5M11 5h4v4M5 13H3v2" />,
  rock: <path d="M5 13l2-6 6-2 3 5-3 5-6 1z" />,
  fire: <path d="M10 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z" />,
  force: <><circle cx="10" cy="10" r="3" /><path d="M10 2v3M10 15v3M2 10h3M15 10h3" /></>,
  bolt: <path d="M11 2L5 11h4l-1 7 7-10h-4z" />,
};

export default function LookIcon({ look, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[look] || PATHS.cut}
    </svg>
  );
}
