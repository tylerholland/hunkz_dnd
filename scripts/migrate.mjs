#!/usr/bin/env node
/**
 * Migration script: seeds DynamoDB with existing characters and uploads
 * portraits to S3. Run once after deploying the SAM backend.
 *
 * Usage:
 *   cd scripts && npm install
 *   node migrate.mjs
 *
 * Prerequisites:
 *   - AWS CLI configured (aws configure) with us-west-1 access
 *   - SAM stack deployed (dnd-character-builder)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REGION         = "us-west-1";
const TABLE_NAME     = "dnd-characters";
const PORTRAITS_BUCKET = "hunkz-dnd-portraits";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3     = new S3Client({ region: REGION });

const rl  = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

const CHARACTERS = ["aragorn", "eoghan", "aesop"];

async function uploadPortrait(slug, dataUrl) {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Unrecognised portrait data URL format");

  const [, imgType, b64] = match;
  const ext = imgType === "jpeg" ? "jpg" : imgType;
  const key = `portraits/${slug}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: PORTRAITS_BUCKET,
    Key: key,
    Body: Buffer.from(b64, "base64"),
    ContentType: `image/${imgType}`,
  }));

  return `https://${PORTRAITS_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

async function main() {
  console.log("\n=== DnD Character Migration ===\n");

  // ── Step 1: has the stack been deployed yet? ──────────────────────────────────
  const deployed = await ask("Has the SAM stack been deployed? (y/N): ");
  const isDeployed = deployed.trim().toLowerCase() === "y";

  if (!isDeployed) {
    // Just generate the hash so they can deploy, then come back
    const dmPassword = await ask("Set DM master password (unlocks any character): ");
    const dmHash     = await bcrypt.hash(dmPassword, 10);

    console.log("\n┌─────────────────────────────────────────────────────────────┐");
    console.log("│  DM PASSWORD HASH — copy this for your SAM deploy           │");
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log(`│  ${dmHash}`);
    console.log("└─────────────────────────────────────────────────────────────┘\n");
    console.log("Next steps:");
    console.log("  1. Copy the hash above");
    console.log("  2. Run: cd ../backend && sam deploy --parameter-overrides \"DmPasswordHash=<hash>\"");
    console.log("  3. Re-run this script and answer Y to seed your characters\n");

    rl.close();
    return;
  }

  // ── Characters ───────────────────────────────────────────────────────────────
  for (const slug of CHARACTERS) {
    const charPath = join(__dirname, `../src/characters/${slug}.json`);
    let char;
    try {
      char = JSON.parse(readFileSync(charPath, "utf8"));
    } catch {
      console.log(`  Skipping ${slug} — file not found at ${charPath}`);
      continue;
    }

    console.log(`\nMigrating ${char.name} (${slug})...`);

    // Check if already exists
    const existing = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { slug } }));
    if (existing.Item) {
      const overwrite = await ask(`  ${char.name} already exists in DynamoDB. Overwrite? (y/N): `);
      if (overwrite.toLowerCase() !== "y") {
        console.log("  Skipped.");
        continue;
      }
    }

    const password = await ask(`  Set password for ${char.name}: `);
    const passwordHash = await bcrypt.hash(password, 10);

    // Upload portrait
    let portraitUrl = null;
    if (char.portrait) {
      process.stdout.write("  Uploading portrait... ");
      try {
        portraitUrl = await uploadPortrait(slug, char.portrait);
        console.log(`done → ${portraitUrl}`);
      } catch (e) {
        console.log(`failed (${e.message}) — continuing without portrait`);
      }
    }

    // Strip base64 portrait, add portraitUrl
    const { portrait, ...charData } = char;
    const now = new Date().toISOString();

    await dynamo.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...charData,
        slug,
        portraitUrl,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      },
    }));

    console.log(`  Saved to DynamoDB.`);
  }

  rl.close();
  console.log("\n=== Migration complete! ===\n");
  console.log("Next steps:");
  console.log("  1. Set VITE_API_URL in .env using the API URL from the deploy output");
  console.log("  2. Run ./deploy.sh again to deploy the frontend with the API URL baked in\n");
}

main().catch(err => {
  console.error("\nError:", err.message);
  process.exit(1);
});
