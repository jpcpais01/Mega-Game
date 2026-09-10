// Idle/ability animations are generated as a short video (see
// lib/video-api.ts), then reassembled into one real animated WebP (see
// lib/animated-image.ts) — never a sprite sheet, never client-side slicing.
export const VIDEO_SPRITE_FPS = 10;
export const VIDEO_SPRITE_DURATION_SECONDS = 5;
