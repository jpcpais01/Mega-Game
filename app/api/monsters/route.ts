import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase/admin";
import { Ability, EggStat, SavedAbility, SavedMonster, SavedMonsterSummary } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function monstersCollection(uid: string) {
  return adminDb().collection("users").doc(uid).collection("monsters");
}

// Learned abilities live in their own subcollection per monster, not an
// array field on the monster doc — a monster can keep learning new attacks
// indefinitely without ever risking Firestore's 1MiB single-document cap.
function abilitiesCollection(uid: string, monsterId: string) {
  return monstersCollection(uid).doc(monsterId).collection("abilities");
}

type StoredMonster = Omit<SavedMonster, "id" | "createdAt" | "learnedAbilities"> & { createdAt: Timestamp };
type StoredAbility = Omit<SavedAbility, "id" | "learnedAt"> & { learnedAt: Timestamp };

function toSavedMonster(id: string, data: StoredMonster, learnedAbilities: SavedAbility[]): SavedMonster {
  return { ...data, id, createdAt: data.createdAt.toMillis(), learnedAbilities };
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
    monsterAnimated: saved.monsterAnimated,
    monsterStillImageDataUrl: saved.monsterStillImageDataUrl,
    abilities: saved.abilities,
    learnedAbilities: saved.learnedAbilities,
    createdAt: saved.createdAt,
  };
}

async function fetchLearnedAbilities(uid: string, monsterId: string): Promise<SavedAbility[]> {
  const snapshot = await abilitiesCollection(uid, monsterId).orderBy("learnedAt", "asc").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as StoredAbility;
    return { ...data, id: doc.id, learnedAt: data.learnedAt.toMillis() };
  });
}

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireUser(req);
    const snapshot = await monstersCollection(uid).orderBy("createdAt", "desc").limit(30).get();
    const monsters = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const learnedAbilities = await fetchLearnedAbilities(uid, doc.id);
        return toSummary(toSavedMonster(doc.id, doc.data() as StoredMonster, learnedAbilities));
      })
    );
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
    const monsterAnimated: unknown = body?.monsterAnimated;
    const monsterStillImageDataUrl: unknown = body?.monsterStillImageDataUrl;
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
      typeof monsterAnimated !== "boolean" ||
      typeof monsterStillImageDataUrl !== "string" ||
      !Array.isArray(abilities)
    ) {
      return NextResponse.json({ error: "Missing or invalid monster fields" }, { status: 400 });
    }

    // Imported dynamically (not at module scope) so a native-binary problem
    // in this sharp-dependent path can only ever break POST, never GET —
    // a module-scope import runs at load time for every method on this
    // route, so it used to take the read-only Vault listing down with it.
    const { shrinkDataUrlForFirestore } = await import("@/lib/image-resize");
    const docRef = monstersCollection(uid).doc();
    const [eggImageShrunk, monsterImageShrunk, monsterStillShrunk] = await Promise.all([
      shrinkDataUrlForFirestore(eggImageDataUrl),
      shrinkDataUrlForFirestore(monsterImageDataUrl),
      shrinkDataUrlForFirestore(monsterStillImageDataUrl),
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
      monsterAnimated,
      monsterStillImageDataUrl: monsterStillShrunk,
      abilities: abilities as Ability[],
      createdAt: Timestamp.now(),
    };
    await docRef.set(data);

    return NextResponse.json(toSavedMonster(docRef.id, data, []));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error saving monster";
    console.error("monsters POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
