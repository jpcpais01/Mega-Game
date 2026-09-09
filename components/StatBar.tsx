export default function StatBar({
  name,
  value,
  delayMs = 0,
}: {
  name: string;
  value: number;
  delayMs?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-dim)] font-medium">{name}</span>
        <span className="font-bold tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: "linear-gradient(90deg, var(--accent-2), var(--accent))",
            animation: `stat-fill 0.9s ease-out both`,
            animationDelay: `${delayMs}ms`,
          }}
        />
      </div>
    </div>
  );
}
