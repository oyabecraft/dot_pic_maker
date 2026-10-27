export interface ConvertOptions {
  pixelSize: number;
  /** 色の境目となる明るさ（0〜255、明るい側から降順）。色数 - 1 個。 */
  thresholds: number[];
  brightness: number;
  contrast: number;
  colorCount: number;
  colors: string[];
  showGrid: boolean;
  gridColor: string;
  gridOpacity: number;
  outputSize: number;
}

/**
 * ドット格子の中間データ。
 * indices[y * cols + x] = パレット内の色インデックス。
 * PNG描画・SVG書き出しなど各種エクスポートはこのデータを起点にする。
 */
export interface DotGrid {
  cols: number;
  rows: number;
  aspect: number;
  indices: Uint8Array;
  palette: string[];
}

interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function applyBrightnessContrast(gray: number, brightness: number, contrast: number): number {
  let v = gray + (brightness / 100) * 255;
  if (contrast !== 0) {
    const f = (259 * (contrast + 255)) / (255 * (259 - contrast));
    v = f * (v - 128) + 128;
  }
  return clamp(v, 0, 255);
}

/** 明るさを色数で均等に区切ったしきい値（2色なら [128]、3色なら [171, 85]）。 */
export function defaultThresholds(colorCount: number): number[] {
  return Array.from({ length: colorCount - 1 }, (_, k) => Math.round(256 - ((k + 1) * 256) / colorCount));
}

/** gray より大きいしきい値の数 = 色インデックス（0 = 明色）。 */
function getColorIndex(gray: number, thresholds: number[]): number {
  let idx = 0;
  for (const t of thresholds) if (gray < t) idx++;
  return idx;
}

/**
 * 画像を縮小・量子化して、各ドットの色インデックス格子を生成する。
 * 描画には関与せず、純粋なデータのみを返す。
 */
export function buildDotGrid(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  opts: ConvertOptions,
): DotGrid {
  const { pixelSize, thresholds, brightness, contrast, colorCount, colors } = opts;

  const aspect = sh / sw;
  const cols = Math.max(1, Math.round(pixelSize));
  const rows = Math.max(1, Math.round(pixelSize * aspect));

  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const sc = small.getContext('2d')!;
  sc.drawImage(source, sx, sy, sw, sh, 0, 0, cols, rows);

  const data = sc.getImageData(0, 0, cols, rows).data;
  const indices = new Uint8Array(cols * rows);

  for (let p = 0, i = 0; i < data.length; i += 4, p++) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = applyBrightnessContrast(gray, brightness, contrast);
    indices[p] = getColorIndex(gray, thresholds);
  }

  return { cols, rows, aspect, indices, palette: colors.slice(0, colorCount) };
}

/**
 * 格子データを最近傍補間で拡大し、表示・PNG保存用のキャンバスを描画する。
 * showGrid が有効なときだけグリッド線を焼き込む（印刷ワークシート用途）。
 */
export function renderDotCanvas(grid: DotGrid, opts: ConvertOptions): HTMLCanvasElement {
  const { cols, rows, aspect, indices, palette } = grid;
  const { showGrid, gridColor, gridOpacity, outputSize } = opts;

  const rgbs = palette.map(hexToRgb);
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const sc = small.getContext('2d')!;
  const id = sc.createImageData(cols, rows);
  for (let p = 0; p < indices.length; p++) {
    const c = rgbs[indices[p]] ?? { r: 0, g: 0, b: 0 };
    const o = p * 4;
    id.data[o] = c.r;
    id.data[o + 1] = c.g;
    id.data[o + 2] = c.b;
    id.data[o + 3] = 255;
  }
  sc.putImageData(id, 0, 0);

  const outW = outputSize;
  const outH = Math.round(outputSize * aspect);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const oc = out.getContext('2d')!;
  oc.imageSmoothingEnabled = false;
  oc.drawImage(small, 0, 0, outW, outH);

  if (showGrid && cols > 1 && rows > 1) {
    const { r, g, b } = hexToRgb(gridColor);
    oc.strokeStyle = `rgba(${r},${g},${b},${gridOpacity})`;
    oc.lineWidth = 1;
    for (let x = 1; x < cols; x++) {
      // Math.floorで最近傍補間の実際のドット境界に合わせる
      const px = Math.floor(x * outW / cols) + 0.5;
      oc.beginPath();
      oc.moveTo(px, 0);
      oc.lineTo(px, outH);
      oc.stroke();
    }
    for (let y = 1; y < rows; y++) {
      const py = Math.floor(y * outH / rows) + 0.5;
      oc.beginPath();
      oc.moveTo(0, py);
      oc.lineTo(outW, py);
      oc.stroke();
    }
  }

  return out;
}

/** 後方互換: 格子生成と描画を一括で行う。 */
export function convertToDotArt(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  opts: ConvertOptions,
): HTMLCanvasElement {
  return renderDotCanvas(buildDotGrid(source, sx, sy, sw, sh, opts), opts);
}

export interface SvgOptions {
  /** 1ドットあたりの一辺の長さ（SVGユーザー単位 = Tinkercad取り込み時のmm目安）。 */
  dotSize?: number;
  /** 背景の塗り。null（既定）なら背景なし＝塗られたドットだけが押し出し対象になる。 */
  background?: string | null;
}

/**
 * 格子データをSVG文字列に変換する。
 * Tinkercad / Fusion / Illustrator などで「押し出し」できるよう、
 * グリッド線は入れず、同色の連続ドットを横方向にまとめた矩形で出力する。
 * 色ごとに <g> でまとめるため、色単位で選択・高さ変更しやすい。
 */
export function gridToSvg(grid: DotGrid, options: SvgOptions = {}): string {
  const { dotSize = 10, background = null } = options;
  const { cols, rows, indices, palette } = grid;
  const w = cols * dotSize;
  const h = rows * dotSize;

  const byColor = new Map<number, string[]>();
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      const idx = indices[y * cols + x];
      let run = 1;
      while (x + run < cols && indices[y * cols + x + run] === idx) run++;
      const rect =
        `<rect x="${x * dotSize}" y="${y * dotSize}" width="${run * dotSize}" height="${dotSize}"/>`;
      const arr = byColor.get(idx);
      if (arr) arr.push(rect);
      else byColor.set(idx, [rect]);
      x += run;
    }
  }

  const groups = Array.from(byColor.entries())
    .map(([idx, rects]) => `<g fill="${palette[idx] ?? '#000000'}">${rects.join('')}</g>`)
    .join('');

  const bg = background
    ? `<rect x="0" y="0" width="${w}" height="${h}" fill="${background}"/>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${bg}${groups}</svg>`
  );
}
