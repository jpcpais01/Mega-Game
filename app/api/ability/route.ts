import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase/admin";
import { GRID_TEMPLATE_INSTRUCTION, gridAlignmentTemplate } from "@/lib/grid-template";
import { generateImage } from "@/lib/openrouter";
import { abilityAnimationMotion, abilityAnimationPrompt } from "@/lib/prompts";
import { LearnedAbility } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const monsterName: unknown = body?.monsterName;
    const monsterImageDataUrl: unknown = body?.monsterImageDataUrl;
    const abilityName: unknown = body?.abilityName;
    const abilityDescription: unknown = body?.abilityDescription;
    const savedMonsterId: unknown = body?.savedMonsterId;

    if (
      typeof monsterName !== "string" ||
      typeof monsterImageDataUrl !== "string" ||
      !monsterImageDataUrl.startsWith("data:") ||
      typeof abilityName !== "string" ||
      typeof abilityDescription !== "string"
    ) {
      return NextResponse.json(
        { error: "monsterName, monsterImageDataUrl, abilityName, abilityDescription are required" },
        { status: 400 }
      );
    }

    const template = await gridAlignmentTemplate();
    const imageDataUrl = await generateImage({
      prompt: `${abilityAnimationPrompt({ monsterName, abilityName, abilityDescription })} ${GRID_TEMPLATE_INSTRUCTION}`,
      referenceImages: [monsterImageDataUrl, template],
      spriteSheet: abilityAnimationMotion({ abilityName, abilityDescription }),
      // Attacks intentionally shift the character's mass (a lunge, an
      // outstretched arm) — full alignment would cancel that motion out
      // along with the drift, so damp the correction instead of snapping it.
      alignStrength: 0.5,
    });

    // Persist the (shrunk) result in this same request, right next to
    // generation, instead of the client sending the full, un-shrunk sprite
    // sheet back to the server in a second request — a high-detail sheet
    // can be several MB, which used to blow past the platform's request
    // body size limit and fail with a raw, non-JSON "Request Entity Too
    // Large" the client couldn't even parse. A save failure here never
    // fails the whole request — the animation itself already succeeded.
    let saved = false;
    let saveError: string | null = null;
    if (typeof savedMonsterId === "string" && savedMonsterId) {
      try {
        const { uid } = await requireUser(req);
        const { shrinkDataUrlForFirestore } = await import("@/lib/image-resize");
        const docRef = adminDb().collection("users").doc(uid).collection("monsters").doc(savedMonsterId);
        const snapshot = await docRef.get();
        if (!snapshot.exists) throw new Error("Monster not found");
        const shrunkImageDataUrl = await shrinkDataUrlForFirestore(imageDataUrl);
        const learnedAbility: LearnedAbility = { name: abilityName, description: abilityDescription, imageDataUrl: shrunkImageDataUrl };
        await docRef.update({ learnedAbility });
        saved = true;
      } catch (err) {
        saveError = err instanceof Error ? err.message : "Failed to save this ability to your collection";
        console.error("ability save error:", saveError);
      }
    }

    return NextResponse.json({ imageDataUrl, saved, saveError });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error rendering ability animation";
    console.error("ability error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
