"use client";

import { LearnedAbility, MonsterData } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";
import GameButton from "./ui/GameButton";
import ParticleBurst from "./ui/ParticleBurst";

export default function AbilityLearned({
  monster,
  ability,
  onDone,
  saved,
}: {
  monster: MonsterData;
  ability: LearnedAbility;
  onDone: () => void;
  saved: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-30 bg-[var(--accent-2)]" />
        <ParticleBurst color="var(--gold)" />
        <div className="relative">
          <SpriteAnimator imageDataUrl={ability.imageDataUrl} size={256} />
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide">{monster.monsterName} learned</p>
        <h2 className="font-display text-xl text-[var(--gold)] mt-1">{ability.name}</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xs mx-auto">{ability.description}</p>
      </div>

      {saved && <p className="text-xs text-[var(--accent-2)] -mt-2">✓ Saved to your collection</p>}

      <GameButton onClick={onDone}>Back to Nest</GameButton>
    </div>
  );
}
