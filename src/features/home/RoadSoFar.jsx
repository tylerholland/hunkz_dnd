import { useNavigate } from "react-router-dom";
import { ROAD_GLYPHS, ROAD_H, ROAD_W, initials, layoutRoad, sessionTitle, shortDate, trailPath } from "./roadLayout";

// Initials tokens for creatures without a portrait: a few dark hues, picked by name.
const TOKEN_FILLS = ["#5a2a2a", "#2a5a4a", "#2a3a5a", "#4a2a5a", "#4a3a2a", "#2a5a5a"];
const tokenFill = (name) => TOKEN_FILLS[[...String(name)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TOKEN_FILLS.length];

function Foe({ foe, cx, cy, r, clipId }) {
  if (foe.portraitUrl) {
    return (
      <>
        <clipPath id={clipId}><circle cx={cx} cy={cy} r={r} /></clipPath>
        <image href={foe.portraitUrl} x={cx - r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
        <circle className="road-foe-ring" cx={cx} cy={cy} r={r} fill="none" />
      </>
    );
  }
  return (
    <>
      <circle className="road-foe-ring" cx={cx} cy={cy} r={r} fill={tokenFill(foe.name)} />
      <text className="road-foe-initials" x={cx} y={cy + 3.5}>{initials(foe.name)}</text>
    </>
  );
}

/**
 * The Chronicle's sessions as waypoints on a winding trail. Creatures the
 * party damaged in a session slowly circle its waypoint; a flag marks the
 * next session (or today, when none is set).
 */
export default function RoadSoFar({ sessions, next, now }) {
  const navigate = useNavigate();
  const road = layoutRoad({ sessions, now, next });
  const open = (id) => navigate(`/chronicle/${encodeURIComponent(id)}`);

  return (
    <svg className="road-svg" viewBox={`0 0 ${ROAD_W} ${ROAD_H}`} role="group" aria-label="Sessions so far">
      {road.months.map((m) => (
        <g key={`${m.label}-${m.x}`}>
          <line className="road-tick" x1={m.x} y1="166" x2={m.x} y2="172" />
          <text className="road-month" x={m.x + 4} y="186">{m.label}</text>
        </g>
      ))}
      <path className="road-trail" d={trailPath(20, road.lastX)} />
      {road.endX > road.lastX && <path className="road-trail-ahead" d={trailPath(road.lastX, road.endX)} />}

      {road.points.map(({ session, x, y, day, orbitR, latest }, i) => {
        const foes = (session.foes || []).slice(0, 2);
        const title = sessionTitle(session.title);
        const date = shortDate(day);
        const tokenR = Math.round(orbitR * 0.38);
        const period = 26 + i * 3;
        const anchor = x > 760 ? "end" : x < 240 ? "start" : "middle";
        const labelX = anchor === "end" ? x + 12 : anchor === "start" ? x - 12 : x;
        return (
          <g key={session.id}>
            {foes.length > 0 && <circle className="road-orbit-path" cx={x} cy={y} r={orbitR} />}
            {foes.map((foe, k) => {
              const timing = { animationDuration: `${period}s`, animationDelay: `${-(period / foes.length) * k}s` };
              return (
                <g key={`${foe.name}-${k}`} className="road-orbit" style={{ ...timing, transformOrigin: `${x}px ${y}px` }}>
                  <g className="road-orbit-upright" style={timing}>
                    <title>{foe.name}</title>
                    <Foe foe={foe} cx={x + orbitR} cy={y} r={tokenR} clipId={`road-foe-${session.id}-${k}`} />
                  </g>
                </g>
              );
            })}
            <g
              className={`road-wp${latest ? " road-wp--latest" : ""}`}
              role="link"
              tabIndex={0}
              aria-label={`${title}, ${date}`}
              onClick={() => open(session.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(session.id); } }}
            >
              <title>{`${title} · ${date}`}</title>
              <circle className="road-wp-halo" cx={x} cy={y} r={latest ? 20 : 15} />
              <circle className="road-wp-seal" cx={x} cy={y} r={latest ? 11 : 8} />
              <text className="road-wp-glyph" x={x} y={y + 4}>{ROAD_GLYPHS[i % ROAD_GLYPHS.length]}</text>
              <text className="road-wp-label" x={labelX} y={y - (foes.length ? orbitR + 22 : latest ? 24 : 20)} style={{ textAnchor: anchor }}>
                {`${title} · ${date}`}
              </text>
            </g>
          </g>
        );
      })}

      {road.flag ? (
        <>
          <line className="road-today-mark" x1={road.today.x} y1={road.today.y - 7} x2={road.today.x} y2={road.today.y + 7} />
          <text className="road-flag-text" x={road.today.x} y={road.today.y + 22}>Today</text>
          <g className="road-flag road-flag--next">
            <line x1={road.flag.x} y1={road.flag.y} x2={road.flag.x} y2={road.flag.y - 30} />
            <path d={`M${road.flag.x},${road.flag.y - 30} l16,6 l-16,6 z`} />
            <text className="road-flag-text" x={road.flag.x} y={road.flag.y - 40}>{`Next · ${shortDate(road.flag.day)}`}</text>
          </g>
        </>
      ) : (
        <g className="road-flag">
          <line x1={road.today.x} y1={road.today.y} x2={road.today.x} y2={road.today.y - 26} />
          <path d={`M${road.today.x},${road.today.y - 26} l14,5 l-14,5 z`} />
          <text className="road-flag-text" x={road.today.x} y={road.today.y + 22}>Today</text>
        </g>
      )}
    </svg>
  );
}
