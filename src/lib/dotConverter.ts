export interface ConvertOptions {
  pixelSize: number;
  threshold: number;
  brightness: number;
  contrast: number;
  colorCount: number;
  colors: string[];
  showGrid: boolean;
  gridColor: string;
  gridOpacity: number;
  outputSize: number;
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

function getColorIndex(gray: number, colorCount: number, threshold: number): number {
  if (colorCount === 2) return gray >= threshold ? 0 : 1;
  const step = 256 / colorCount;
  return clamp(Math.floor((255 - gray) / step), 0, colorCount - 1);
}

export function convertToDotArt(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  opts: ConvertOptions,
): HTMLCanvasElement {
  const { pixelSize, threshold, brightness, contrast, colorCount, colors,
    showGrid, gridColor, gridOpacity, outputSize } = opts;

  const aspect = sh / sw;
  const dotCols = Math.max(1, Math.round(pixelSize));
  const dotRows = Math.max(1, Math.round(pixelSize * aspect));

  const small = document.createElement('canvas');
  small.width = dotCols;
  small.height = dotRows;
  const sc = small.getContext('2d')!;
  sc.drawImage(source, sx, sy, sw, sh, 0, 0, dotCols, dotRows);

  const id = sc.getImageData(0, 0, dotCols, dotRows);
  const data = id.data;
  const rgbs = colors.slice(0, colorCount).map(hexToRgb);

  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = applyBrightnessContrast(gray, brightness, contrast);
    const c = rgbs[getColorIndex(gray, colorCount, threshold)];
    data[i] = c.r;
    data[i + 1] = c.g;
    data[i + 2] = c.b;
    data[i + 3] = 255;
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

  if (showGrid && dotCols > 1 && dotRows > 1) {
    const { r, g, b } = hexToRgb(gridColor);
    oc.strokeStyle = `rgba(${r},${g},${b},${gridOpacity})`;
    oc.lineWidth = 1;
    for (let x = 1; x < dotCols; x++) {
      // Math.floorで最近傍補間の実際のドット境界に合わせる
      const px = Math.floor(x * outW / dotCols) + 0.5;
      oc.beginPath();
      oc.moveTo(px, 0);
      oc.lineTo(px, outH);
      oc.stroke();
    }
    for (let y = 1; y < dotRows; y++) {
      const py = Math.floor(y * outH / dotRows) + 0.5;
      oc.beginPath();
      oc.moveTo(0, py);
      oc.lineTo(outW, py);
      oc.stroke();
    }
  }

  return out;
}
