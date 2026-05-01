# RPG Consultant Addendum
## Correction Response: "In Play" Section Clarification + Revised Recommendations

**Reviewer**: RPG Consultant Agent (15+ years D&D, Roll20 / Foundry VTT / D&D Beyond)
**Date**: 2026-04-28
**Supersedes**: Portions of the original `rpg-consultant-review.md` that treated "In Play" as an empty placeholder (Priority 4 section and all references to "In Play" as the live-combat surface)

---

## Context

The original review assumed the "In Play" tab was an undifferentiated stub that could be repurposed as the live-session combat surface. The product owner has clarified: "In Play" already holds intentional content — specifically, character behaviors and roleplay guidance that the player commits to embodying during play. This is not a placeholder. It is a distinct layer of character expression.

This changes the design architecture meaningfully. What follows are revised recommendations for all three open questions, followed by story file edits.

---

## Task 1: Name and Framing for the New Live-Combat Section

The challenge is finding a short tab label that says "this is where you manage HP, spell slots, and conditions during active combat" without colliding with "In Play" (roleplay behaviors).

### Option A: "Combat"

**Tab label**: Combat  
**Concept**: Unambiguous. Every player at a 5e table knows what "combat" means. It does not overlap with personality or roleplay. It is the correct word for the session surface that tracks damage, spell slots, conditions, and death saves.

**Objection worth considering**: The section is also used outside of strict combat — inspiration can be awarded at any time, concentration matters during social encounters with spells active, and death saves can happen outside a formal combat round. "Combat" arguably undersells the breadth.

**Verdict**: Best choice for clarity and concision. Accept the slight narrowness; the UI can reinforce that it tracks any live-session resources, not only combat round mechanics.

---

### Option B: "Session"

**Tab label**: Session  
**Concept**: Borrows the frame of "what is active right now in this session" rather than the specific activity of combat. Captures inspiration, pre-combat buff tracking, post-combat condition cleanup. Slightly broader than "Combat."

**Objection**: "Session" is a technical/VTT word more than a D&D table word. Players do not say "check my session tab." It also overlaps with "session state" as a backend term, which may create confusion in development conversations.

**Verdict**: Second choice. Better conceptual fit, slightly weaker as a table-natural label.

---

### Option C: "Battle"

**Tab label**: Battle  
**Concept**: D&D-flavored synonym for combat, slightly more evocative than the clinical "Combat." Feels closer to how players actually speak ("we're heading into battle").

**Objection**: Same narrowness concern as "Combat" — does not obviously cover inspiration or non-combat concentration. Also slightly archaic in tone compared to the rest of the UI.

**Verdict**: Third choice. Usable but "Combat" is cleaner.

---

### Recommendation

**Use "Combat" as the tab label.**

Pair it with a short descriptor in the empty state and any onboarding copy: "Track HP, spell slots, conditions, and other live-session resources." This frames the breadth while keeping the tab label tight. The distinction is then:

- **In Play** — who your character *is* during play (behaviors, principles, roleplay commitments)
- **Combat** — what your character's *resources look like* during play (HP, slots, conditions, saves)

This is a clean conceptual split that requires no explanation to a 5e player.

---

## Task 2: D&D Framing of the Existing "In Play" Section

### What it actually maps to

The existing "In Play" content — character behaviors and roleplay guidance that the player commits to embodying — maps directly to the **personality traits, ideals, bonds, and flaws** system from D&D 5e (Player's Handbook, character creation chapter). These four elements are the roleplay layer of a character:

- **Personality traits**: specific behavioral tendencies ("I always speak my mind," "I can't resist a good puzzle")
- **Ideals**: the principle a character believes in most deeply ("Justice must be served, whatever the cost")
- **Bonds**: connections to people, places, or things ("I owe my life to the village that took me in")
- **Flaws**: a weakness, vice, or compulsion the character has not overcome ("I am suspicious of strangers")

In practice many players blend these into a single list of roleplay commitments rather than the strict four-category structure. That is exactly what the current "In Play" content sounds like.

### Does "In Play" work as a name?

Honestly, it is a reasonable name with a significant ambiguity problem now that a separate live-combat section exists. "In Play" can read as either "roleplay principles you embody when playing" or "things you track while actively playing (combat)." With both tabs present, players will need to remember which "in play" meaning applies to which tab.

### Rename recommendation

If the product owner is open to it: rename the existing roleplay section to **"Character"** or **"Persona"**.

- **"Character"** — natural D&D word; directly signals "this is who your character is, not what their current HP is." Clean and unsurprising.
- **"Persona"** — slightly more evocative; captures the roleplay identity layer well; feels right for the behavior/principle content.

If the name "In Play" has player attachment or meaning to the group, keep it. The distinction between it and "Combat" is clear enough at a tab level even with the potentially ambiguous name. But given that the original name was almost certainly chosen before the combat tab existed in the design, a rename is worth proposing.

**Bottom line**: "In Play" works; "Character" or "Persona" is clearer. Flag for the product owner to decide before the UX designer prototypes the tab bar.

---

## Task 3: Real-Time Push vs. Polling for DM Dashboard

### How HP actually flows in combat: who knows what and when

This is the key practical question. At a 5e table, the information flow for a hit is:

1. Player (or DM) announces an attack
2. Attacker rolls to hit, calls out the total
3. DM (or defending player) confirms a hit
4. Attacker rolls damage, announces the total
5. **The DM knows the damage before the player applies it** — the DM adjudicated the hit
6. Player reduces their own HP

In virtually all 5e combat rounds, the DM already knows the HP change before the player records it. The DM declared the damage. This means a 10–15 second polling delay does not create an information gap — the DM already has the information verbally.

**The scenario where polling genuinely lags behind reality:**

- A player heals themselves using a class feature, spell, or item between turns — the DM may not know the exact amount until the player announces it
- The DM applies damage via a PATCH and the player's own view takes up to 15 seconds to reflect it (this is the player seeing stale data, not the DM)
- A player updates a condition on their own sheet (e.g., marks themselves as prone after falling) without verbally calling it out

For a remote video call group where players are visible and audible, all of these edge cases are covered by speech. Players announce healing. Players say "I'm going prone." The app is a record-keeper, not the primary information channel.

### Are there scenarios where real-time push meaningfully improves play?

Yes, but they are narrow:

1. **Player self-healing between DM turns**: if a player uses Second Wind or a healing potion on their turn and does not verbally announce the number, the DM's dashboard stays stale until polling catches up. In practice players announce this; the scenario requires the group to be partially silent, which is unusual on a video call.

2. **DM-applied damage reflecting on the player's screen**: if the DM changes a player's HP from the dashboard, the player needs to see it. With polling, the player's sheet updates within 10–15 seconds. If the DM changes HP and then immediately asks "how's your HP?" the player's UI may not reflect it yet. This is slightly awkward.

3. **Multi-DM or shared screen use**: if two people are both looking at the DM dashboard simultaneously (e.g., DM and co-DM), polling at 10–15 second intervals means they may briefly see inconsistent state. Not applicable for this group's setup.

### What WebSocket real-time push actually adds

WebSocket push eliminates the latency window. Changes propagate in under a second. For this app and this group the practical benefit is:

- DM changes a player's HP → player's sheet updates immediately rather than within 15 seconds
- Player changes their HP → DM dashboard updates immediately

On a video call where verbal communication is happening continuously, the 15-second gap almost never matters. The primary combat loop runs at the pace of conversation and dice rolls, which is measured in minutes per turn, not seconds.

### Implementation cost comparison

- **Polling at 10–15 seconds**: already designed in the story; works with the existing REST API pattern; near-zero additional complexity; scales trivially to 3 players
- **Polling at 5 seconds**: lower latency; still REST; slightly higher API call volume but completely negligible at this group size (Lambda + DynamoDB cost impact is immeasurable)
- **WebSocket (API Gateway WebSocket API)**: requires new API Gateway endpoint type, connection management, DynamoDB connection table, Lambda handlers for connect/disconnect/send, client-side reconnection logic; meaningfully higher implementation and operational complexity

For 3 players on a video call where every participant is on voice at all times, **WebSocket complexity is not justified**. This is not a case where push would change play behavior — it would only eliminate a 10–15 second window that verbal communication already covers.

### Recommendation: Keep polling, shorten to 5 seconds

- **Polling interval**: 5 seconds (down from 10–15)
- **Rationale**: 5 seconds is imperceptible in the flow of combat conversation; it closes the "DM asked about your HP and the sheet hasn't updated yet" awkward window without WebSocket complexity. At 3 players polling 1 endpoint, the Lambda invocation count is trivial.
- **Close the open question**: polling is the correct choice for this group size and play context. If the group grows beyond 6 players or the DM moves to a shared screen setup where sub-second sync matters, revisit WebSockets at that time.
- **WebSockets**: remain out of scope; move the deferral rationale from a one-liner to a brief ADR note so future developers understand the decision was intentional, not an oversight.

---

## Summary of Design Changes Triggered by This Correction

| Area | Original Assumption | Corrected Understanding | Change Required |
|---|---|---|---|
| "In Play" tab purpose | Empty placeholder, repurpose for combat | Existing roleplay/behavior content; intentional | Do not repurpose — new tab needed |
| New live-combat tab name | "In Play" | "Combat" | Story 04 renamed and reframed |
| Roleplay tab name | N/A (no content existed) | "In Play" (keep, or optionally rename) | Flag for product owner; stories note both options |
| DM dashboard polling | 10–15 second interval, open question | 5-second polling; WebSockets deferred | Story 05 updated with rationale and closed question |

---

*This addendum should be read alongside the original `rpg-consultant-review.md`. Sections 1–3 and Priority 4 of the original review are superseded by this document where they conflict.*
