import "server-only";
import { randomUUID } from "crypto";
import { adminStorageBucket } from "./firebase/admin";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]*)$/;

// Uploads a data URL to Firebase Storage and returns a public download URL in
// the same shape the Firebase client SDK's getDownloadURL() produces (a
// per-object token embedded in the query string). Storage rules can stay
// locked down to server-only access — the token itself is what authorizes
// this specific read, the same mechanism the client SDK relies on.
export async function uploadDataUrlToStorage(path: string, dataUrl: string): Promise<string> {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) {
    throw new Error("uploadDataUrlToStorage: input is not a data URL");
  }
  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const token = randomUUID();

  const bucket = adminStorageBucket();
  const file = bucket.file(path);
  await file.save(buffer, {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}
