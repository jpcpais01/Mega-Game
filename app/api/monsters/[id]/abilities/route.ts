import { NextRequest, NextResponse } from "next/server";
import { validateAbilities } from "@/lib/abilities";
import { requireUser, UnauthorizedError } from "@/lib/auth-server";
import { getEssence } from "@/lib/essences";
import { adminDb } from "@/lib/firebase/admin";
import { callChatJSON } from "@/lib/openrouter";
import { newAbilitiesSystemPrompt, newAbilitiesUserPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

// Generates 4 fresh candidate abilities for an already-hatched, already-
// saved monster — the "Learn New Attack" flow in the Vault. Only returns
// candidates; nothing is persisted until the player picks one and its
// animation finishes (see /api/sprite-video/status, which writes the
// chosen ability into this monster's `abilities` subcollection).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(req);
    const { id } = await params;

    const docRef = adminDb().collection("users").doc(uid).collection("monsters").doc(id);
    const [snapshot, abilitiesSnapshot] = await Promise.all([docRef.get(), docRef.collection("abilities").get()]);
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Monster not found" }, { status: 404 });
    }
    const data = snapshot.data() as {
      monsterName: string;
      monsterLore: string;
      essenceIds: string[];
    };

    const essences = data.essenceIds
      .map((essenceId) => getEssence(essenceId))
      .filter((e): e is NonNullable<typeof e> => e != null);
    if (essences.length === 0) {
      return NextResponse.json({ error: "This monster has no resolvable essences" }, { status: 400 });
    }

    const alreadyKnown = abilitiesSnapshot.docs.map((doc) => (doc.data() as { name: string }).name);

    const rawJson = await callChatJSON({
      system: newAbilitiesSystemPrompt(),
      userText: newAbilitiesUserPrompt({
        monsterName: data.monsterName,
        monsterLore: data.monsterLore,
        essences,
        alreadyKnown,
      }),
    });
    const parsed = rawJson as { abilities?: unknown };
    const abilities = validateAbilities(parsed.abilities, essences);

    return NextResponse.json({ abilities });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error generating new abilities";
    console.error("monsters/[id]/abilities POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
