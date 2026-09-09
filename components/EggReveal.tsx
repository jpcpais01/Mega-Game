"use client";

import { EggData } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";
import StatBar from "./StatBar";

export default function EggReveal({
  egg,
  onHatch,
  loading,
  imageFailed = false,
}: {
  egg: EggData;
  onHatch: () => void;
  loading: boolean;
  imageFailed?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-40 bg-[var(--accent)]" />
        {egg.imageDataUrl ? (
          <div className="relative drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <SpriteAnimator imageDataUrl={egg.imageDataUrl} size={224} />
          </div>
        ) : imageFailed ? (
          <div className="relative text-7xl float opacity-70">🥚</div>
        ) : (
          <div className="relative w-4/5 h-4/5 rounded-full shimmer" />
        )}
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold">{egg.eggName}</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xs mx-auto">{egg.lore}</p>
      </div>

      <div className="glass-panel rounded-2xl p-4 w-full flex flex-col gap-3">
        {egg.stats.map((s, i) => (
          <StatBar key={s.name} name={s.name} value={s.value} delayMs={i * 90} />
        ))}
      </div>

      <button
        className="glow-btn w-full rounded-2xl py-4 text-base font-bold tracking-wide text-white"
        onClick={onHatch}
        disabled={loading}
      >
        {loading ? "Hatching…" : "Hatch Egg"}
      </button>
    </div>
  );
}
