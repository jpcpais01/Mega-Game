export type Pt = { x: number; y: number };

/** Solve the affine transform (canvas setTransform args) mapping src triangle -> dst triangle. */
export function triangleAffine(src: [Pt, Pt, Pt], dst: [Pt, Pt, Pt]) {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;
  const denom = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(denom) < 1e-9) return null;

  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / denom;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / denom;
  const e = d0.x - a * s0.x - c * s0.y;

  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / denom;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / denom;
  const f = d0.y - b * s0.x - d * s0.y;

  return { a, b, c, d, e, f };
}

export function expandTriangle(pts: [Pt, Pt, Pt], amount: number): [Pt, Pt, Pt] {
  const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
  const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
  return pts.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * amount, y: p.y + (dy / len) * amount };
  }) as [Pt, Pt, Pt];
}

/** Inverse-distance-weighted blend of control point offsets at a given normalized (0..1) position. */
export function idwOffset(
  pos: Pt,
  controls: { pos: Pt; offset: Pt }[],
  power = 2.2
): Pt {
  let sumW = 0;
  let ox = 0;
  let oy = 0;
  for (const c of controls) {
    const dist = Math.hypot(pos.x - c.pos.x, pos.y - c.pos.y);
    if (dist < 1e-4) return c.offset;
    const w = 1 / Math.pow(dist, power);
    sumW += w;
    ox += w * c.offset.x;
    oy += w * c.offset.y;
  }
  if (sumW === 0) return { x: 0, y: 0 };
  return { x: ox / sumW, y: oy / sumW };
}
