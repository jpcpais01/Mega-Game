export const SPRITE_GRID_COLS = 4;
export const SPRITE_GRID_ROWS = 4;
export const SPRITE_FRAME_COUNT = SPRITE_GRID_COLS * SPRITE_GRID_ROWS;
export const SPRITE_FPS = 8;

const IDLE_MOTION =
  "a simple, smooth, seamlessly-looping idle animation appropriate to the subject (e.g. a gentle bob/breathe/weight-shift for a creature, or a subtle rock/pulse/glow-flicker for an inanimate object)";

export function buildSpriteSheetSuffix(motionDescription: string = IDLE_MOTION): string {
  return `This must be a single sprite sheet image containing exactly ${SPRITE_FRAME_COUNT} animation frames arranged in a perfectly even ${SPRITE_GRID_COLS}-column by ${SPRITE_GRID_ROWS}-row grid (${SPRITE_FRAME_COUNT} equal-sized cells, reading left-to-right then top-to-bottom as frame 1 through frame ${SPRITE_FRAME_COUNT}). Every cell must show the exact same subject at the exact same scale, position, and camera angle — only the pose changes frame to frame to depict ${motionDescription}, where the last frame flows naturally back into the first frame for a perfect loop. Do not draw any grid lines, cell borders, frame numbers, or labels anywhere in the image — the grid must be invisible, only implied by even spacing.`;
}

export const SPRITE_SHEET_SUFFIX = buildSpriteSheetSuffix();
