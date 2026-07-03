const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");

const s3 = new S3Client();
const BUCKET = process.env.PORTRAITS_BUCKET;
const REGION = process.env.AWS_REGION;
const MAX_PORTRAIT_SIZE_BYTES = 5 * 1024 * 1024;
const PORTRAIT_CACHE_CONTROL = "public, max-age=604800";

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const { filename, contentType, size } = body;

  if (!filename || typeof filename !== "string") return badRequest("filename required");
  if (!contentType || !contentType.startsWith("image/")) {
    return badRequest("Only image files are supported for NPC portraits");
  }
  if (!Number.isFinite(size) || size <= 0) return badRequest("size required");
  if (size > MAX_PORTRAIT_SIZE_BYTES) return badRequest("NPC portraits must be 5 MB or smaller");

  const id = crypto.randomUUID();
  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const s3Key = `npc-portraits/${id}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: contentType,
      CacheControl: PORTRAIT_CACHE_CONTROL,
    }),
    { expiresIn: 300 }
  );

  const portraitUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
  return ok({ uploadUrl, id, s3Key, portraitUrl });
};
