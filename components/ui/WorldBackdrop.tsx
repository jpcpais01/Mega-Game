// Fixed, mounted once in the root layout so it persists as one continuous
// "world" behind every screen rather than resetting per page. Everything
// here is CSS gradients + a handful of small animated dots — no images or
// video, so it costs effectively nothing at runtime.
const MOTE_COUNT = 16;
const MOTES = Array.from({ length: MOTE_COUNT }, (_, i) => ({
  left: (i * 37) % 100,
  top: 40 + ((i * 53) % 60),
  size: 2 + (i % 3),
  delay: (i % 8) * 0.6,
  duration: 9 + (i % 5) * 2,
}));

export default function WorldBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 world-gradient" />
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="mote"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
          }}
        />
      ))}
      <div className="absolute inset-0 world-vignette" />
    </div>
  );
}
