export const SPRITE_GRID_COLS = 3;
export const SPRITE_GRID_ROWS = 3;
export const SPRITE_FRAME_COUNT = SPRITE_GRID_COLS * SPRITE_GRID_ROWS;
export const SPRITE_FPS = 8;

const IDLE_MOTION =
  "a simple, smooth, seamlessly-looping idle animation appropriate to the subject (e.g. a gentle bob/breathe/weight-shift for a creature, or a subtle rock/pulse/glow-flicker for an inanimate object)";

function frameOrderDiagram(): string {
  const rows: string[] = [];
  let n = 1;
  for (let r = 0; r < SPRITE_GRID_ROWS; r++) {
    const cells: string[] = [];
    for (let c = 0; c < SPRITE_GRID_COLS; c++) cells.push(String(n++));
    rows.push(cells.join(" | "));
  }
  return rows.join("\n");
}

export function buildSpriteSheetSuffix(motionDescription: string = IDLE_MOTION): string {
  return `This must be a single sprite sheet image containing exactly ${SPRITE_FRAME_COUNT} animation frames arranged in a perfectly even ${SPRITE_GRID_COLS}-column by ${SPRITE_GRID_ROWS}-row grid. The frames are numbered in this exact reading order (left-to-right, then top-to-bottom), frame 1 being the animation's starting pose:\n${frameOrderDiagram()}\nEach cell is an identical fixed size. Every frame must show the exact same subject at the exact same scale and the exact same centered position within its own cell — pixel-aligned to that cell's boundaries, with no drifting, shifting, zooming, or resizing between frames. Only the pose itself changes frame to frame, depicting ${motionDescription}, and frame ${SPRITE_FRAME_COUNT} must flow naturally back into frame 1 for a perfect loop. Do not draw any grid lines, cell borders, frame numbers, or labels anywhere in the image — the grid must be invisible, only implied by even spacing.`;
}

export const SPRITE_SHEET_SUFFIX = buildSpriteSheetSuffix();
