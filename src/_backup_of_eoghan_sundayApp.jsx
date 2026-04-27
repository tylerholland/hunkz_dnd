import { useState, useEffect } from "react";
import eoghanCharacterImage from "./assets/eoghan.png";

// ── Global styles injected into <head> ────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Cinzel:wght@400;500&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    font-size: 20px;
  }

  html, body, #root {
    min-height: 100vh;
    width: 100%;
    background-color: #0d0f14;
  }

  body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
    background-color: #0d0f14;
  }

  .phoenetic {
    color: rgb(114 109 99);
  }

  button { font-family: inherit; cursor: pointer; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
`;

function useGlobalStyles() {
  useEffect(() => {
    const id = "eoghan-sheet-global";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = GLOBAL_CSS;
    document.head.prepend(style);
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, []);
}

function renderInline(text) {
  return text.split(/(\*[^*]+\*)/g).map((part, index) =>
    part.startsWith("*") && part.endsWith("*")
      ? <em class="phoenetic" key={index}>{part.slice(1, -1)}</em>
      : part
  );
}

const sections = [
  {
    id: "header",
    title: null,
    content: null,
    isHeader: true,
  },
  {
    id: "basics",
    title: "The Basics",
    content: null,
    isStats: true,
  },
  {
    id:"summary",
    group: "character",
    title: "DM Summary",
    content:`Eòghan MacGille Fàth *(YO-ən · mah-KIL-yuh · FAH)* is a towering Firbolg warlock from the storm-soaked Eirach Isles *(EE-rahkh Isles)*, bound to an ancient water spirit known as the Fuath *(FOO-ah)*. Raised along the dark lochs and coastal moorlands of Muirath *(MEER-ath)*, he moves through the world with an instinctive pull toward water and liminal places—estuaries, fog banks, and river crossings. He serves his patron not through worship, but through quiet, precise interventions: guiding travelers, altering paths, planting truths or lies as needed. To him, deception is a tool, not a moral question, and his role in the Fuath’s long designs has always felt as natural as breathing.

    That certainty fractured with the death of his younger sister, Sìleas *(SHEE-ləs)*, who drowned under inexplicable circumstances after his father refused a direct command from the Fuath. Whether her death was punishment or part of a larger design remains an open wound. His father, broken by grief, died soon after, leaving Eòghan to inherit both the family covenant and the unease that came with it. For the first time, Eòghan began to question not the existence of the pact, but its purpose—what vast, patient project he had been serving all his life without understanding.

    Since then, he has taken to the road as a guide through remote and dangerous lands, gradually pushing beyond the Fuath’s stronghold in the Isles. Distance has not freed him—the voice of his patron still reaches him—but its presence thins, giving him just enough space to observe, reflect, and search for answers. He carries himself with quiet authority, reserved and watchful, more at ease in harsh weather than in warmth or comfort, and rarely fully trusted by those he travels with.

    Recently, he encountered a group of travelers carrying a seemingly mundane mirror that burned with unmistakable significance to his patron. Drawn by the Fuath’s sudden and intense attention, Eòghan has joined their path without revealing his true purpose. Whether the mirror is an object of power, a marker of fate, or part of the same hidden design that claimed his sister, he does not yet know—but he is certain his role in it has already begun.`,
  },
  {
    id: "who",
    group: "character",
    title: "About Eòghan",
    content: `Eòghan MacGille Fàth *(YO-ən · mah-KIL-yuh · FAH)* is a Firbolg — towering, ancient-blooded, and deeply unhuman beneath a glamour of quiet manners. He comes from the coastline of Muirath *(MEER-ath)*, where the sea lochs run dark and moorland meets the tide in stretches of mud and marram grass.

He is most himself in rain. In fog. In the savage indifferent wind that rolls in off the Eirachean *(EE-rahkh-een)* sea. Bright dry days make him irritable. Sunshine feels like an imposition. He follows waterways the way other men follow roads — rivers, sea lochs, estuaries, boggy moorland hollows. He belongs in the in-between places. Not quite forest, not quite sea. The liminal edge where things are neither one thing nor the other.

He speaks softly. He knows things he shouldn't. He is not entirely to be trusted.`,
  },
  {
    id: "appearance",
    group: "character",
    title: "Appearance",
    content: `Eòghan *(YO-ən)* stands well over seven feet — broad across the shoulders, heavy-boned, built with the mass of something that belongs to an older world. He is not brutish. He is simply large in the way that ancient things are large, the way a sea stack or a standing stone is large — present in a way that makes the space around him feel slightly smaller. Those who meet him in poor light sometimes take him, briefly, for something other than a man.

His skin is a cool blue-grey, the colour of a Eirachean *(EE-rahkh-een)* sea loch on an overcast morning. His features are broad and weathered — a wide, slightly flattened nose, a heavy brow, eyes the deep grey-green of water over dark rock. His hair is dark and heavy, worn loose, and in wind it moves the way seaweed moves in a current. It is usually damp. He is usually damp, in the way of someone who has spent most of his life at the edge of the water and carries it with him.

He dresses practically, in worn travelling layers — a dark outer robe or cloak, weathered from long use on the drove roads, lined with a dark green and navy tartan that shows only when the wind opens it. Beneath that, a saffron linen shirt, faded from its original brightness, visible at the collar and cuffs. A broad leather belt. The kit of a working guide who has covered a great deal of difficult country.

Around his neck, on a cord of braided leather, hangs a hagstone — a smooth, roughly circular piece of dark coastal rock with a hole worn through its centre by centuries of water. It sits against his chest beneath his shirt, invisible unless he reaches for it. He does not speak about it. Its surface is worn smooth in one particular place from the pressure of a thumb.`,
  },
  {
    id: "patron",
    group: "story",
    title: "His Patron",
    content: `The Fuath *(FOO-ah)* are not gods. They predate that taxonomy entirely. Ancient Eirachean  *(EE-rahkh-een)* water spirits — malevolent, capricious, self-interested, and very old — they are primal genius loci, inseparable from the cold dark water of the islands. Something the fey courts themselves treat with caution and respect. They do not ask for worship. They ask for service, and in return they offer power, and a particular kind of knowledge that rises from deep water.

The MacGille Fàth line has served since before memory. Each firstborn pays what is asked. The arrangement has its advantages. Nobody asks what the Fuath gets in return.

What Eòghan is only beginning to consider is that the pact is not simply power exchanged for the occasional service. It is a project. Multigenerational, patient, operating on timescales that make individual lives look like single brushstrokes. He has been an instrument for longer than he understood, in ways more precise than he assumed, toward ends he cannot yet see. He is starting to feel its shape in the dark.

When his patron wants his attention, mist rolls in.`,
  },
  {
    id: "covenant",
    group: "story",
    title: "The Family Covenant",
    content: `The MacGille Fàth way was not taught so much as absorbed. Eòghan grew up watching his father Donnchaidh *(DON-uh-khee)* work — on the drove roads in his younger years, and later on the ferry that the family had operated across the loch for as long as anyone could remember. He learned early that the mist meant something. When it rolled in without weather reason, and within it came the sound of moving water close by even when none was nearby, you stopped and you listened. The Fuath's instructions were always simple. Which valley. Which crossing. Which stream to drink from before making camp. Which loch to skirt closely enough that a traveler might stumble and catch themselves on the bank, hands briefly submerged. The purposes were rarely explained, but the instructions were clear.

Donnchaidh had followed them without hesitation across decades — first on the roads, then on the water. The crossing was the family's most visible service to the Fuath, and to the community that depended on it, which understood without discussing it that the MacGille Fàth boats simply made it when others didn't. The loch tolerated them. In return Donnchaidh paid the tithe faithfully — seating certain strangers together, steering their conversation toward particular topics and away from others, planting a rumor or an untruth so naturally it felt like his own thought; delaying a group at the shore on a pretext of weather or tide, letting them wait by the mouth of the old river until the right hour; sending a traveler on their way believing something that wasn't true, about the road ahead or the people behind them or themselves. Small, precise interventions, some of them kind and some of them not. He carried them out without hesitation when the mist came and the water spoke.

Eòghan inherited this ease with deception as naturally as he inherited the pact itself. He does not experience lying as a moral act in either direction — the truth is just one of several options. He can be warm, and genuinely helpful, and he will look you in the eye and tell you something completely false if the situation calls for it. 

The instructions had never before asked Donnchaidh for someone's life. The loch had taken its toll in smaller currencies across all those years, but it had always given the living back. Until the morning the mist rolled in before dawn and whispered that the party camped on the shore — three cloaked elvish men, two women, and a child asleep against her mother's pack — were not to reach the other side. Not delayed or rerouted. Not briefly submerged and returned. Capsized. Drowned. Gone.

Donnchaidh walked down to the jetty and looked at the child in the firelight for a long time. She was perhaps six years old. Tired from the road, one arm thrown over her mother's pack, completely unaware of the dark water twenty feet away and the arrangement that governed it.

He went home. He sent word the boat needed repair. He never explained himself to the Fuath — he simply didn't take the fare, leaving the party to seek another crossing or, as they decided, to undertake the long journey around by land. When the mist came again the following nights and the water whispered at his door he sat in silence and let it come until eventually it stopped.

The following winter Sìleas *(SHEE-ləs)* drowned.

She was Donnchaidh's youngest daughter and Eòghan's beloved sister — twenty-eight years old, which in Firbolg terms placed her only a few years past the threshold of adulthood, still slight and young-faced in the way of Firbolgs who haven't yet fully grown into themselves. She had only recently begun to step into her own life, her curiosity about the world finally starting to be answered by the world itself. She and Eòghan had grown up inseparable despite all his years on the road — she had followed him onto the boats before she could properly swim, walked the drove roads at his heel asking questions he'd stopped thinking to ask, carried a way of looking at things that made the Fuath's ancient project feel somehow smaller and more questionable when seen through her eyes. He had been away more than he'd been home in those final years. 

She drowned on a calm day in shallow water with no explanation that held up no matter how many times it was turned over.

Donnchaidh rarely spoke again after they pulled her from the water. Just the occasional hollow word in response to those around him — enough to confirm he was still present, nothing more. He ran the ferry in silence for another year, a hollowed out man doing a hollowed out job. In that final year he forbade Eòghan from the water entirely — from the ferry, from the loch, from the shoreline itself. He gave no reason. Whether he feared the Fuath meant Eòghan harm on that water, or whether something in him wanted his son free of the loch's reach before it was too late, he never said. He died on the anniversary of Sìleas's drowning to the day, sitting in his chair facing the loch, and the ferry passed to Eòghan's uncle without ceremony or explanation.

Eòghan was left with the pact, and with a question his father had never answered — one he still cannot fully bring himself to ask. Whether Sìleas was taken as punishment for the refusal, or had always been part of the project. Whether she was ever safe to begin with.`,
  },
  {
    id: "road",
    group: "story",
    title: "The Road",
    content: `Even before his father’s death, Eòghan had shown gifts that set him apart—not only upon the water, but upon the land as well: in the reading of weather, of terrain, and of men. His father marked it early and spoke little of it, as men do when they recognize something they cannot name. His clan marked it too. By the time he was working the drove roads in earnest, a reputation traveled before him—the MacGille Fàth lad who led parties through country that had swallowed better guides.

After his father died and his uncle took the ferry, Eòghan continued on the roads and backcountry. It was what he knew. And the pact went with him—the mist still found him on high passes and sodden moorland, just as it had found Donnchaidh *(DON-uh-khee)* upon Loch Caorach *(LOK-ka-RACH)*. The instructions did not cease, and he served dutifully. He was skilled in his craft, and in the subtler manipulations his patron required. If anything, he proved better suited to it than the ferry had allowed his father to be — more mobile, more varied, less easily foreseen.

Yet the death of Sìleas *(SHEE-ləs)* left in him a question the Dreachlands could not answer. Not doubt in the pact, but a need to understand the hidden work to which he was bound, and to learn the truth of his sister’s end. All within the Dreachlands lay inside the Fuath’s reach, shaped by the same waters, turned—somehow—toward the same purpose his pact served. From within those bounds, he could not see its shape.

So, some years after his father’s passing, he began to press the edges of his routes outward; east beyond the natural bounds of the glens, south into lands that felt less steeped in the old presences, into territories where the Fuath’s voice came to him less often. In the Isles, their influence had been like weather — frequent, inescapable, difficult to separate from the world itself. Beyond them, it came as interruption.

The Fuath raised no objection. They allowed him to wander without resistance — a thought he returns to often, in the long solitude of the road. 

Distance, it seemed, was no barrier — only a thinning of their presence, not their reach. At times he wonders whether his drifting serves their purpose as surely as his obedience once had.

He is somewhere in his fifties now—young by Firbolg reckoning, experienced enough to carry himself with quiet authority as a guide, but with plenty of road still ahead of him. Still given to youthful impatience and overconfidence, and to holding too tightly to his own course, mistrustful of those shaped in lands not his own, and seldom finding easy welcome among them. He has been working increasingly distant country for some years, far from Muirath *(MEER-ath)* and Loch Caorach, carrying his gifts and his questions and his grief in roughly equal measure.`,
  },
  {
    id: "crossing",
    group: "story",
    title: "The Crossing",
    content: `He met them at a river crossing three days east of the last familiar landmark on his mental map of the world. The causeway was old and in poor repair — sound enough for a single careful traveler, but the group ahead of him had a laden cart and uncertain footing and were arguing about whether to risk it or turn back. Eòghan watched them for a moment from the bank, reading the water the way he'd been reading water since before he could name what he was doing, and then walked down and offered his services for a fair fee.

He showed them where the stones held and where they didn't, how to redistribute the cart's weight, where each of them should place their feet. They made it across in under an hour without losing anything to the current. The relief in the group was warm and immediate, the kind that makes strangers briefly generous with each other, and they made camp together on the far bank as the light went.

Someone produced a small mirror — catching the last of the evening light to check a wound, or simply habit, the kind of mundane gesture that happens a dozen times in any camp without anyone remarking on it. It was an unassuming thing, plain worked metal on the back, nothing ornate. When it caught the moonlight rising off the river that plain metal back glowed.

To Eòghan it burned like golden fire.

He went very still. The sensation was unmistakable — the Fuath's attention locking onto something the way it locks onto nothing else, a compass finding north so suddenly and completely that the needle nearly snaps. He had never felt it at this intensity. Not on the drove roads, not on the loch, not in all the years of quiet instructions and subtle interventions. Whatever that mirror was, wherever it had come from, the Fuath wanted it in his sight.

He didn't reach for it. He didn't ask about it. He simply, the next morning, suggested he knew the country ahead and offered to travel with them a while if they were heading roughly eastward.

They were.

He doesn't know yet what the mirror means. It might need to be brought somewhere specific, offered to something, held over a particular body of water at a particular hour. Its owner might be significant in ways that have nothing to do with the object itself — someone whose path intersects with whatever the Fuath is orchestrating across generations. It might mark the presence of another water spirit's influence extending into unfamiliar territory, something that needs watching closely. It might be something else entirely, something he doesn't yet have the framework to understand.

What he knows is this: his path runs with this group for now. The waters told him so.`,
  },
  {
    id: "table",
    title: "At the Table",
    content: null,
    isList: true,
    items: [
      "Speaks with a deep accent similar to old Scottish",
      "Most visibly relaxed — most fully himself — in rain, fog and wind",
      "Never seems quite as wet or cold as those around him",
      "Navigates fog as though something in it is guiding him",
      "Instinctively drawn toward water; uncomfortable far from it in dry landlocked places",
      "Watches the mirror's owner with quiet, patient, private attention",
      "Can speak to animals and plants",
      "Can disguise himself as a smaller humanoid when needed",
      "When he uses Hidden Step to turn invisible, the air where he stood turns briefly cool and damp, carrying a faint trace of salt sea — subtle enough that most never notice",
    ],
  },
];

const stats = [
  { stat: "Charisma", score: 0, note: "Primary — spellcasting" },
  { stat: "Constitution", score: 0, note: "Survival & concentration" },
  { stat: "Dexterity", score: 0, note: "Armor & initiative" },
  { stat: "Wisdom", score: 0, note: "Perception & resistance" },
  { stat: "Intelligence", score: 0, note: "" },
  { stat: "Strength", score: 0, note: "" },
];

const spells = ["Charm Person", "Faerie Fire", "Misty Step", "Hunger of Hadar", "Hex"];

export default function EoghanSheet() {
  useGlobalStyles();
  const [activeSection, setActiveSection] = useState("who");
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const contentSections = sections.filter((s) => !s.isHeader && !s.isStats && s.id !== "table" && s.group);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0d0f14",
      color: "#c8bfaf",
      fontFamily: "'Crimson Text', 'Palatino Linotype', Palatino, Georgia, serif",
      position: "relative",
      overflowX: "hidden",
    }}>
      {/* Atmospheric background — fixed so it fills viewport regardless of stacking context */}
      <div aria-hidden="true" style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(ellipse at 20% 50%, rgba(30,50,80,0.4) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(20,40,60,0.3) 0%, transparent 50%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Mist overlay */}
      <div aria-hidden="true" style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "30vh",
        background: "linear-gradient(to top, rgba(100,130,160,0.06), transparent)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48, borderBottom: "1px solid rgba(100,130,160,0.2)", paddingBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#6a8fa8", textTransform: "uppercase", marginBottom: 16 }}>
            Character Sheet — Fey Warlock
          </div>
          <h1 style={{
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            fontWeight: 400,
            fontFamily: "'Cinzel', 'Palatino Linotype', Georgia, serif",
            color: "#e8ddd0",
            margin: "0 0 8px",
            letterSpacing: "0.04em",
            lineHeight: 1.1,
          }}>
            Eòghan <span style={{ whiteSpace: 'nowrap' }}>MacGille Fàth</span>
          </h1>
          <div style={{ fontSize: 13, color: "#6a8fa8", letterSpacing: "0.15em", marginBottom: 24 }}>
            YO-ən · mah-KIL-yuh · FAH
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 24px" }}>
            {[
              ["Race", "Firbolg"],
              ["Class", "Warlock"],
              ["Patron", "Archfey — The Fuath"],
              ["Alignment", "Chaotic Neutral"],
              ["Background", "Outlander"],
              ["Origin", "Muirath, The Eirach Isles"],
            ].map(([label, value]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#4a6a7a", textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 13, color: "#a0b8c8" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Portrait + tagline block */}
        {(() => {        
          const IMAGE_URL = eoghanCharacterImage;
          return IMAGE_URL ? (
            <div style={{
              width: "calc(100% + 48px)",
              marginLeft: -24,
              marginRight: -24,
              marginBottom: 40,
              overflow: "hidden",
              borderRadius: 4,
            }}>
              <img
                src={IMAGE_URL}
                alt="Eòghan MacGille Fàth"
                style={{
                  width: "100%",
                  display: "block",
                }}
              />
              <p style={{
                margin: 0,
                padding: "14px 24px 10px",
                fontFamily: "'Crimson Text', 'Georgia', serif",
                fontStyle: "italic",
                fontSize: 16,
                color: "#6a8a9a",
                textAlign: "center",
                lineHeight: 1.7,
                // background: "rgba(10,20,30,0.5)",
              }}>
                A giant pagan Eirachean who is most himself in rain and fog, follows waterways like instinct,{" "}
                knows things he shouldn't, carries a grief he won't name,{" "}
                and serves something ancient and patient beneath the waves —{" "}
                toward ends he is only beginning to discern.
              </p>
            </div>
          ) : null;
        })()}

        {/* Stats block */}
        <div style={{
          background: "rgba(20,35,50,0.6)",
          border: "1px solid rgba(100,130,160,0.15)",
          borderRadius: 4,
          padding: "24px 28px",
          marginBottom: 40,
          isolation: "isolate",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#4a6a7a", textTransform: "uppercase", marginBottom: 20 }}>
            Ability Scores — Standard Array
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px 8px", marginBottom: 24 }}>
            {stats.map(({ stat, score, note }) => (
              <div key={stat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  borderRadius: "50%",
                  border: "1px solid rgba(100,130,160,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  color: score >= 14 ? "#8ab4c8" : score <= 8 ? "#4a5a6a" : "#7a9aaa",
                  flexShrink: 0,
                }}>
                  {score}
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "#a0b8c8" }}>{stat}</div>
                  <div style={{ fontSize: 12, color: "#4a6a7a" }}>{note}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(100,130,160,0.1)", paddingTop: 16 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.25em", color: "#4a6a7a", textTransform: "uppercase", marginBottom: 10 }}>
              Key Spells
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {spells.map((spell) => (
                <span key={spell} style={{
                  fontSize: 12,
                  padding: "3px 10px",
                  border: "1px solid rgba(100,130,160,0.25)",
                  borderRadius: 2,
                  color: "#7a9aaa",
                  letterSpacing: "0.05em",
                }}>
                  {spell}
                </span>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(100,130,160,0.1)", paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontSize: 14, letterSpacing: "0.25em", color: "#4a6a7a", textTransform: "uppercase", marginBottom: 10 }}>
              In Play
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0 24px" }}>
              {[
                "Speaks with a deep accent similar to old Scottish",
                "Most himself in rain, fog and wind — unsettlingly so",
                "Never seems quite as wet or cold as those around him",
                "Navigates fog as though something guides him",
                "Instinctively drawn toward water; uneasy far from it",
                "Watches the mirror's owner with quiet, private attention",
                "Can speak to animals and plants (Firbolg racial)",
                "Can disguise as a smaller humanoid (Firbolg Magic)",
                "Hidden Step: when invisible, the air turns briefly cool and damp — a faint trace of salt sea, unnoticed by most",
              ].map((item, i) => (
                <li key={i} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: "1px solid rgba(100,130,160,0.06)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#8a9aaa",
                }}>
                  <span style={{ color: "#3a6a7a", marginTop: 5, fontSize: 7, flexShrink: 0 }}>◆</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Navigation — two centered rows */}
        {[
          { label: "Character", group: "character" },
          { label: "History", group: "story" },
        ].map(({ label, group }) => {
          const groupSections = contentSections.filter(s => s.group === group);
          return (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3a5a6a", textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>
                {label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                {groupSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    style={{
                      padding: "6px 14px",
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      background: activeSection === s.id ? "rgba(100,130,160,0.2)" : "transparent",
                      border: `1px solid ${activeSection === s.id ? "rgba(100,130,160,0.4)" : "rgba(100,130,160,0.1)"}`,
                      borderRadius: 2,
                      color: activeSection === s.id ? "#a0c0d0" : "#5a7a8a",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ marginBottom: 32 }} />

        {/* Content */}
        {contentSections.map((section) => (
          <div
            key={section.id}
            style={{
              display: activeSection === section.id ? "block" : "none",
            }}
          >
            <h2 style={{
              fontSize: 13,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "'Cinzel', 'Palatino Linotype', Georgia, serif",
              fontWeight: 400,
              color: "#6a8fa8",
              marginBottom: 24,
            }}>
              {section.title}
            </h2>

            {section.isList ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {section.items.map((item, i) => (
                  <li key={i} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(100,130,160,0.08)",
                    fontSize: 16,
                    lineHeight: 1.5,
                    color: "#b0a898",
                  }}>
                    <span style={{ color: "#3a6a7a", marginTop: 6, fontSize: 8 }}>◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                {section.content.split("\n\n").map((para, i) => (
                  <p key={i} style={{
                    fontSize: 16,
                    lineHeight: 1.9,
                    fontFamily: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
                    color: "#b0a898",
                    marginBottom: 20,
                    textAlign: "justify",
                  }}>
                    {renderInline(para)}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div style={{
          marginTop: 60,
          paddingTop: 24,
          borderTop: "1px solid rgba(100,130,160,0.1)",
          textAlign: "center",
          fontSize: 11,
          color: "#2a3a4a",
          letterSpacing: "0.15em",
        }}>
          Muirath · The Eirach Isles
        </div>
      </div>
    </div>
  );
}
