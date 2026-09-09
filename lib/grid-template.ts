import "server-only";
import sharp from "sharp";
import { SPRITE_GRID_COLS, SPRITE_GRID_ROWS } from "./sprite";

const SIZE = 1024;

function cellCenters(): { x: number; y: number }[] {
  const cellW = SIZE / SPRITE_GRID_COLS;
  const cellH = SIZE / SPRITE_GRID_ROWS;
  const centers: { x: number; y: number }[] = [];
  for (let r = 0; r < SPRITE_GRID_ROWS; r++) {
    for (let c = 0; c < SPRITE_GRID_COLS; c++) {
      centers.push({ x: (c + 0.5) * cellW, y: (r + 0.5) * cellH });
    }
  }
  return centers;
}

function gridLinesSvg(): string {
  const cellW = SIZE / SPRITE_GRID_COLS;
  const cellH = SIZE / SPRITE_GRID_ROWS;
  let lines = "";
  for (let c = 1; c < SPRITE_GRID_COLS; c++) {
    const x = c * cellW;
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${SIZE}" stroke="black" stroke-width="2"/>`;
  }
  for (let r = 1; r < SPRITE_GRID_ROWS; r++) {
    const y = r * cellH;
    lines += `<line x1="0" y1="${y}" x2="${SIZE}" y2="${y}" stroke="black" stroke-width="2"/>`;
  }
  return lines;
}

function dotsSvg(): string {
  return cellCenters()
    .map(({ x, y }) => `<circle cx="${x}" cy="${y}" r="6" fill="black"/>`)
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

function eggOutlinesSvg(): string {
  const cellW = SIZE / SPRITE_GRID_COLS;
  const cellH = SIZE / SPRITE_GRID_ROWS;
  const halfW = cellW * 0.26;
  const halfH = cellH * 0.34;
  return cellCenters()
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
  if (!cachedGridTemplate) cachedGridTemplate = svgToDataUrl(gridLinesSvg() + dotsSvg());
  return cachedGridTemplate;
}

export function eggGridAlignmentTemplate(): Promise<string> {
  if (!cachedEggGridTemplate) cachedEggGridTemplate = svgToDataUrl(gridLinesSvg() + dotsSvg() + eggOutlinesSvg());
  return cachedEggGridTemplate;
}

export const GRID_TEMPLATE_INSTRUCTION =
  "One of the attached reference images is a plain alignment TEMPLATE, not a design reference — a 3x3 grid with a small black dot marking the exact center of each cell. Use it purely as an invisible layout guide: render the subject at the exact same scale in every cell, perfectly centered on that cell's dot, with the subject's bounding box matching that cell's boundaries. Do NOT copy, reproduce, or draw the template's grid lines, dots, or white background in your output — the final image must contain only the subject itself with no visible guide marks.";

export const EGG_GRID_TEMPLATE_INSTRUCTION =
  "The attached reference image is a plain alignment TEMPLATE, not a design reference — a 3x3 grid with a small black dot and a thin egg-shaped outline marking the exact center, size, and silhouette for each cell. Use it purely as an invisible layout guide: draw your fully designed, fully styled egg so its silhouette matches that thin outline's position and size exactly in every cell, centered on the dot. Do NOT copy, reproduce, or draw the template's grid lines, dots, thin outline, or white background in your output — the final image must contain only your fully rendered egg with no visible guide marks.";
