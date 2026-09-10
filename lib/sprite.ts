// Sprite sheets are now assembled from a short generated video (see
// lib/video-api.ts / lib/video-sprite-sheet.ts) rather than a single
// multi-frame image, so the grid is fixed by that pipeline's own
// duration/fps choice, not prompted for.
export const VIDEO_SPRITE_FPS = 10;
export const VIDEO_SPRITE_DURATION_SECONDS = 5;
export const VIDEO_SPRITE_FRAME_COUNT = VIDEO_SPRITE_FPS * VIDEO_SPRITE_DURATION_SECONDS; // 50
// 10x5 chosen so cols * rows lands exactly on VIDEO_SPRITE_FRAME_COUNT --
// no wasted/blank cells to special-case during playback.
export const VIDEO_SPRITE_GRID_COLS = 10;
export const VIDEO_SPRITE_GRID_ROWS = 5;

export const SPRITE_FPS = VIDEO_SPRITE_FPS;

export type SpriteGrid = { cols: number; rows: number };
