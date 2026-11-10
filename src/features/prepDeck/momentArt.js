// A moment's picture from the DM's own image: scaled down to at most 1200px
// wide (kept in shape, unlike square item art) and saved as a JPEG, then
// uploaded. Returns the picture's URL.
import { presignMomentArt } from "../../api";

const MAX_WIDTH = 1200;

async function scaledJpeg(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.82));
}

export async function uploadMomentArt(file, dmPassword) {
  if (!file?.type?.startsWith("image/")) throw new Error("Pick an image file.");
  const blob = await scaledJpeg(file);
  const { uploadUrl, portraitUrl } = await presignMomentArt(file.name.replace(/\.\w+$/, ".jpg"), "image/jpeg", blob.size, dmPassword);
  const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
  if (!res.ok) throw new Error("Upload failed");
  return portraitUrl;
}
