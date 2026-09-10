"use client";

import { useEffect, useRef, useState } from "react";
import { VIDEO_SPRITE_DURATION_SECONDS } from "@/lib/sprite";
import { SavedMonsterSummary } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";
import { PanelCorners } from "./ui/GamePanel";

const IDLE_REPEATS = 3;

// The idle loop 3 times, then each learned attack once (in order), then
// back to idle — repeating forever. A monster with no attacks yet just
// shows its idle loop with nothing to cycle.
function buildCycleSequence(monster: SavedMonsterSummary): string[] {
  if (monster.learnedAbilities.length === 0) return [monster.monsterImageDataUrl];
  const sequence: string[] = [];
  for (const ability of monster.learnedAbilities) {
    for (let i = 0; i < IDLE_REPEATS; i++) sequence.push(monster.monsterImageDataUrl);
    sequence.push(ability.imageDataUrl);
  }
  return sequence;
}

export default function VaultMonsterCard({ monster, onTap }: { monster: SavedMonsterSummary; onTap: () => void }) {
  const sequence = buildCycleSequence(monster);
  // Held in a ref (not a dependency) so the interval below always reads the
  // latest sequence — including right after a new attack is learned —
  // without needing to tear down and restart the timer on every change.
  const sequenceRef = useRef(sequence);
  useEffect(() => {
    sequenceRef.current = sequence;
  });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (sequenceRef.current.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % sequenceRef.current.length);
    }, VIDEO_SPRITE_DURATION_SECONDS * 1000);
    return () => clearInterval(id);
  }, []);

  const imageDataUrl = sequence[index % sequence.length] ?? monster.monsterImageDataUrl;

  return (
    <button
      onClick={onTap}
      className="game-panel relative rounded-2xl p-2 flex flex-col items-center gap-1 overflow-hidden active:scale-95 transition-transform"
      style={{ boxShadow: "0 0 16px -4px var(--accent)" }}
    >
      <PanelCorners />
      <SpriteAnimator imageDataUrl={imageDataUrl} size={84} />
      <p className="text-[11px] font-bold text-center truncate w-full">{monster.monsterName}</p>
    </button>
  );
}
