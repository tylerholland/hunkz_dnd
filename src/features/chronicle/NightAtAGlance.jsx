import { useState } from "react";
import { ENEMY_COLOR, UNKNOWN_COLOR, fmtTime } from "./chronicleData";

const W = 1000;
const PAD_L = 78;
const PAD_R = 18;
const HP_TOP = 22;
const HP_BOT = 128;
const BAND_TOP = 138;
const BASE = 282;
const BAR_MAX = 104;
const AXIS = 304;
const H = 322;

/**
 * Story 69 — one timeline across a session: party HP lines, combat rounds,
 * and a bar for every hit at the moment it landed (coloured by who dealt it).
 * Recorded data when the log has it; otherwise inferred and labelled so.
 */
export default function NightAtAGlance({ timeline, startMs, endMs, people }) {
  const [detail, setDetail] = useState("");
  const t0 = startMs - 3 * 60000;
  const t1 = Math.max(endMs, startMs + 60000) + 3 * 60000;
  const x = (ms) => PAD_L + ((ms - t0) / (t1 - t0)) * (W - PAD_L - PAD_R);
  const { hpSeries, hits, misses, rounds, order, clocks, roundsInferred, hitsInferred } = timeline;
  const maxDmg = Math.max(8, ...hits.map((h) => h.amount || 0));
  const inferred = roundsInferred || hitsInferred;
  const totalDamage = hits.reduce((sum, h) => sum + (h.amount || 0), 0);
  const quarter = 15 * 60000;
  const ticks = [];
  for (let t = Math.ceil(t0 / quarter) * quarter; t <= t1; t += quarter) ticks.push(t);
  const legend = [...people.values()].filter((p) => hits.some((h) => h.color === p.color) || hpSeries.some((s) => s.color === p.color));

  const describe = (h) => {
    const who = h.attacker || "Someone";
    const what = h.action ? ` with ${h.action}` : "";
    const on = h.target ? ` to ${h.target}` : "";
    const label = h.tag ? ` · ${h.tag}` : "";
    return `${fmtTime(h.ms)} · ${who} dealt ${h.amount}${on}${what}${h.crit ? " (critical)" : ""}${label}${h.attributed ? "" : h.recorded ? " · not tagged to an attack" : " · no action roll just before it"}`;
  };

  return (
    <section className="chr-glance" aria-labelledby="chr-glance-h">
      <div className="chr-glance-head">
        <h2 id="chr-glance-h">The Night at a Glance</h2>
        {inferred && <span className="chr-inferred">Inferred from rolls</span>}
      </div>
      {order.length > 0 && (
        <div className="chr-order">
          Turn order{roundsInferred ? " (inferred)" : ""}: {order.map((name, i) => (
            <span key={name}>{i > 0 && " → "}<b>{name}</b></span>
          ))} · {rounds.length} round{rounds.length === 1 ? "" : "s"} · {hits.length} hit{hits.length === 1 ? "" : "s"}, {totalDamage} damage
        </div>
      )}
      <div className="chr-chart-scroll">
        <svg className="chr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline of HP, rounds and damage for this session">
          {rounds.map((r, i) => {
            const rx = x(r.start);
            const nx = rounds[i + 1] ? x(rounds[i + 1].start) : x(endMs);
            return (
              <g key={`r${i}`}>
                {i % 2 === 0 && <rect className="chr-round-band" x={rx} y={BAND_TOP} width={Math.max(2, nx - rx)} height={BASE - BAND_TOP} />}
                <text className="chr-round-label" x={rx + 4} y={BAND_TOP + 13}>R{r.n}</text>
              </g>
            );
          })}
          <text className="chr-lane-label" x="0" y={HP_TOP + 10}>HP</text>
          <text className="chr-lane-label" x="0" y={BAND_TOP + 13}>Rounds</text>
          <text className="chr-lane-label" x="0" y={BASE - BAR_MAX + 10}>Damage</text>
          <line className="chr-grid" x1={PAD_L} x2={W - PAD_R} y1={HP_BOT} y2={HP_BOT} />
          <line className="chr-grid" x1={PAD_L} x2={W - PAD_R} y1={HP_TOP} y2={HP_TOP} strokeDasharray="2 4" />

          {hpSeries.length > 0 ? (
            <>
              <text x={PAD_L - 6} y={HP_TOP + 4} textAnchor="end">100%</text>
              <text x={PAD_L - 6} y={HP_BOT} textAnchor="end">0</text>
              {hpSeries.map((s) => {
                const y = (hp) => HP_BOT - (Math.max(0, Math.min(s.max, hp)) / s.max) * (HP_BOT - HP_TOP);
                // Step line: HP holds until the next change.
                const pts = [];
                s.points.forEach((p, i) => {
                  if (i > 0) pts.push([x(p.ms), y(s.points[i - 1].hp)]);
                  pts.push([x(p.ms), y(p.hp)]);
                });
                pts.push([x(endMs), y(s.points[s.points.length - 1].hp)]);
                return (
                  <polyline key={s.slug} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" points={pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ")}>
                    <title>{s.name}</title>
                  </polyline>
                );
              })}
            </>
          ) : (
            <text className="chr-empty" x={(PAD_L + W - PAD_R) / 2} y={(HP_TOP + HP_BOT) / 2 + 4} textAnchor="middle">
              HP wasn&apos;t recorded for this session. It&apos;s logged from Sep 28, 2026 on.
            </text>
          )}

          {clocks.map((c, i) => {
            const cx = x(c.ms);
            const cy = BAND_TOP + 26;
            return (
              <path key={`c${i}`} className="chr-clock" d={`M${cx} ${cy - 5} L${cx + 5} ${cy} L${cx} ${cy + 5} L${cx - 5} ${cy} Z`}>
                <title>{`${c.name}${Number.isFinite(c.filled) ? ` ${c.filled}/${c.segments}` : ""} · ${fmtTime(c.ms)}`}</title>
              </path>
            );
          })}

          {misses.map((m, i) => (
            <line key={`m${i}`} x1={x(m.ms)} x2={x(m.ms)} y1={BASE + 3} y2={BASE + 11} stroke={m.color} strokeWidth="2">
              <title>{`${fmtTime(m.ms)} · ${m.who || "Someone"} ${hitsInferred ? "rolled with no damage after it" : `missed${m.target ? ` ${m.target}` : ""}`}`}</title>
            </line>
          ))}

          {hits.map((h, i) => {
            const hx = x(h.ms);
            const bh = Math.max(4, ((h.amount || 0) / maxDmg) * BAR_MAX);
            return (
              <g
                key={`h${i}`}
                className="chr-hit"
                tabIndex={0}
                role="button"
                aria-label={describe(h)}
                onClick={() => setDetail(describe(h))}
                onFocus={() => setDetail(describe(h))}
                onMouseEnter={() => setDetail(describe(h))}
              >
                <rect
                  x={hx - 6}
                  y={BASE - bh}
                  width="12"
                  height={bh}
                  rx="2"
                  fill={h.color}
                  fillOpacity={h.attributed ? 1 : 0.45}
                  stroke={h.attributed ? "none" : h.color}
                  strokeDasharray={h.attributed ? undefined : "3 2"}
                />
                <text className="chr-bar-val" x={hx} y={BASE - bh - 4} textAnchor="middle">{h.amount}</text>
              </g>
            );
          })}

          <line className="chr-axis" x1={PAD_L} x2={W - PAD_R} y1={BASE} y2={BASE} />
          {ticks.map((t) => (
            <g key={t}>
              <line className="chr-grid" x1={x(t)} x2={x(t)} y1={AXIS - 8} y2={AXIS - 4} />
              <text x={x(t)} y={AXIS + 8} textAnchor="middle">{fmtTime(t)}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="chr-legend">
        {legend.map((p) => (
          <span key={p.name}><span className="chr-swatch" style={{ background: p.color }} />{p.name}</span>
        ))}
        {hits.some((h) => h.color === ENEMY_COLOR) && <span><span className="chr-swatch" style={{ background: ENEMY_COLOR }} />Enemies</span>}
        {hits.some((h) => h.color === UNKNOWN_COLOR) && <span><span className="chr-swatch" style={{ background: UNKNOWN_COLOR }} />Not tagged</span>}
        <span><span className="chr-swatch chr-swatch--dashed" />{hitsInferred ? "Damage roll with no action roll just before it" : "Damage not tagged to an attack"}</span>
        <span>│ {hitsInferred ? "Action roll, no damage after it" : "Miss"}</span>
        {clocks.length > 0 && <span className="chr-legend-clock">◆ Counter wheel ticked</span>}
      </div>
      <div className="chr-detail" aria-live="polite">{detail || "Select a bar for details."}</div>
      {inferred && (
        <p className="chr-note">
          This session predates HP and turn logging, so turns come from the order people rolled: a 2d6 is an action, a damage die right after it by the same player is a hit, and a new round starts when someone acts a second time.
        </p>
      )}
    </section>
  );
}
