import { NextRequest, NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase/admin";
import { uploadDataUrlToStorage } from "@/lib/storage";
import { LearnedAbility } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const abilityName: unknown = body?.abilityName;
    const abilityDescription: unknown = body?.abilityDescription;
    const animationImageDataUrl: unknown = body?.animationImageDataUrl;

    if (typeof abilityName !== "string" || typeof abilityDescription !== "string" || typeof animationImageDataUrl !== "string") {
      return NextResponse.json(
        { error: "abilityName, abilityDescription, animationImageDataUrl are required" },
        { status: 400 }
      );
    }

    const docRef = adminDb().collection("users").doc(uid).collection("monsters").doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Monster not found" }, { status: 404 });
    }

    const imageDataUrl = await uploadDataUrlToStorage(
      `users/${uid}/monsters/${id}/ability.png`,
      animationImageDataUrl
    );

    const learnedAbility: LearnedAbility = { name: abilityName, description: abilityDescription, imageDataUrl };
    await docRef.update({ learnedAbility });

    return NextResponse.json({ learnedAbility });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error saving learned ability";
    console.error("monsters/[id]/ability POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
