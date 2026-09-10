import { NextRequest, NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth-server";
import { EVENT_ESSENCES } from "@/lib/essences";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const VALID_EVENT_ESSENCE_IDS = new Set(EVENT_ESSENCES.map((e) => e.id));

function userDoc(uid: string) {
  return adminDb().collection("users").doc(uid);
}

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireUser(req);
    const snap = await userDoc(uid).get();
    const unlockedEssenceIds = (snap.data()?.unlockedEssenceIds as string[] | undefined) ?? [];
    return NextResponse.json({ unlockedEssenceIds });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error loading unlocked essences";
    console.error("essences/unlocked GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const essenceId: unknown = body?.essenceId;

    if (typeof essenceId !== "string" || !VALID_EVENT_ESSENCE_IDS.has(essenceId)) {
      return NextResponse.json({ error: "Invalid essence id" }, { status: 400 });
    }

    const ref = userDoc(uid);
    const unlockedEssenceIds = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.data()?.unlockedEssenceIds as string[] | undefined) ?? [];
      if (current.includes(essenceId)) return current;
      const next = [...current, essenceId];
      tx.set(ref, { unlockedEssenceIds: next }, { merge: true });
      return next;
    });

    return NextResponse.json({ unlockedEssenceIds });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error claiming essence";
    console.error("essences/unlocked POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
