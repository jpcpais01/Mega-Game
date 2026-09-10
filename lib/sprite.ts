export const SPRITE_GRID_COLS = 3;
export const SPRITE_GRID_ROWS = 3;
export const SPRITE_FRAME_COUNT = SPRITE_GRID_COLS * SPRITE_GRID_ROWS;
export const SPRITE_FPS = 8;

// The egg's idle animation uses a smaller grid than monster/ability sheets —
// a static object rocking/glowing gently reads fine with fewer frames, and
// it keeps egg generation cheaper and faster.
export const EGG_SPRITE_GRID_COLS = 2;
export const EGG_SPRITE_GRID_ROWS = 2;
export const EGG_SPRITE_FRAME_COUNT = EGG_SPRITE_GRID_COLS * EGG_SPRITE_GRID_ROWS;

export type SpriteGrid = { cols: number; rows: number };

const IDLE_MOTION =
  "a simple, smooth, seamlessly-looping idle animation appropriate to the subject (e.g. a gentle bob/breathe/weight-shift for a creature, or a subtle rock/pulse/glow-flicker for an inanimate object)";

function frameOrderDiagram(grid: SpriteGrid): string {
  const rows: string[] = [];
  let n = 1;
  for (let r = 0; r < grid.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < grid.cols; c++) cells.push(String(n++));
    rows.push(cells.join(" | "));
  }
  return rows.join("\n");
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

// Spells out, in plain prose, exactly which grid cell each frame number is —
// row-by-row, left to right, "like reading a book" — so there's no ambiguity
// left for the model to misinterpret about frame order.
function frameOrderProse(grid: SpriteGrid): string {
  const lines: string[] = [];
  let n = 1;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const pos = c === 0 && r === 0 ? " (top-left, the very first cell)" : "";
      lines.push(`Frame ${n} is the ${ordinal(r + 1)} row, ${ordinal(c + 1)} column${pos}.`);
      n++;
    }
  }
  return lines.join(" ");
}

export function buildSpriteSheetSuffix(
  motionDescription: string = IDLE_MOTION,
  grid: SpriteGrid = { cols: SPRITE_GRID_COLS, rows: SPRITE_GRID_ROWS }
): string {
  const frameCount = grid.cols * grid.rows;
  return `This must be a single sprite sheet image containing exactly ${frameCount} animation frames arranged in a perfectly even ${grid.cols}-column by ${grid.rows}-row grid. The frames go in reading order, exactly like reading a book: left to right across the first row, then down to the next row and left to right again, and so on. Spelled out explicitly: ${frameOrderProse(grid)} As a compact diagram (numbered top-left to bottom-right):\n${frameOrderDiagram(grid)}\nEach cell is an identical fixed size. Every frame must show the exact same subject at the exact same scale and the exact same centered position within its own cell — pixel-aligned to that cell's boundaries, with no drifting, shifting, zooming, or resizing between frames. Only the pose itself changes frame to frame, depicting ${motionDescription}, and frame ${frameCount} must flow naturally back into frame 1 for a perfect loop. Do not draw any grid lines, cell borders, frame numbers, or labels anywhere in the image — the grid must be invisible, only implied by even spacing.`;
}

export const SPRITE_SHEET_SUFFIX = buildSpriteSheetSuffix();
