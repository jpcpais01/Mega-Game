export default function BattlePage() {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-4 gap-6">
      <div className="text-center">
        <h1 className="font-display text-xl tracking-wide text-[var(--gold)]">THE ARENA</h1>
        <p className="text-xs text-[var(--text-dim)] mt-1">Where monsters will clash</p>
      </div>

      <div className="relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-20 bg-[var(--danger)]" />
        <svg viewBox="0 0 100 100" className="relative w-32 h-32" fill="none" aria-hidden>
          <rect x="20" y="38" width="60" height="46" rx="4" stroke="var(--gold-dim)" strokeWidth="3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={i}
              x1={28 + i * 11}
              y1="38"
              x2={28 + i * 11}
              y2="84"
              stroke="var(--gold-dim)"
              strokeWidth="2.5"
            />
          ))}
          <path d="M22 38 L50 14 L78 38" stroke="var(--gold)" strokeWidth="3" fill="none" />
          <circle cx="50" cy="14" r="5" fill="var(--gold)" />
        </svg>
      </div>

      <div className="game-panel rounded-2xl px-5 py-3">
        <p className="font-display text-sm tracking-widest text-[var(--gold)]">WORK IN PROGRESS</p>
      </div>
      <p className="text-xs text-[var(--text-dim)] text-center max-w-xs">
        The gate is sealed for now. Keep forging — your strongest monsters will have somewhere to prove themselves soon.
      </p>
    </div>
  );
}
