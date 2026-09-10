"use client";

import { SlotEntry } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";
import { PanelCorners } from "./ui/GamePanel";

export default function Nest({
  slots,
  onSelectEmpty,
  onViewFilled,
}: {
  slots: (SlotEntry | null)[];
  onSelectEmpty: (index: number) => void;
  onViewFilled: (index: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="text-center">
        <h1 className="font-display text-xl tracking-wide text-[var(--gold)]">YOUR NEST</h1>
        <p className="text-xs text-[var(--text-dim)] mt-1">Tap an empty pedestal to forge a new egg</p>
      </div>

      <div className="grid grid-cols-5 gap-2 w-full">
        {slots.map((entry, i) =>
          entry ? (
            <button
              key={i}
              onClick={() => onViewFilled(i)}
              className="game-panel rounded-2xl aspect-square flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
              style={{ boxShadow: "0 0 16px -4px var(--accent)" }}
            >
              <PanelCorners />
              <SpriteAnimator imageDataUrl={entry.monster.imageDataUrl} size={64} />
            </button>
          ) : (
            <button
              key={i}
              onClick={() => onSelectEmpty(i)}
              className="relative aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center active:scale-95 transition-transform"
              style={{ borderColor: "rgba(217, 180, 95, 0.35)", background: "rgba(217, 180, 95, 0.04)" }}
            >
              <span className="text-xl text-[var(--gold)] opacity-70">+</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
