"use client";

import Image from "next/image";
import { EggData } from "@/lib/types";
import StatBar from "./StatBar";

export default function EggReveal({
  egg,
  onHatch,
  loading,
}: {
  egg: EggData;
  onHatch: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-40 bg-[var(--accent)]" />
        <Image
          src={egg.imageDataUrl}
          alt={egg.eggName}
          width={512}
          height={512}
          unoptimized
          className="relative w-full h-full object-contain float drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
        />
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
