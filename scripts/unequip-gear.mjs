#!/usr/bin/env node
/**
 * One-time cleanup: mark every character's non-armor/non-shield/non-weapon
 * EQUIPMENT items as stowed (equipped: false). The weapons list is untouched. New items already
 * default to stowed; this fixes items created before that change, which were
 * saved (or defaulted) as equipped.
 *
 *   node scripts/unequip-gear.mjs                 # dry run — prints the plan, writes nothing
 *   node scripts/unequip-gear.mjs --skip-modded   # dry run, keeping items with mods/attunement equipped
 *   node scripts/unequip-gear.mjs --apply [--skip-modded]   # write the changes
 *
 * Reads only slug, name and equipment (never passwords/hashes).
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const REGION = "us-west-1";
const TABLE_NAME = "dnd-characters";
// Kept equipped: armor/shields and weapons that ended up in the equipment
// list — by type, or by name when the type is missing/non-standard
// (e.g. an untyped "Shield", type "Armour", or "Light Weapon").
const KEEP_EQUIPPED = /\b(armou?r|shield|weapon)s?\b/i;
// Sentinel (non-character) records — see backend/src/lib/specialItems.js.
const RESERVED = new Set(["initiative", "npc-combat", "roll-history", "map-library", "party-roster", "npc-library", "counter-wheels", "app-meta", "house-rules"]);

const apply = process.argv.includes("--apply");
const skipModded = process.argv.includes("--skip-modded");
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function isModded(item) {
  const mods = (item.mods || []).filter((m) => m && m.attribute && String(m.value ?? "").trim() !== "");
  return mods.length > 0 || !!item.requiresAttunement;
}

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await dynamo.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: "slug, #n, equipment",
      ExpressionAttributeNames: { "#n": "name" },
      ExclusiveStartKey,
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items.filter((item) => item.slug && !RESERVED.has(item.slug));
}

const characters = await scanAll();
let totalChanged = 0;
let charactersChanged = 0;

for (const char of characters.sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
  const equipment = Array.isArray(char.equipment) ? char.equipment : [];
  const toStow = equipment.filter((item) => {
    if (!item || item.equipped === false) return false;
    if (KEEP_EQUIPPED.test(String(item.type || "")) || KEEP_EQUIPPED.test(String(item.name || ""))) return false;
    if (skipModded && isModded(item)) return false;
    return true;
  });
  if (toStow.length === 0) continue;

  charactersChanged += 1;
  totalChanged += toStow.length;
  console.log(`\n${char.name || char.slug} (${char.slug}) — ${toStow.length} item(s) to stow:`);
  for (const item of toStow) {
    const flag = isModded(item) ? "   ⚠ has mods/attunement — stowing drops its stat bonus" : "";
    console.log(`  - ${item.name || "(unnamed)"}${item.type ? ` [${item.type}]` : ""}${item.qty != null ? ` ×${item.qty}` : ""}${flag}`);
  }

  if (apply) {
    const ids = new Set(toStow.map((item) => item.id));
    const next = equipment.map((item) => (item && ids.has(item.id) ? { ...item, equipped: false } : item));
    await dynamo.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { slug: char.slug },
      UpdateExpression: "SET equipment = :next",
      ExpressionAttributeValues: { ":next": next },
    }));
    console.log("  ✓ written");
  }
}

console.log(`\n${apply ? "Applied" : "Dry run"}: ${totalChanged} item(s) across ${charactersChanged} character(s)${skipModded ? " (items with mods/attunement kept equipped)" : ""}.`);
if (!apply) console.log("Nothing was written. Re-run with --apply to make these changes.");
