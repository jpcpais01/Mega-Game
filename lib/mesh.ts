import { MeshPoint } from "./types";

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FALLBACK_LABELS = ["head", "left-limb", "right-limb", "tail", "belly", "left-ear", "right-ear"];

export function fallbackMeshPoints(seedStr: string): MeshPoint[] {
  const rand = mulberry32(hashSeed(seedStr));
  const count = 5 + Math.floor(rand() * 3); // 5-7
  const base: { x: number; y: number }[] = [
    { x: 0.5, y: 0.15 },
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 0.35, y: 0.85 },
    { x: 0.65, y: 0.85 },
    { x: 0.3, y: 0.25 },
    { x: 0.7, y: 0.25 },
  ];
  return base.slice(0, count).map((p, i) => ({
    id: `fallback-${i}`,
    x: Math.min(0.95, Math.max(0.05, p.x + (rand() - 0.5) * 0.1)),
    y: Math.min(0.95, Math.max(0.05, p.y + (rand() - 0.5) * 0.1)),
    label: FALLBACK_LABELS[i] ?? `point-${i}`,
  }));
}
