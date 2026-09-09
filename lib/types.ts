export type EggStat = {
  name: string;
  value: number; // 1-100
};

export type EggData = {
  eggName: string;
  lore: string;
  stats: EggStat[];
  imagePrompt: string;
  imageDataUrl: string;
  essenceIds: string[];
};

export type MeshPoint = {
  id: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  label: string;
};

export type MonsterData = {
  monsterName: string;
  lore: string;
  imagePrompt: string;
  imageDataUrl: string;
  meshPoints: MeshPoint[];
};
