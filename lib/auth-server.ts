import "server-only";
import { NextRequest } from "next/server";
import { adminAuth } from "./firebase/admin";

export class UnauthorizedError extends Error {}

export async function requireUser(req: NextRequest): Promise<{ uid: string; email: string | null }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    throw new UnauthorizedError("Missing Authorization header");
  }
  // Only the token-verification call itself should map to "invalid session" —
  // adminAuth() initializing the Admin SDK (e.g. missing server env vars) is
  // a distinct, unrelated failure. Catching both together used to swallow
  // the real "Firebase Admin env vars are missing" message and report a
  // misleading "sign in again" instead, sending debugging down the wrong path.
  const auth = adminAuth();
  try {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new UnauthorizedError("Invalid or expired session — please sign in again");
  }
}
