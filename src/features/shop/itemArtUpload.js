// A shop item's picture from the DM's own image: cropped to the centre square
// and saved as a 480×480 JPEG (the size and quality the built-in item art
// uses), then uploaded. Returns the picture's URL.
import { presignShopItemArt } from "../../api";

export const ITEM_ART_SIZE = 480;

export async function squareJpeg(file, size = ITEM_ART_SIZE) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  canvas.getContext("2d").drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.8));
}

export async function uploadItemArt(file, dmPassword) {
  if (!file?.type?.startsWith("image/")) throw new Error("Pick an image file.");
  const blob = await squareJpeg(file);
  const { uploadUrl, portraitUrl } = await presignShopItemArt(file.name.replace(/\.\w+$/, ".jpg"), "image/jpeg", blob.size, dmPassword);
  const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
  if (!res.ok) throw new Error("Upload failed");
  return portraitUrl;
}
