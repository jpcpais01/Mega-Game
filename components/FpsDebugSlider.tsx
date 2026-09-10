"use client";

export default function FpsDebugSlider({
  fps,
  onChange,
  min = 2,
  max = 16,
}: {
  fps: number;
  onChange: (fps: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[var(--panel-border)] text-[var(--text-dim)]">
      <span className="text-[10px] uppercase tracking-wide shrink-0">Debug: speed</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={fps}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
      />
      <span className="text-[10px] tabular-nums shrink-0 w-12 text-right">{fps} fps</span>
    </div>
  );
}
