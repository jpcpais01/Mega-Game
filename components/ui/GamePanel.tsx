export function PanelCorners() {
  return (
    <>
      <span className="panel-corner panel-corner-tl" />
      <span className="panel-corner panel-corner-tr" />
      <span className="panel-corner panel-corner-bl" />
      <span className="panel-corner panel-corner-br" />
    </>
  );
}

export default function GamePanel({
  children,
  className = "",
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`game-panel rounded-2xl ${className}`}
      style={glow ? { boxShadow: `0 0 28px -6px ${glow}, inset 0 1px 0 rgba(255,255,255,0.06)` } : undefined}
    >
      <PanelCorners />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
