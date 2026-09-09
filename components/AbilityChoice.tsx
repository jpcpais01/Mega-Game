"use client";

import { Ability, MonsterData } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";

export default function AbilityChoice({
  monster,
  onChoose,
}: {
  monster: MonsterData;
  onChoose: (ability: Ability) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 w-full pop-in">
      <SpriteAnimator imageDataUrl={monster.imageDataUrl} size={140} />

      <div className="text-center">
        <h2 className="text-lg font-bold">Choose {monster.monsterName}&apos;s first ability</h2>
        <p className="text-xs text-[var(--text-dim)] mt-1">This will generate a brand-new animation</p>
      </div>

      <div className="grid grid-cols-1 gap-3 w-full">
        {monster.abilities.map((ability) => (
          <button
            key={ability.name}
            onClick={() => onChoose(ability)}
            className="glass-panel rounded-2xl p-4 text-left active:scale-95 transition-transform"
          >
            <p className="font-bold text-sm">{ability.name}</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">{ability.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
