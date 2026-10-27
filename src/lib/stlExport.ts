import { DotGrid } from './dotConverter';

export interface StlOptions {
  /** 1ドットの一辺（mm）。 */
  dotMm: number;
  /** 全面に敷く土台の厚み（mm）。0なら土台なし。 */
  baseMm: number;
  /** パレットの色ごとの高さ（mm、土台の上に積む分）。0の色は立体にしない。 */
  heights: number[];
}

/**
 * 1つの立体（ボディ）を表すハイトマップ。
 * 全セル共通の底面 z0 から、セルごとの上面 tops[i] まで立ち上げる。tops[i] <= z0 のセルは空。
 */
interface HeightBody {
  z0: number;
  tops: Float32Array;
}

type V3 = [number, number, number];

/**
 * ハイトマップを閉じた三角形メッシュにして、バイナリSTLを返す。
 * 上面・底面はセルごと、側面は「隣より高い側」が隣の高さとの差分だけ張るので、
 * 隣接セル間に内部面ができず、スライサーでそのまま扱える立体になる。
 * 側面は全体に出てくる高さの段ごとに区切る。区切らないと、高さの違う壁が接する角で
 * 縦の辺がずれ（T字接合）、辺がきちんと対にならない。
 */
function bodyToStl(grid: DotGrid, body: HeightBody, dot: number): ArrayBuffer {
  const { cols, rows } = grid;
  const { z0, tops } = body;
  const tris: V3[][] = [];

  // 頂点は外側から見て反時計回りで渡す（法線が外向きになる）。
  const quad = (a: V3, b: V3, c: V3, d: V3) => {
    tris.push([a, b, c], [a, c, d]);
  };
  const topAt = (c: number, r: number) =>
    c < 0 || r < 0 || c >= cols || r >= rows ? z0 : Math.max(z0, tops[r * cols + c]);

  const levels = [...new Set([z0, ...Array.from(tops, (t) => Math.max(z0, t))])].sort((a, b) => a - b);
  // [lo, hi] を高さの段で区切って、段ごとに wall(下端, 上端) を呼ぶ。
  const stacked = (lo: number, hi: number, wall: (zb: number, zt: number) => void) => {
    let prev = lo;
    for (const l of levels) {
      if (l <= lo) continue;
      if (l >= hi) break;
      wall(prev, l);
      prev = l;
    }
    wall(prev, hi);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const zt = topAt(c, r);
      if (zt <= z0) continue;
      // 画像の上端をY軸の大きい側にする（上から見て画像と同じ向き）。
      const x0 = c * dot, x1 = x0 + dot;
      const y0 = (rows - 1 - r) * dot, y1 = y0 + dot;

      quad([x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]);
      quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]);

      const east = topAt(c + 1, r);
      if (zt > east) stacked(east, zt, (b, t) => quad([x1, y0, b], [x1, y1, b], [x1, y1, t], [x1, y0, t]));
      const west = topAt(c - 1, r);
      if (zt > west) stacked(west, zt, (b, t) => quad([x0, y1, b], [x0, y0, b], [x0, y0, t], [x0, y1, t]));
      const north = topAt(c, r - 1);
      if (zt > north) stacked(north, zt, (b, t) => quad([x1, y1, b], [x0, y1, b], [x0, y1, t], [x1, y1, t]));
      const south = topAt(c, r + 1);
      if (zt > south) stacked(south, zt, (b, t) => quad([x0, y0, b], [x1, y0, b], [x1, y0, t], [x0, y0, t]));
    }
  }

  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  const header = 'dot_pic_maker';
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i));
  view.setUint32(80, tris.length, true);

  let o = 84;
  for (const [a, b, c] of tris) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz, ...a, ...b, ...c]) {
      view.setFloat32(o, v, true);
      o += 4;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

/** 高さの違いで模様を出す用（レリーフ）。土台＋各色の高さを1つの立体にまとめる。 */
export function gridToReliefStl(grid: DotGrid, opts: StlOptions): ArrayBuffer {
  const tops = new Float32Array(grid.indices.length);
  for (let i = 0; i < tops.length; i++) {
    tops[i] = opts.baseMm + (opts.heights[grid.indices[i]] ?? 0);
  }
  return bodyToStl(grid, { z0: 0, tops }, opts.dotMm);
}

/**
 * マルチカラー印刷用。土台と各色を別々の立体にする。
 * すべて同じ原点・座標で出すので、スライサーで一緒に読み込めば位置がそろう。
 */
export function gridToColorStls(
  grid: DotGrid,
  opts: StlOptions,
): { name: string; data: ArrayBuffer }[] {
  const { baseMm, heights, dotMm } = opts;
  const files: { name: string; data: ArrayBuffer }[] = [];

  if (baseMm > 0) {
    const tops = new Float32Array(grid.indices.length).fill(baseMm);
    files.push({ name: 'base.stl', data: bodyToStl(grid, { z0: 0, tops }, dotMm) });
  }

  grid.palette.forEach((hex, idx) => {
    const h = heights[idx] ?? 0;
    if (h <= 0 || !grid.indices.includes(idx)) return;
    const tops = new Float32Array(grid.indices.length);
    for (let i = 0; i < tops.length; i++) {
      tops[i] = grid.indices[i] === idx ? baseMm + h : 0;
    }
    files.push({
      name: `color${idx + 1}-${hex.replace('#', '').toUpperCase()}.stl`,
      data: bodyToStl(grid, { z0: baseMm, tops }, dotMm),
    });
  });

  return files;
}
