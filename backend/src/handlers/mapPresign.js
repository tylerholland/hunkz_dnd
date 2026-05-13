const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");

const s3 = new S3Client();
const BUCKET = process.env.PORTRAITS_BUCKET;
const REGION = process.env.AWS_REGION;
const MAX_MAP_SIZE_BYTES = 50 * 1024 * 1024;
const MAP_CONTENT_TYPES = new Set(["application/pdf"]);
const MAP_CACHE_CONTROL = "public, max-age=604800";

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const { filename, contentType, size } = body;

  if (!filename || typeof filename !== "string") return badRequest("filename required");
  if (!contentType || (!contentType.startsWith("image/") && !MAP_CONTENT_TYPES.has(contentType))) {
    return badRequest("Invalid content type");
  }
  if (!Number.isFinite(size) || size <= 0) return badRequest("size required");
  if (size > MAX_MAP_SIZE_BYTES) return badRequest("Maps must be 50 MB or smaller");

  const id = crypto.randomUUID();
  const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1].replace("jpeg", "jpg");
  const s3Key = `maps/${id}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: contentType,
      CacheControl: MAP_CACHE_CONTROL,
    }),
    { expiresIn: 300 }
  );

  const imageUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
  return ok({ uploadUrl, id, s3Key, imageUrl });
};
