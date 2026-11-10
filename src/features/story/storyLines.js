// The session told as a story (the player's Story tab, the DM's Story view):
// the same log events as the DM's ledger, written as sentences instead of
// dice and HP sums. Others' actions carry no numbers; the viewer's own can
// (numbers: "mine"), or everyone's (numbers: "all", the DM's option).
//
// A line is { id, at, kind: "line", me, parts }, where parts are strings or
// { t, s } spans: t = "who" (a name), "you", "ok" (went well), "no" (went
// badly), "quiet" (aside), "num" (a number). Moments are { kind: "moment" },
// notes { kind: "note", replies }, and a new combat round { kind: "round" }.
import { bareName, shortName } from "../../lib/names";
import { checkName } from "../rollRequests/rollCheck";
import { voteLogText } from "../vote/voteUtil";

const PAIR_WINDOW_MS = 3 * 60 * 1000; // an attack and its damage roll, told as one line
const FLICKER_MS = 2 * 60 * 1000; // a condition on and off again this fast was a slip (or a test)
const MERGE_MS = 60 * 1000; // back-to-back HP changes to one subject
const FREE_RUN_MS = 5 * 60 * 1000; // one player's untagged rolls with nothing else between
// Conditions read as states ("is now Poisoned"); Exhaustion is the odd one out.
const conditionWord = (c) => (/^exhaustion$/i.test(c) ? "Exhausted" : c);
// Shop items: "a Lantern", but "Travel Rations" (plural-looking names go bare).
const withArticle = (name) => (/[^s]s$/i.test(String(name || "").trim()) ? name : `${article(name)} ${name}`);
const title = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
const article = (word) => (/^[aeiou]/i.test(String(word || "")) ? "an" : "a");
const timeOf = (e) => Date.parse(e?.createdAt || "") || e?.timestamp || e?.sortTime || 0;
const join = (names) => (names.length <= 1 ? names[0] || "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** How bad a hit on a party member was, from the share of their HP it took. */
export function hitSeverity(damage, max) {
  if (!Number.isFinite(max) || max <= 0) return "a hit";
  const share = damage / max;
  if (share < 0.15) return "a scratch";
  if (share < 0.35) return "a solid hit";
  return "a brutal hit";
}

/** "Check" phrase: "an Athletics check", "a Dexterity save", "a Strength check". */
function checkPhrase(check) {
  const name = check?.skill ? `${title(check.skill)} check` : checkName(check);
  return `${article(name)} ${name}`;
}

// A free roll's label ("What was that for?" picks, or typed): "Longbow
// attack" → " attacked with a Longbow.", "Stealth check" → " made a Stealth
// check.", anything else → " rolled for …".
export function taggedPhrase(tag) {
  const t = String(tag || "").trim();
  let m;
  if ((m = /^(.+) attack$/i.exec(t))) return ` attacked with ${article(m[1])} ${m[1]}.`;
  if ((m = /^(.+) damage$/i.exec(t))) return ` struck with ${article(m[1])} ${m[1]}.`;
  if ((m = /^(.+) cast$/i.exec(t))) return ` cast ${m[1]}.`;
  if ((m = /^(.+) (check|save)$/i.exec(t))) return ` made ${article(m[1])} ${m[1]} ${m[2].toLowerCase()}.`;
  return ` rolled for ${t}.`;
}

function rollKind(label) {
  const match = /^(.*)\s(ATK|CAST|DMG)$/.exec(String(label || "").trim());
  if (match) return { step: match[2], name: match[1] };
  if (/\bcheck$/i.test(String(label || ""))) return { step: "check", name: String(label).replace(/\s*check$/i, "") };
  // The player's own Check button: "Dexterity (Stealth)", "Wisdom save".
  const skill = /^[A-Z][a-z]+ \((.+)\)$/.exec(String(label || ""));
  if (skill) return { step: "check", name: skill[1] };
  if (/^[A-Z][a-z]+ save$/.test(String(label || ""))) return { step: "save", name: label };
  if (/^free roll$/i.test(String(label || "")) || !label) return { step: "free" };
  return { step: "other", name: label };
}

export function buildStory(entries, { viewerSlug = null, numbers = "mine" } = {}) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean);
  const isMe = (slug) => !!viewerSlug && slug === viewerSlug;
  const showNum = (me) => numbers === "all" || (numbers === "mine" && me);
  const who = (slug, name, party = true) => (isMe(slug) ? { t: "you", s: "You" } : { t: "who", s: (party ? shortName(name) : bareName(name)) || "Someone" });
  const refName = (ref) => (ref?.type === "character" ? shortName(ref.name) : bareName(ref?.name));
  const num = (me, s) => (showNum(me) ? [{ t: "num", s }] : []);
  const subjectSlug = (subject) => (subject?.type === "character" ? subject.sourceId : null);

  // HP changes caused by a roll, keyed by that roll's id.
  const ids = new Set(list.map((e) => e.id));
  const outcomes = new Map();
  for (const e of list) {
    if (e.type === "hp" && e.rollId && ids.has(e.rollId)) outcomes.set(e.rollId, [...(outcomes.get(e.rollId) || []), e]);
  }
  // An attack roll followed by its damage roll becomes one line (on the damage).
  const chrono = [...list].sort((a, b) => timeOf(a) - timeOf(b));
  const atkFor = new Map(); // damage roll id → its attack roll
  const folded = new Set();
  chrono.forEach((e, i) => {
    if (e.type || rollKind(e.label).step !== "DMG") return;
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = chrono[j];
      if (timeOf(e) - timeOf(prev) > PAIR_WINDOW_MS) break;
      if (prev.type || prev.slug !== e.slug || folded.has(prev.id)) continue;
      const kind = rollKind(prev.label).step;
      if ((kind === "ATK" || kind === "CAST") && (prev.attack?.id ? prev.attack.id === e.attack?.id : rollKind(prev.label).name === rollKind(e.label).name)) {
        if (!(outcomes.get(prev.id) || []).some((o) => o.miss)) { atkFor.set(e.id, prev); folded.add(prev.id); }
        break;
      }
    }
  });

  // A condition switched on and off again within moments cancels out.
  const flicker = new Set(); // `${eventId}|${condition}`
  const lastAdded = new Map(); // `${subject}|${condition}` → { id, at }
  for (const e of chrono) {
    if (e.type !== "condition") continue;
    const subject = e.subject?.sourceId || e.subject?.name;
    for (const c of e.added || []) lastAdded.set(`${subject}|${c}`, { id: e.id, at: timeOf(e) });
    for (const c of e.removed || []) {
      const on = lastAdded.get(`${subject}|${c}`);
      if (on && timeOf(e) - on.at <= FLICKER_MS) { flicker.add(`${on.id}|${c}`); flicker.add(`${e.id}|${c}`); lastAdded.delete(`${subject}|${c}`); }
    }
  }

  // An HP change undone moments later (the DM fixing a slip) cancels out.
  const undone = new Set();
  const plainHp = (e) => e.type === "hp" && !e.by && !e.miss && !(e.rollId && ids.has(e.rollId)) && Number.isFinite(e.delta) && e.delta;
  chrono.forEach((e, i) => {
    if (!plainHp(e) || undone.has(e.id)) return;
    const fix = chrono.slice(i + 1).find((n) => timeOf(n) - timeOf(e) <= FLICKER_MS && plainHp(n) && !undone.has(n.id)
      && (n.subject?.sourceId || n.subject?.name) === (e.subject?.sourceId || e.subject?.name) && n.delta === -e.delta);
    if (fix) { undone.add(e.id); undone.add(fix.id); }
  });

  // Runs told as one line: HP changes to one subject in the same direction
  // (a long rest heals twice) and free rolls by one player, back to back.
  const runOf = new Map(); // first event id → the events in its run
  const inRun = new Set();
  const runKey = (e) => {
    if (undone.has(e.id)) return null;
    if (e.type === "hp" && !(e.rollId && ids.has(e.rollId)) && !e.by && !e.miss && e.delta) return `hp|${e.subject?.sourceId || e.subject?.name}|${Math.sign(e.delta)}`;
    if (!e.type && e.source !== "dm" && rollKind(e.label).step === "free" && !e.tag) return `free|${e.slug || e.characterName}`;
    return null;
  };
  let run = null;
  for (const e of chrono) {
    if (e.type === "turn" || e.type === "wheel" || undone.has(e.id)) continue; // don't break a run
    const key = runKey(e);
    const gap = key?.startsWith("free|") ? FREE_RUN_MS : MERGE_MS;
    if (key && run && run.key === key && timeOf(e) - timeOf(run.events[run.events.length - 1]) <= gap) {
      run.events.push(e); inRun.add(e.id);
    } else {
      run = key ? { key, events: [e] } : null;
      if (run) runOf.set(e.id, run.events);
    }
  }

  // Combat rounds, from the turn events: a marker when a new round starts.
  const roundAt = [];
  let round = 0;
  let lastTurnAt = 0;
  for (const e of chrono) {
    if (e.type !== "turn" || !Number.isFinite(e.round)) continue;
    const fresh = timeOf(e) - lastTurnAt > 30 * 60 * 1000 || e.round < round;
    if (fresh || e.round > round) {
      // A marker straight away replaced (the DM restarting combat) is dropped.
      if (roundAt.length && timeOf(e) - roundAt[roundAt.length - 1].at <= MERGE_MS) roundAt.pop();
      roundAt.push({ id: `round-${e.id}`, at: timeOf(e) - 1, kind: "round", round: e.round, start: e.round === 1 });
    }
    round = e.round; lastTurnAt = timeOf(e);
  }

  // Notes collect their replies.
  const repliesFor = new Map();
  for (const e of list) if (e.type === "note-reply" && e.noteId) repliesFor.set(`msg-${e.noteId}`, [...(repliesFor.get(`msg-${e.noteId}`) || []), e]);

  const hpOutcomeParts = (outs, me) => {
    if (!outs?.length) return ["."];
    if (outs.every((o) => o.miss)) return ["… ", { t: "no", s: "and missed." }];
    const hits = outs.filter((o) => !o.miss);
    const parts = ["… ", { t: "ok", s: hits.some((o) => o.action?.crit) ? "a critical hit!" : "and hit." }];
    const fell = hits.filter((o) => o.to === 0 && o.from > 0).map((o) => (isMe(subjectSlug(o.subject)) ? "You" : shortName(o.subject?.name)));
    if (fell.length) parts.push(" ", { t: "no", s: `${join(fell)} fell.` });
    const damage = hits.reduce((sum, o) => sum + Math.max(0, -(o.delta || 0)), 0);
    if (damage > 0) parts.push(...num(me, `${damage} damage`));
    return parts;
  };

  const line = (e, me, parts) => ({ id: e.id, at: timeOf(e), kind: "line", me, parts });
  const out = [];

  for (const e of list) {
    if (folded.has(e.id) || inRun.has(e.id) || undone.has(e.id)) continue;
    const type = e.type;

    if (!type || type === "roll") {
      if (e.source === "dm") continue; // the DM's own dice stay behind the screen
      const me = isMe(e.slug);
      const kind = rollKind(e.label);
      const actor = who(e.slug, e.characterName);
      const target = e.target?.name ? refName(e.target) : "";
      const outs = outcomes.get(e.id);
      if (kind.step === "ATK" || kind.step === "CAST") {
        const verb = kind.step === "CAST" || e.attack?.kind === "spell" ? ["cast ", { t: "who", s: e.attack?.name || kind.name }, target ? ` at ${target}` : ""] : ["attacked", target ? ` ${target}` : "", ` with ${article(e.attack?.name || kind.name)} ${e.attack?.name || kind.name}`];
        const parts = [actor, " ", ...verb];
        if (e.isFumble) parts.push("… ", { t: "no", s: "and fumbled." });
        else if (outs?.length) parts.push(...hpOutcomeParts(outs, me));
        else parts.push(e.isCrit ? "… " : ".", ...(e.isCrit ? [{ t: "ok", s: "a critical!" }] : []));
        parts.push(...num(me, `${e.total} to hit`));
        out.push(line(e, me, parts));
      } else if (kind.step === "DMG") {
        const atk = atkFor.get(e.id);
        const weapon = e.attack?.name || kind.name;
        const spell = e.attack?.kind === "spell" || (atk && rollKind(atk.label).step === "CAST");
        const parts = spell
          ? [actor, " cast ", { t: "who", s: weapon }, target ? ` at ${target}` : ""]
          : [actor, target ? ` attacked ${target}` : " struck", ` with ${article(weapon)} ${weapon}`];
        parts.push(...(outs?.length ? hpOutcomeParts(outs, false) : ["… ", { t: "ok", s: atk?.isCrit ? "a critical hit!" : "and hit." }]));
        if (showNum(me)) parts.push({ t: "num", s: [atk ? `${atk.total} to hit` : null, `${e.total} damage`].filter(Boolean).join(" · ") });
        out.push(line(e, me, parts));
      } else if (kind.step === "check") {
        out.push(line(e, me, [actor, ` made ${article(kind.name)} ${kind.name} check.`, ...num(me, String(e.total))]));
      } else if (kind.step === "save") {
        out.push(line(e, me, [actor, ` made ${article(kind.name)} ${kind.name}.`, ...num(me, String(e.total))]));
      } else if (kind.step === "free") {
        const rolls = runOf.get(e.id) || [e];
        const times = rolls.length === 1 ? "" : rolls.length === 2 ? " twice" : ` ${rolls.length} times`;
        out.push(line(e, me, [actor, e.tag ? taggedPhrase(e.tag) : ` rolled the dice${times}.`, ...num(me, rolls.map((r) => r.total).join(", "))]));
      } else {
        out.push(line(e, me, [actor, ` rolled ${kind.name}.`, ...num(me, String(e.total))]));
      }
      continue;
    }

    if (type === "hp") {
      if (e.rollId && ids.has(e.rollId)) continue; // told with its roll
      const slug = subjectSlug(e.subject);
      const me = isMe(slug);
      const subject = who(slug, e.subject?.name, e.subject?.type === "character");
      const byMe = e.by?.type === "character" && isMe(e.by.sourceId);
      const by = e.by?.name ? refName(e.by) : "";
      const action = e.action?.name || "";
      const byPoss = byMe ? (action ? `your ${action}` : "you") : `${by}${action ? `'s ${action}` : ""}`;
      const from = by ? ` from ${byPoss}` : "";
      const run = runOf.get(e.id) || [e];
      const delta = run.reduce((sum, r) => sum + (Number.isFinite(r.delta) ? r.delta : 0), 0);
      const last = run[run.length - 1];
      if (e.miss) {
        out.push(line(e, me, by ? [byMe ? { t: "you", s: "You" } : { t: "who", s: by }, " missed ", me ? { t: "you", s: "you" } : subject, action ? ` with ${action}.` : "."] : [subject, " ", { t: "ok", s: "dodged an attack." }]));
      } else if (delta < 0) {
        const parts = e.subject?.type === "npc"
          ? (by ? [byMe ? { t: "you", s: "You" } : { t: "who", s: by }, " hit ", subject, action ? ` with ${action}` : "", "."] : [subject, " ", { t: "no", s: "was wounded." }])
          : [subject, " took ", { t: "no", s: hitSeverity(-delta, e.max) }, `${from}.`];
        if (last.to === 0 && e.from > 0) parts.push(" ", { t: "no", s: me ? "You fell!" : `${refName(e.subject)} fell!` });
        if (showNum(me)) parts.push({ t: "num", s: `−${-delta}` });
        out.push(line(e, me, parts));
      } else if (delta > 0) {
        out.push(line(e, me, [subject, me ? " were " : " was ", { t: "ok", s: "healed" }, by ? ` by ${byPoss}` : "", ".", ...num(me, `+${delta}`)]));
      }
      continue;
    }

    if (type === "condition") {
      const slug = subjectSlug(e.subject);
      const me = isMe(slug);
      const subject = who(slug, e.subject?.name, e.subject?.type === "character");
      const added = (e.added || []).filter((c) => !flicker.has(`${e.id}|${c}`)).map(conditionWord);
      const removed = (e.removed || []).filter((c) => !flicker.has(`${e.id}|${c}`)).map(conditionWord);
      if (added.length) out.push(line(e, me, [subject, me ? " are now " : " is now ", { t: "no", s: join(added) }, "."]));
      if (removed.length) out.push({ ...line(e, me, [subject, me ? " are no longer " : " is no longer ", join(removed), "."]), id: `${e.id}-off` });
      if (e.exhaustion) {
        const poss = me ? { t: "you", s: "Your" } : { t: "who", s: `${refName(e.subject)}'s` };
        out.push({ ...line(e, me, e.exhaustion.to > 0 ? [poss, ` exhaustion is now level ${e.exhaustion.to}.`] : [poss, " exhaustion is gone."]), id: `${e.id}-ex` });
      }
      continue;
    }

    if (type === "check") {
      const rows = Array.isArray(e.rows) ? e.rows : [];
      if (!rows.length) continue;
      const mine = rows.some((r) => isMe(r.slug));
      const names = rows.map((r) => (isMe(r.slug) ? "you" : shortName(r.name)));
      const subjectText = names.length === 1 ? names[0] : join(names);
      const phrase = rows.length === 1 ? checkPhrase(e.check) : `${checkPhrase(e.check).replace(/^an? /, "")}s`;
      const parts = [];
      if (e.label) parts.push({ t: "who", s: e.label }, " — ");
      parts.push({ t: subjectText === "you" ? "you" : "who", s: e.label ? subjectText : subjectText.charAt(0).toUpperCase() + subjectText.slice(1) });
      parts.push(e.check?.initiative ? " rolled initiative." : ` made ${phrase}.`);
      const judged = rows.filter((r) => typeof r.pass === "boolean");
      if (rows.length === 1 && judged.length === 1) {
        parts[parts.length - 1] = parts[parts.length - 1].replace(/\.$/, "… ");
        parts.push({ t: judged[0].pass ? "ok" : "no", s: judged[0].pass ? "and passed." : "and failed." });
      } else if (judged.length) {
        judged.forEach((r, i) => parts.push(i ? ", " : " ", isMe(r.slug) ? "you " : `${shortName(r.name)} `, { t: r.pass ? "ok" : "no", s: r.pass ? "passed" : "failed" }));
        parts.push(".");
      }
      const own = rows.find((r) => isMe(r.slug));
      if (numbers === "all") parts.push({ t: "num", s: rows.filter((r) => Number.isFinite(r.total)).map((r) => (rows.length > 1 ? `${shortName(r.name)} ${r.total}` : r.total)).join(" · ") });
      else if (numbers === "mine" && Number.isFinite(own?.total)) parts.push({ t: "num", s: String(own.total) });
      out.push(line(e, mine, parts.filter((p) => !(p && p.t === "num" && !p.s))));
      continue;
    }

    if (type === "moment") { out.push({ id: e.id, at: timeOf(e), kind: "moment", title: e.title || "", text: e.text || "", picture: e.picture || null }); continue; }

    if (type === "note") {
      const toNames = (e.toNames || e.to || []).map(shortName);
      if (e.passed || !e.text) { out.push(line(e, false, ["The DM passed ", { t: "who", s: join(toNames) }, " a note."])); continue; }
      const forMe = !!viewerSlug && (e.to || []).includes(viewerSlug);
      out.push({ id: e.id, at: timeOf(e), kind: "note", me: forMe, heading: viewerSlug ? (forMe && toNames.length > 1 ? `The DM, to you and ${join(toNames.filter((_, i) => e.to[i] !== viewerSlug))}` : "The DM, to you only") : `Note to ${join(toNames)}`, title: e.title || "", text: e.text, replies: (repliesFor.get(e.id) || []).map((r) => ({ id: r.id, who: isMe(r.slug) ? "You" : shortName(r.name), text: r.text })) });
      continue;
    }

    if (type === "note-reply") {
      if (ids.has(`msg-${e.noteId}`)) continue; // shown under its note
      const me = isMe(e.slug);
      out.push(line(e, me, [who(e.slug, e.name), " replied to the DM's note", e.title ? ` “${e.title}”` : "", "."]));
      continue;
    }

    if (type === "give") {
      const me = isMe(e.from?.slug) || isMe(e.to?.slug);
      const qty = Number(e.qty) > 1 ? `${e.qty} × ${e.item}` : `${article(e.item)} ${e.item}`;
      out.push(line(e, me, [who(e.from?.slug, e.from?.name), " gave ", isMe(e.to?.slug) ? { t: "you", s: "you" } : { t: "who", s: shortName(e.to?.name) }, ` ${qty}.`]));
      continue;
    }

    if (type === "vote") { out.push(line(e, false, [voteLogText(e), "."])); continue; }

    if (type === "shop") {
      const me = isMe(e.slug);
      const things = (e.items || []).map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : withArticle(i.name)));
      out.push(line(e, me, [who(e.slug, e.characterName), e.action === "sold" ? " sold " : " bought ", join(things), e.shop ? ` at ${e.shop}` : "", "."]));
      continue;
    }

    if (type === "effect") {
      const me = isMe(e.slug);
      const poss = me ? { t: "you", s: "Your" } : { t: "who", s: `${shortName(e.characterName)}'s` };
      out.push(line(e, me, [poss, " ", { t: "who", s: e.attack?.name || e.effect }, ` takes hold of ${refName(e.target) || "its target"}.`]));
      continue;
    }

    if (type === "wheel" && /rest/i.test(e.name || "") && e.characterName) {
      const rest = /long/i.test(e.name) ? "a long rest" : "a short rest";
      out.push(line(e, false, [{ t: "who", s: shortName(e.characterName) }, ` took ${rest}.`]));
    }
    // Turn changes and the DM's counters aren't part of the story.
  }
  out.push(...roundAt);
  return out.sort((a, b) => b.at - a.at);
}
