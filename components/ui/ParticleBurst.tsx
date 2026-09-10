const PARTICLE_COUNT = 14;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  const dist = 60 + (i % 3) * 22;
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, delay: (i % 4) * 0.03 };
});

// Plays once automatically when mounted — drop it into a "success moment"
// screen (hatch complete, ability learned) and it celebrates on arrival.
export default function ParticleBurst({ color = "var(--accent-2)" }: { color?: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ color }} aria-hidden>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            background: color,
            animationDelay: `${p.delay}s`,
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
          }}
        />
      ))}
    </div>
  );
}
