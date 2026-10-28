// The combat quick-start guides (design/prototypes/combat-quickstart.html):
// one for players, one for the DM. Each step draws the real control, since
// most combat controls only appear mid-action. Keep the copy in step with
// what the app does (AttackDeclarationBar, TakeActionDrawer, DealDamageModal,
// DmDiceRoller, RollHistoryList).

import { Chip, Token } from "./GuideArt";

export const COMBAT_GUIDES = {
  player: [
    {
      title: "Open the map",
      body: [<>When the DM starts combat, your sheet&apos;s map shows a <b>Combat</b> mark. Open the map: that&apos;s where you choose who you&apos;re attacking.</>],
      tip: "Drag the map's lower edge to make it taller.",
      art: (
        <div className="cg-col">
          <div className="cg-chip cg-wide">MAP · The Sewers <span className="cg-chip pri">Combat</span></div>
          <div className="cg-lbl">Tap the map&apos;s heading to open it</div>
        </div>
      ),
    },
    {
      title: "Hold an enemy to target it",
      body: [
        <><b>Press and hold</b> an enemy&apos;s token until the ring fills (half a second). A target mark appears and your attack bar opens at the bottom.</>,
        <>A quick tap shows the enemy&apos;s card instead. Hold the same enemy again to clear the target, or hold another to switch.</>,
      ],
      art: (
        <div className="cg-row cg-gap-lg">
          <div className="cg-col"><Token name="Rat" ring /><div className="cg-lbl">hold…</div></div>
          <div className="cg-col"><Token name="Rat" reticle /><div className="cg-lbl">targeted</div></div>
        </div>
      ),
    },
    {
      title: "Choose your attack",
      body: [<>The bar shows your target and your weapons, Unarmed Strike and attack spells, each with its to-hit. Tap one.</>],
      tip: "Spells marked ✶ use a slot; with none left they can't be chosen. × closes the bar.",
      art: (
        <div className="cg-bar">
          <div className="cg-bar-top">◎ Giant Rat<span className="cg-x">×</span></div>
          <div className="cg-row cg-start"><Chip cls="sel">Dagger <small>+5</small></Chip><Chip>Unarmed <small>+3</small></Chip><Chip>✶ Eldritch Blast <small>+6</small></Chip></div>
        </div>
      ),
    },
    {
      title: "Roll to hit",
      body: [
        <>Pick <b>N</b>, <b>ADV</b> or <b>DIS</b>, then tap <b>Attack</b> (or <b>✶ Cast</b> for a spell).</>,
        <>Need different dice, like a bless bonus? <b>Tap the dice</b> (<span className="cg-expr">1d20+5</span>) and type your own before you roll.</>,
      ],
      tip: "A natural 20 shows CRIT; a natural 1 shows FUMBLE. ↺ Again rerolls.",
      art: (
        <div className="cg-bar">
          <div className="cg-bar-top">◎ Giant Rat<span className="cg-x">×</span></div>
          <div className="cg-row cg-start">
            <Chip cls="sel">Dagger · <span className="cg-expr">1d20+5</span></Chip>
            <span className="cg-seg"><span>N</span><span className="on">ADV</span><span>DIS</span></span>
            <Chip cls="pri hl">Attack</Chip>
          </div>
        </div>
      ),
    },
    {
      title: "Roll damage",
      body: [
        <>If it hits, tap <b>Damage</b>: it&apos;s in the same spot as Attack. Tap the dice first to change them (an extra 1d6, say).</>,
        <>Effects you&apos;ve put on the target, like <b>✦ +1d6 Hex</b>, add on automatically; tap one to leave it out. The DM decides whether it hit and applies the damage.</>,
      ],
      art: (
        <div className="cg-bar">
          <div className="cg-bar-top">◎ Giant Rat<span className="cg-x">×</span></div>
          <div className="cg-result"><b>19</b><span className="cg-badge">CRIT</span></div>
          <div className="cg-row cg-start"><Chip cls="ghost">↺ Again</Chip><Chip cls="pri hl">⚔ Damage</Chip><Chip>✦ +1d6 Hex</Chip></div>
        </div>
      ),
    },
    {
      title: "Other moves: free rolls",
      body: [
        <>Shoving, climbing, grappling, sneaking past? Open the <b>Dice</b> panel and use <b>Free Roll</b>: pick the dice, add a modifier, and type what it&apos;s for in the <b>For</b> box, like “Shove the goblin”. Then roll.</>,
        <><b>Label it as you roll</b>, while it&apos;s fresh: the log then tells the story of the fight, and nobody has to remember later what a lone 14 was for.</>,
      ],
      tip: "Forgot? You can still label it afterwards in the Chronicle with ✎.",
      art: (
        <div className="cg-col">
          <div className="cg-panel">
            <div className="cg-panel-t">Free Roll</div>
            <div className="cg-row cg-start"><Chip cls="sel">d20</Chip><Chip>+ Modifier <small>+3</small></Chip></div>
            <div className="cg-row cg-start cg-full"><span className="cg-muted">For</span><span className="cg-input hl">Shove the goblin</span></div>
            <div className="cg-row cg-end"><Chip cls="pri">Roll 1d20+3</Chip></div>
          </div>
          <div className="cg-log"><div><b>Eòghan</b> Free Roll · 17 <span className="cg-tag">· Shove the goblin</span></div></div>
        </div>
      ),
    },
    {
      title: "End your turn",
      body: [<>When you&apos;re done, tap <b>End Turn</b> so the next person goes (if your DM allows it). Your turn shows in the Initiative list, with a banner when it comes round.</>],
      art: (
        <div className="cg-col">
          <span className="cg-endturn">End Turn · when you&apos;re done</span>
          <div className="cg-lbl">“Your turn · Round 2” appears when it&apos;s you</div>
        </div>
      ),
    },
  ],

  dm: [
    {
      title: "Start combat",
      body: [<>Switch the Campaign page to <b>Combat</b> (the tab hanging under the top bar). Everyone&apos;s map switches to battle, and players can attack.</>],
      art: (
        <div className="cg-col">
          <span className="cg-seg"><span>Adventure</span><span className="on red">Combat</span></span>
          <div className="cg-lbl">Adventure ends combat again</div>
        </div>
      ),
    },
    {
      title: "Long-press a token to act with it",
      body: [
        <>On the map, <b>press and hold any token</b>, a character or an NPC, until “Hold to act” fills. That&apos;s who&apos;s acting.</>,
        <>Tap and drag still moves tokens.</>,
      ],
      art: <div className="cg-col"><Token name="Ogre" ring /><div className="cg-lbl">Hold to act</div></div>,
    },
    {
      title: "Pick the target",
      body: [<>Now <b>tap or long-press the token they&apos;re acting on</b>, or choose <b>Target self</b>. The drawer shows who&apos;s acting on whom.</>],
      art: (
        <div className="cg-col">
          <div className="cg-row cg-gap-lg"><Token name="Ogre" /><span className="cg-arrow">→</span><Token name="Eòg" pc reticle /></div>
          <div className="cg-row"><Chip cls="ghost">Target self</Chip><Chip cls="ghost">Cancel</Chip></div>
        </div>
      ),
    },
    {
      title: "Pick the action",
      body: [
        <>Choose a weapon, spell or <b>Heal</b>. NPCs get quick attacks (Swing Sword 1d8, Throw Rock 1d4…) and a <b>✶ Magic</b> list; each remembers the last dice you used.</>,
        <>Roll the NPC&apos;s <b>to-hit</b> in the Dice Roller (d20 with Adv. or Disadv.); the action handles damage.</>,
      ],
      art: (
        <div className="cg-col">
          <div className="cg-panel-t">Ogre → Eòghan</div>
          <div className="cg-row"><Chip>Swing Sword <small>1d8</small></Chip><Chip>Throw Rock <small>1d4</small></Chip><Chip>✚ Heal</Chip><Chip>✶ Magic ▾</Chip></div>
        </div>
      ),
    },
    {
      title: "Deal the damage",
      body: [
        <>Tap <b>Roll</b> (change the dice first if you like). Turn on <b>Crit</b> before rolling to double the dice.</>,
        <>Adjust the amount: <b>½</b> for resistance, <b>×2</b> for vulnerability, or <b>− / +</b>. Then <b>Apply Damage</b>, or <b>Miss</b> if it missed. Everyone sees the strike on their map.</>,
      ],
      art: (
        <div className="cg-panel">
          <div className="cg-panel-t">Ogre → Eòghan · Swing Sword</div>
          <div className="cg-hp"><i /></div>
          <div className="cg-row cg-start">Dice <span className="cg-input">1d8+4</span><Chip>Roll</Chip><Chip>Crit</Chip></div>
          <div className="cg-row cg-start">Damage <Chip>−</Chip><span className="cg-input cg-num">9</span><Chip>+</Chip><Chip>½</Chip><Chip>×2</Chip></div>
          <div className="cg-row cg-end"><Chip cls="ghost">Miss</Chip><Chip cls="ghost">Cancel</Chip><Chip cls="pri hl">Apply Damage</Chip></div>
        </div>
      ),
    },
    {
      title: "Apply a player's damage",
      body: [
        <>When a player rolls damage at a target, it shows in your <b>History</b> with a <b>Deal Damage</b> button. It opens the same pop-up with their total (and crit) filled in: adjust, then Apply or Miss.</>,
        <>Spell effects (✦ Hex…) get <b>Apply Effect</b> instead. To-hit rolls never get a button: whether it hit is your call.</>,
      ],
      art: (
        <div className="cg-log">
          <div><b>Eòghan</b> Dagger DMG → ◎ Giant Rat · <b>9</b><Chip cls="pri hl cg-push">Deal Damage</Chip></div>
          <div><b>Eòghan</b> ✦ Hex → ◎ Giant Rat<Chip cls="cg-push">Apply Effect</Chip></div>
        </div>
      ),
    },
    {
      title: "Label events as they happen",
      body: [
        <>Rolling something that isn&apos;t an attack, like an NPC&apos;s grapple or a check? Type what it&apos;s for in the Dice Roller&apos;s <b>For</b> box as you roll.</>,
        <>Anything else in History can be labelled with <b>✎</b>, like “Ambush at the sluice”. Do it as it happens, while everyone remembers; the Chronicle&apos;s ✎ is there for anything missed.</>,
      ],
      art: (
        <div className="cg-log">
          <div><b>DM</b> Free Roll · 14 <span className="cg-tag">· Ogre tries to grapple</span></div>
          <div><b>Ogre</b> −9 Eòghan · 31 → 22 <span className="cg-tag">· Ambush at the sluice</span><span className="cg-pen hl">✎</span></div>
        </div>
      ),
    },
    {
      title: "Pass the turn",
      body: [
        <>When someone&apos;s done, tap <b>▶ Next Turn</b> in Initiative. Players see whose turn it is, and get a banner when theirs comes round.</>,
        <>Players can end their own turn too, if you allow it in Settings.</>,
      ],
      art: (
        <div className="cg-col">
          <Chip cls="pri hl">▶ Next Turn</Chip>
          <div className="cg-lbl">Round 2 · Eòghan&apos;s turn</div>
        </div>
      ),
    },
  ],
};

// Offered once per device, separately for the player and DM guides.
const seenKey = (who) => `dnd_combat_guide_seen_${who}`;
export function combatGuideSeen(who) {
  try { return localStorage.getItem(seenKey(who)) === "1"; } catch { return true; }
}
export function markCombatGuideSeen(who) {
  try { localStorage.setItem(seenKey(who), "1"); } catch { /* storage blocked: the offer may show again */ }
}
