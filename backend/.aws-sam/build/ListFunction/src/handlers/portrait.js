const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest } = require("../lib/response");

const s3 = new S3Client();
const BUCKET = process.env.PORTRAITS_BUCKET;
const REGION = process.env.AWS_REGION;

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  const { password, contentType = "image/jpeg" } = JSON.parse(event.body || "{}");

  if (!contentType.startsWith("image/")) return badRequest("Invalid content type");

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  const auth = await verifyPassword(password || "", result.Item);
  if (!auth.valid) return forbidden();

  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const key = `portraits/${slug}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );

  const portraitUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  return ok({ uploadUrl, portraitUrl, key });
};
