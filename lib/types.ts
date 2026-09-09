export type EggStat = {
  name: string;
  value: number; // 1-100
};

export type EggDetails = {
  eggName: string;
  lore: string;
  stats: EggStat[];
  imagePrompt: string;
  essenceIds: string[];
};

export type EggData = EggDetails & {
  imageDataUrl: string | null; // null while the image is still generating
};

export type MonsterData = {
  monsterName: string;
  lore: string;
  imagePrompt: string;
  imageDataUrl: string; // sprite sheet: SPRITE_GRID_COLS x SPRITE_GRID_ROWS frames
};
