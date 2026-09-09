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
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new UnauthorizedError("Invalid or expired session — please sign in again");
  }
}
