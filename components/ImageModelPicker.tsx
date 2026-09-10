"use client";

import { IMAGE_MODELS, ImageModelId } from "@/lib/image-models";

export default function ImageModelPicker({
  selected,
  onSelect,
}: {
  selected: ImageModelId;
  onSelect: (id: ImageModelId) => void;
}) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase text-center">
        Forge Engine
      </p>
      <div className="grid grid-cols-3 gap-2">
        {IMAGE_MODELS.map((m) => {
          const active = m.id === selected;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="tile-panel rounded-xl px-1.5 py-2 flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
              style={{
                boxShadow: active ? "0 0 0 2px var(--gold), 0 0 14px -3px var(--gold)" : undefined,
              }}
            >
              <span
                className={`text-[11px] font-bold leading-none ${active ? "text-[var(--gold)]" : "text-[var(--text)]"}`}
              >
                {m.name}
              </span>
              <span className="text-[8px] text-[var(--text-dim)] leading-tight text-center">{m.tagline}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
