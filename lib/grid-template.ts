import "server-only";
import sharp from "sharp";
import { EGG_SPRITE_GRID_COLS, EGG_SPRITE_GRID_ROWS, SPRITE_GRID_COLS, SPRITE_GRID_ROWS, SpriteGrid } from "./sprite";

const SIZE = 1024;
// How many extra fine ruler lines to draw inside each frame cell, on top of
// the bold frame-boundary lines — gives the model a much more precise
// positional reference (like graph paper) than the coarse grid alone.
const FINE_SUBDIVISIONS = 3;

const MONSTER_GRID: SpriteGrid = { cols: SPRITE_GRID_COLS, rows: SPRITE_GRID_ROWS };
const EGG_GRID: SpriteGrid = { cols: EGG_SPRITE_GRID_COLS, rows: EGG_SPRITE_GRID_ROWS };

function cellCenters(grid: SpriteGrid): { x: number; y: number }[] {
  const cellW = SIZE / grid.cols;
  const cellH = SIZE / grid.rows;
  const centers: { x: number; y: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      centers.push({ x: (c + 0.5) * cellW, y: (r + 0.5) * cellH });
    }
  }
  return centers;
}

// Two-tier grid: bold black lines mark the actual frame boundaries, thin
// gray lines subdivide each frame further as a fine alignment ruler.
function gridLinesSvg(grid: SpriteGrid): string {
  const cellW = SIZE / grid.cols;
  const cellH = SIZE / grid.rows;
  const fineCols = grid.cols * FINE_SUBDIVISIONS;
  const fineRows = grid.rows * FINE_SUBDIVISIONS;
  const fineCellW = SIZE / fineCols;
  const fineCellH = SIZE / fineRows;

  let fine = "";
  for (let c = 1; c < fineCols; c++) {
    if (c % FINE_SUBDIVISIONS === 0) continue; // that's a bold boundary line, drawn separately
    const x = c * fineCellW;
    fine += `<line x1="${x}" y1="0" x2="${x}" y2="${SIZE}" stroke="#999" stroke-width="1"/>`;
  }
  for (let r = 1; r < fineRows; r++) {
    if (r % FINE_SUBDIVISIONS === 0) continue;
    const y = r * fineCellH;
    fine += `<line x1="0" y1="${y}" x2="${SIZE}" y2="${y}" stroke="#999" stroke-width="1"/>`;
  }

  let bold = "";
  for (let c = 1; c < grid.cols; c++) {
    const x = c * cellW;
    bold += `<line x1="${x}" y1="0" x2="${x}" y2="${SIZE}" stroke="black" stroke-width="3"/>`;
  }
  for (let r = 1; r < grid.rows; r++) {
    const y = r * cellH;
    bold += `<line x1="0" y1="${y}" x2="${SIZE}" y2="${y}" stroke="black" stroke-width="3"/>`;
  }

  return fine + bold;
}

function cellNumbersSvg(grid: SpriteGrid): string {
  return cellCenters(grid)
    .map(
      ({ x, y }, i) =>
        `<text x="${x}" y="${y}" font-size="20" font-family="sans-serif" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`
    )
    .join("");
}

// A simple mathematical egg curve (narrower top, fuller bottom) rather than a
// plain ellipse, traced with a cubic-bezier approximation — just needs to be
// a clean, consistent thin outline for the model to align its egg art to.
function eggOutlinePath(cx: number, cy: number, halfW: number, halfH: number): string {
  const top = cy - halfH;
  const bottom = cy + halfH;
  const left = cx - halfW;
  const right = cx + halfW;
  const midUpper = cy - halfH * 0.15;
  return [
    `M ${cx} ${top}`,
    `C ${cx + halfW * 0.62} ${top} ${right} ${midUpper - halfH * 0.35} ${right} ${midUpper}`,
    `C ${right} ${bottom - halfH * 0.05} ${cx + halfW * 0.72} ${bottom} ${cx} ${bottom}`,
    `C ${cx - halfW * 0.72} ${bottom} ${left} ${bottom - halfH * 0.05} ${left} ${midUpper}`,
    `C ${left} ${midUpper - halfH * 0.35} ${cx - halfW * 0.62} ${top} ${cx} ${top}`,
    "Z",
  ].join(" ");
}

function eggOutlinesSvg(grid: SpriteGrid): string {
  const cellW = SIZE / grid.cols;
  const cellH = SIZE / grid.rows;
  const halfW = cellW * 0.26;
  const halfH = cellH * 0.34;
  return cellCenters(grid)
    .map(({ x, y }) => `<path d="${eggOutlinePath(x, y, halfW, halfH)}" fill="none" stroke="black" stroke-width="2"/>`)
    .join("");
}

async function svgToDataUrl(svgBody: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="white"/>${svgBody}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

// The grid layout never changes, so cache the rendered templates for the
// life of the warm serverless instance instead of re-rasterizing every call.
let cachedGridTemplate: Promise<string> | null = null;
let cachedEggGridTemplate: Promise<string> | null = null;

export function gridAlignmentTemplate(): Promise<string> {
  if (!cachedGridTemplate) cachedGridTemplate = svgToDataUrl(gridLinesSvg(MONSTER_GRID) + cellNumbersSvg(MONSTER_GRID));
  return cachedGridTemplate;
}

export function eggGridAlignmentTemplate(): Promise<string> {
  if (!cachedEggGridTemplate)
    cachedEggGridTemplate = svgToDataUrl(gridLinesSvg(EGG_GRID) + eggOutlinesSvg(EGG_GRID) + cellNumbersSvg(EGG_GRID));
  return cachedEggGridTemplate;
}

export const GRID_TEMPLATE_INSTRUCTION =
  "One of the attached reference images is a plain alignment TEMPLATE, not a design reference — a 3x3 grid (bold lines mark each frame's boundary) with a thin fine ruler sub-grid inside every cell and a small black frame number centered in each cell. Use it purely as an invisible layout guide: render the subject at the exact same scale in every cell, perfectly centered on that cell's number, using the fine ruler lines to judge exact size and position so every frame lines up identically, and use the numbers to confirm you are placing each pose in its correct frame order. Do NOT copy, reproduce, or draw ANY of the template's bold lines, fine ruler lines, numbers, or white background in your output — the final image must contain only the subject itself with zero visible guide marks.";

export const EGG_GRID_TEMPLATE_INSTRUCTION =
  "The attached reference image is a plain alignment TEMPLATE, not a design reference — a 2x2 grid (bold lines mark each frame's boundary) with a thin fine ruler sub-grid inside every cell, a thin egg-shaped outline marking the exact size and silhouette for each cell, and a small black frame number centered in each cell. Use it purely as an invisible layout guide: draw your fully designed, fully styled egg so its silhouette matches that thin outline's position and size exactly in every cell, using the fine ruler lines to judge exact placement and the numbers to confirm correct frame order. Do NOT copy, reproduce, or draw ANY of the template's bold lines, fine ruler lines, thin egg outline, numbers, or white background in your output — the final image must contain only your fully rendered egg with zero visible guide marks.";
