'use client';
import { ConvertOptions, defaultThresholds } from '@/lib/dotConverter';
import { StlOptions } from '@/lib/stlExport';

const PRESETS: { name: string; colors: string[] }[] = [
  { name: '白黒', colors: ['#FFFFFF', '#888888', '#444444', '#000000'] },
  { name: 'ゲームボーイ', colors: ['#9BBC0F', '#8BAC0F', '#306230', '#0F380F'] },
  { name: '青白', colors: ['#EAF6FF', '#A8D8FF', '#0055AA', '#003366'] },
  { name: '赤黒', colors: ['#FFCCCC', '#FF3333', '#AA0000', '#111111'] },
  { name: 'クリーム茶', colors: ['#FFF3D6', '#E8C89E', '#A05020', '#5B3A1D'] },
];

interface Props {
  options: ConvertOptions;
  onChange: (opts: ConvertOptions) => void;
  onDownload: () => void;
  onDownloadSvg: () => void;
  stlOptions: StlOptions;
  onStlChange: (opts: StlOptions) => void;
  gridSize: { cols: number; rows: number } | null;
  onDownloadStl: () => void;
  onDownloadColorStls: () => void;
  onReset: () => void;
  disabled: boolean;
}

function MmInput({
  label, value, min = 0, step = 0.5, onChange,
}: {
  label: string; value: number; min?: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <input
      type="number" min={min} step={step} value={value}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && v >= min) onChange(v);
      }}
      className="w-20 border rounded px-2 py-1 text-sm text-right"
      aria-label={label}
    />
  );
}

function Slider({
  label, value, min, max, step = 1, unit = '', onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 w-36 flex-shrink-0">{label}</label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-blue-500"
        aria-label={label}
      />
      <span className="text-sm text-gray-500 w-14 text-right">
        {value}{unit}
      </span>
    </div>
  );
}

export default function ControlPanel({
  options, onChange, onDownload, onDownloadSvg,
  stlOptions, onStlChange, gridSize, onDownloadStl, onDownloadColorStls,
  onReset, disabled,
}: Props) {
  const set = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    onChange({ ...options, [key]: value });

  const setColor = (i: number, v: string) => {
    const c = [...options.colors];
    c[i] = v;
    onChange({ ...options, colors: c });
  };

  const invertColors = () => {
    const c = [...options.colors];
    const swapped = [...c];
    for (let i = 0; i < options.colorCount; i++) {
      swapped[i] = c[options.colorCount - 1 - i];
    }
    onChange({ ...options, colors: swapped });
  };

  const COLOR_LABELS = ['明色', '中間1', '中間2', '暗色'];
  const shortLabel = (i: number) =>
    i === 0 ? '明' : i === options.colorCount - 1 ? '暗' : `中${i}`;

  // 色数を変えたら、しきい値も均等割りに戻す。
  const setColorCount = (n: number) =>
    onChange({ ...options, colorCount: n, thresholds: defaultThresholds(n) });

  // しきい値どうしが追い越さないよう、隣の値の間に収める。
  const setThreshold = (k: number, v: number) => {
    const t = [...options.thresholds];
    const hi = k > 0 ? t[k - 1] - 1 : 255;
    const lo = k < t.length - 1 ? t[k + 1] + 1 : 1;
    t[k] = Math.min(hi, Math.max(lo, v));
    onChange({ ...options, thresholds: t });
  };

  const setStl = <K extends keyof StlOptions>(key: K, value: StlOptions[K]) =>
    onStlChange({ ...stlOptions, [key]: value });

  const setHeight = (i: number, v: number) => {
    const h = [...stlOptions.heights];
    h[i] = v;
    onStlChange({ ...stlOptions, heights: h });
  };

  const usedHeights = stlOptions.heights.slice(0, options.colorCount);
  const maxHeight = Math.max(0, ...usedHeights);
  const hasColorBody = usedHeights.some((h) => h > 0);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-5">

      {/* ドット粗さ */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">ドットの粗さ</h3>
        <Slider
          label={`横ドット数`}
          value={options.pixelSize}
          min={8} max={128}
          onChange={(v) => set('pixelSize', v)}
        />
        <p className="text-xs text-gray-400 mt-1 ml-36">
          値が小さい → ドットが粗い（Tinkercadのブロック数が少ない）
        </p>
      </section>

      {/* 色分け設定 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">色分け設定</h3>
        <div className="space-y-2">
          {options.thresholds.map((t, k) => (
            <Slider
              key={k}
              label={options.colorCount === 2 ? 'しきい値' : `しきい値（${shortLabel(k)}｜${shortLabel(k + 1)}）`}
              value={t} min={0} max={255}
              onChange={(v) => setThreshold(k, v)}
            />
          ))}
          <Slider label="明るさ" value={options.brightness} min={-100} max={100}
            unit="" onChange={(v) => set('brightness', v)} />
          <Slider label="コントラスト" value={options.contrast} min={-100} max={100}
            onChange={(v) => set('contrast', v)} />
        </div>
      </section>

      {/* 色設定 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">色設定</h3>

        {/* 色数 */}
        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm text-gray-600 w-36 flex-shrink-0">色数</label>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setColorCount(n)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  options.colorCount === n
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-pressed={options.colorCount === n}
              >
                {n}色
              </button>
            ))}
          </div>
        </div>

        {/* カラーピッカー */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <label className="text-sm text-gray-600 w-36 flex-shrink-0">各色</label>
          <div className="flex gap-3 flex-wrap">
            {Array.from({ length: options.colorCount }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <input
                  type="color"
                  value={options.colors[i]}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                  aria-label={COLOR_LABELS[i]}
                />
                <span className="text-xs text-gray-400">
                  {shortLabel(i)}
                </span>
              </div>
            ))}
            <button
              onClick={invertColors}
              className="self-center text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              色を反転
            </button>
          </div>
        </div>

        {/* プリセット */}
        <div className="flex items-start gap-3">
          <label className="text-sm text-gray-600 w-36 flex-shrink-0 pt-1">プリセット</label>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onChange({ ...options, colors: p.colors })}
                className="text-xs px-3 py-1 border rounded hover:bg-gray-50 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* グリッド線 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">グリッド線</h3>
        <div className="flex items-center gap-3 mb-2">
          <label className="text-sm text-gray-600 w-36 flex-shrink-0" htmlFor="grid-toggle">表示</label>
          <input
            id="grid-toggle"
            type="checkbox"
            checked={options.showGrid}
            onChange={(e) => set('showGrid', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-xs text-gray-400">
            ドットの境界を線で表示します（Tinkercadでの配置確認に使用）
          </span>
        </div>
        {options.showGrid && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 w-36 flex-shrink-0">グリッド色</label>
              <input
                type="color"
                value={options.gridColor}
                onChange={(e) => set('gridColor', e.target.value)}
                className="w-10 h-8 rounded cursor-pointer border border-gray-200"
                aria-label="グリッド色"
              />
            </div>
            <Slider
              label="透明度"
              value={Math.round(options.gridOpacity * 100)}
              min={5} max={80}
              unit="%"
              onChange={(v) => set('gridOpacity', v / 100)}
            />
          </div>
        )}
      </section>

      {/* 出力設定 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">出力設定</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 w-36 flex-shrink-0" htmlFor="output-size">出力サイズ</label>
          <select
            id="output-size"
            value={options.outputSize}
            onChange={(e) => set('outputSize', Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={256}>256px</option>
            <option value={512}>512px</option>
            <option value={1024}>1024px（推奨）</option>
            <option value={2048}>2048px</option>
          </select>
        </div>
      </section>

      {/* 3D出力 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">3D出力（STL）</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-36 flex-shrink-0">1ドットの大きさ</label>
            <MmInput label="1ドットの大きさ" value={stlOptions.dotMm} min={0.1}
              onChange={(v) => setStl('dotMm', v)} />
            <span className="text-sm text-gray-500">mm</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-36 flex-shrink-0">土台の厚み</label>
            <MmInput label="土台の厚み" value={stlOptions.baseMm}
              onChange={(v) => setStl('baseMm', v)} />
            <span className="text-sm text-gray-500">mm（0で土台なし）</span>
          </div>
          <div className="flex items-start gap-3">
            <label className="text-sm text-gray-600 w-36 flex-shrink-0 pt-1">色ごとの高さ</label>
            <div className="flex gap-3 flex-wrap">
              {Array.from({ length: options.colorCount }).map((_, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span
                    className="w-5 h-5 rounded border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: options.colors[i] }}
                  />
                  <MmInput label={`${COLOR_LABELS[i]}の高さ`} value={stlOptions.heights[i] ?? 0}
                    onChange={(v) => setHeight(i, v)} />
                  <span className="text-sm text-gray-500">mm</span>
                </div>
              ))}
            </div>
          </div>
          {gridSize && (
            <p className="text-xs text-gray-400 ml-36">
              仕上がり: {+(gridSize.cols * stlOptions.dotMm).toFixed(1)} × {+(gridSize.rows * stlOptions.dotMm).toFixed(1)} mm、
              最大の高さ {+(stlOptions.baseMm + maxHeight).toFixed(1)} mm
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-3">
          <button
            onClick={onDownloadStl}
            disabled={disabled || stlOptions.baseMm + maxHeight <= 0}
            className="flex-1 bg-orange-500 text-white py-2 rounded hover:bg-orange-600 disabled:opacity-50 font-medium transition-colors"
          >
            STL（1つにまとめる）
          </button>
          <button
            onClick={onDownloadColorStls}
            disabled={disabled || (stlOptions.baseMm <= 0 && !hasColorBody)}
            className="flex-1 bg-purple-500 text-white py-2 rounded hover:bg-purple-600 disabled:opacity-50 font-medium transition-colors"
          >
            色ごとのSTL（zip）
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          1つにまとめる = 高さの違いで模様を出す（単色印刷・Tinkercad向け）。
          色ごと = 土台（base.stl）と各色を別ファイルにし、座標をそろえて出力。スライサーでまとめて読み込み、ファイルごとにフィラメントを割り当てるとマルチカラー印刷できます。
        </p>
      </section>

      {/* ボタン */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex gap-3">
          <button
            onClick={onDownload}
            disabled={disabled}
            className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 font-medium transition-colors"
          >
            PNGで保存
          </button>
          <button
            onClick={onDownloadSvg}
            disabled={disabled}
            className="flex-1 bg-emerald-500 text-white py-2 rounded hover:bg-emerald-600 disabled:opacity-50 font-medium transition-colors"
          >
            SVGで保存
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            設定をリセット
          </button>
        </div>
        <p className="text-xs text-gray-400">
          PNG = グリッド線つきで印刷用ワークシートに。SVG = グリッドなしの図形データで、Tinkercad等に取り込んで押し出し（立体化）できます。
        </p>
      </div>
    </div>
  );
}
