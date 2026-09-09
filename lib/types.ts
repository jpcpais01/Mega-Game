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

export type Ability = {
  name: string;
  description: string; // short, punchy — what the ability does
};

export type LearnedAbility = Ability & {
  imageDataUrl: string; // sprite sheet of the monster performing this ability
};

export type MonsterData = {
  monsterName: string;
  lore: string;
  imagePrompt: string;
  imageDataUrl: string; // sprite sheet: SPRITE_GRID_COLS x SPRITE_GRID_ROWS frames
  abilities: Ability[]; // exactly 4 options to choose a first ability from
};

// A finished monster sitting in one of the home screen's nest slots (in-session,
// not necessarily the same thing as a Firestore-persisted SavedMonster).
export type SlotEntry = {
  monster: MonsterData;
  learnedAbility: LearnedAbility | null;
};

// A monster persisted to a signed-in user's collection (Firestore doc + Storage URLs).
export type SavedMonster = {
  id: string;
  eggName: string;
  eggLore: string;
  stats: EggStat[];
  essenceIds: string[];
  eggImageUrl: string;
  monsterName: string;
  monsterLore: string;
  monsterImageUrl: string;
  abilities: Ability[];
  learnedAbility: LearnedAbility | null;
  createdAt: number; // epoch ms
};
