// A still PNG (eggs, or a monster/ability before its video finishes) and an
// animated WebP (see lib/animated-image.ts, monster/ability idle loops)
// both render the exact same way — a plain <img>. The animated ones play
// and loop natively forever, no canvas, no slicing, no custom JS loop.
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
