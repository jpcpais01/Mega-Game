import { NextRequest, NextResponse } from "next/server";
import { ESSENCES } from "@/lib/essences";
import { fallbackMeshPoints } from "@/lib/mesh";
import { callChatJSON, generateImage } from "@/lib/openrouter";
import {
  animationThinkerSystemPrompt,
  animationThinkerUserPrompt,
  monsterDesignerSystemPrompt,
  monsterDesignerUserPrompt,
} from "@/lib/prompts";
import { EggStat, MeshPoint, MonsterData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RawMonsterJson = {
  monsterName?: unknown;
  lore?: unknown;
  imagePrompt?: unknown;
};

function validateMonsterJson(raw: unknown): { monsterName: string; lore: string; imagePrompt: string } {
  const data = raw as RawMonsterJson;
  if (typeof data.monsterName !== "string" || !data.monsterName.trim()) {
    throw new Error("Monster designer response missing monsterName");
  }
  if (typeof data.lore !== "string") {
    throw new Error("Monster designer response missing lore");
  }
  if (typeof data.imagePrompt !== "string" || !data.imagePrompt.trim()) {
    throw new Error("Monster designer response missing imagePrompt");
  }
  return { monsterName: data.monsterName.trim(), lore: data.lore.trim(), imagePrompt: data.imagePrompt.trim() };
}

function validateMeshPoints(raw: unknown): MeshPoint[] | null {
  const data = raw as { points?: unknown };
  if (!Array.isArray(data.points)) return null;
  const points: MeshPoint[] = [];
  data.points.forEach((p, i) => {
    const point = p as { x?: unknown; y?: unknown; label?: unknown };
    const x = typeof point.x === "number" ? point.x : Number(point.x);
    const y = typeof point.y === "number" ? point.y : Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    points.push({
      id: `point-${i}`,
      x: Math.min(0.98, Math.max(0.02, x)),
      y: Math.min(0.98, Math.max(0.02, y)),
      label: typeof point.label === "string" && point.label.trim() ? point.label.trim() : `point-${i}`,
    });
  });
  if (points.length < 4 || points.length > 7) return null;
  return points;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const eggName: unknown = body?.eggName;
    const lore: unknown = body?.lore;
    const stats: unknown = body?.stats;
    const essenceIds: unknown = body?.essenceIds;

    if (typeof eggName !== "string" || typeof lore !== "string" || !Array.isArray(stats) || !Array.isArray(essenceIds)) {
      return NextResponse.json({ error: "eggName, lore, stats, essenceIds are required" }, { status: 400 });
    }

    const essences = essenceIds.map((id) => {
      const found = ESSENCES.find((e) => e.id === id);
      if (!found) throw new Error(`Unknown essence id: ${id}`);
      return found;
    });

    const rawMonsterJson = await callChatJSON({
      system: monsterDesignerSystemPrompt(),
      userText: monsterDesignerUserPrompt({
        eggName,
        lore,
        stats: stats as EggStat[],
        essences,
      }),
    });
    const monsterJson = validateMonsterJson(rawMonsterJson);

    const imageDataUrl = await generateImage({ prompt: monsterJson.imagePrompt });

    let meshPoints: MeshPoint[] | null = null;
    try {
      const rawMesh = await callChatJSON({
        system: animationThinkerSystemPrompt(),
        userText: animationThinkerUserPrompt(),
        userImageDataUrl: imageDataUrl,
      });
      meshPoints = validateMeshPoints(rawMesh);
    } catch (meshErr) {
      console.error("animation-thinker error, using fallback mesh:", meshErr);
    }
    if (!meshPoints) {
      meshPoints = fallbackMeshPoints(monsterJson.monsterName);
    }

    const monster: MonsterData = {
      ...monsterJson,
      imageDataUrl,
      meshPoints,
    };

    return NextResponse.json(monster);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error hatching monster";
    console.error("hatch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
