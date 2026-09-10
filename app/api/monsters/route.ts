import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase/admin";
import { shrinkDataUrlForFirestore } from "@/lib/image-resize";
import { Ability, EggStat, SavedMonster, SavedMonsterSummary } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function monstersCollection(uid: string) {
  return adminDb().collection("users").doc(uid).collection("monsters");
}

type StoredMonster = Omit<SavedMonster, "id" | "createdAt"> & { createdAt: Timestamp };

function toSavedMonster(id: string, data: StoredMonster): SavedMonster {
  return { ...data, id, createdAt: data.createdAt.toMillis() };
}

function toSummary(saved: SavedMonster): SavedMonsterSummary {
  return {
    id: saved.id,
    eggName: saved.eggName,
    eggLore: saved.eggLore,
    stats: saved.stats,
    essenceIds: saved.essenceIds,
    monsterName: saved.monsterName,
    monsterLore: saved.monsterLore,
    monsterImageDataUrl: saved.monsterImageDataUrl,
    abilities: saved.abilities,
    learnedAbility: saved.learnedAbility
      ? { name: saved.learnedAbility.name, description: saved.learnedAbility.description }
      : null,
    createdAt: saved.createdAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireUser(req);
    const snapshot = await monstersCollection(uid).orderBy("createdAt", "desc").limit(30).get();
    const monsters = snapshot.docs.map((doc) => toSummary(toSavedMonster(doc.id, doc.data() as StoredMonster)));
    return NextResponse.json({ monsters });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error listing collection";
    console.error("monsters GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    const eggName: unknown = body?.eggName;
    const eggLore: unknown = body?.eggLore;
    const stats: unknown = body?.stats;
    const essenceIds: unknown = body?.essenceIds;
    const eggImageDataUrl: unknown = body?.eggImageDataUrl;
    const monsterName: unknown = body?.monsterName;
    const monsterLore: unknown = body?.monsterLore;
    const monsterImageDataUrl: unknown = body?.monsterImageDataUrl;
    const abilities: unknown = body?.abilities;

    if (
      typeof eggName !== "string" ||
      typeof eggLore !== "string" ||
      !Array.isArray(stats) ||
      !Array.isArray(essenceIds) ||
      typeof eggImageDataUrl !== "string" ||
      typeof monsterName !== "string" ||
      typeof monsterLore !== "string" ||
      typeof monsterImageDataUrl !== "string" ||
      !Array.isArray(abilities)
    ) {
      return NextResponse.json({ error: "Missing or invalid monster fields" }, { status: 400 });
    }

    const docRef = monstersCollection(uid).doc();
    const [eggImageShrunk, monsterImageShrunk] = await Promise.all([
      shrinkDataUrlForFirestore(eggImageDataUrl),
      shrinkDataUrlForFirestore(monsterImageDataUrl),
    ]);

    const data: StoredMonster = {
      eggName,
      eggLore,
      stats: stats as EggStat[],
      essenceIds: essenceIds as string[],
      eggImageDataUrl: eggImageShrunk,
      monsterName,
      monsterLore,
      monsterImageDataUrl: monsterImageShrunk,
      abilities: abilities as Ability[],
      learnedAbility: null,
      createdAt: Timestamp.now(),
    };
    await docRef.set(data);

    return NextResponse.json(toSavedMonster(docRef.id, data));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error saving monster";
    console.error("monsters POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
