// Animated egg/monster/ability art is a real animated WebP (see
// lib/animated-image.ts) — a plain <img> plays and loops it natively
// forever, no sprite sheet, no canvas slicing, no custom animation loop.
export default function SpriteAnimator({
  imageDataUrl,
  size = 280,
}: {
  imageDataUrl: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URLs from our own API, not a lazy-loadable content image
    <img
      src={imageDataUrl}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, imageRendering: "pixelated", display: "block" }}
    />
  );
}
