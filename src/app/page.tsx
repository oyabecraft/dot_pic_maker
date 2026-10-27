'use client';
import { useState, useCallback, useMemo } from 'react';
import {
  ConvertOptions,
  DotGrid,
  buildDotGrid,
  defaultThresholds,
  renderDotCanvas,
  gridToSvg,
} from '@/lib/dotConverter';
import { StlOptions, gridToReliefStl, gridToColorStls, gridTo3mf } from '@/lib/stlExport';
import { makeZip } from '@/lib/zip';
import ImageUploader from '@/components/ImageUploader';
import ImageCropper, { NaturalPixelCrop } from '@/components/ImageCropper';
import ControlPanel from '@/components/ControlPanel';
import DotPreview from '@/components/DotPreview';

const DEFAULT_OPTIONS: ConvertOptions = {
  pixelSize: 32,
  thresholds: defaultThresholds(2),
  brightness: 0,
  contrast: 0,
  colorCount: 2,
  colors: ['#FFFFFF', '#888888', '#444444', '#000000'],
  showGrid: true,
  gridColor: '#888888',
  gridOpacity: 0.3,
  outputSize: 512,
};

// 暗い色ほど高くする（明色は土台だけ）。
const DEFAULT_STL: StlOptions = {
  dotMm: 2,
  baseMm: 1,
  heights: [0, 1, 2, 3],
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<NaturalPixelCrop | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [stlOptions, setStlOptions] = useState<StlOptions>(DEFAULT_STL);

  const handleFile = useCallback((src: string) => {
    setImageSrc(src);
    setCrop(null);
    setImageEl(null);
    const img = new Image();
    img.onload = () => setImageEl(img);
    img.src = src;
  }, []);

  // 画像・トリミング・設定から派生する中間データ（setStateを介さず再計算）。
  const dotGrid = useMemo<DotGrid | null>(() => {
    if (!imageEl) return null;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageEl.naturalWidth;
    srcCanvas.height = imageEl.naturalHeight;
    const ctx = srcCanvas.getContext('2d')!;
    ctx.drawImage(imageEl, 0, 0);

    const sx = crop?.x ?? 0;
    const sy = crop?.y ?? 0;
    const sw = crop?.width ?? imageEl.naturalWidth;
    const sh = crop?.height ?? imageEl.naturalHeight;

    return buildDotGrid(srcCanvas, sx, sy, sw, sh, options);
  }, [imageEl, crop, options]);

  const dotCanvas = useMemo<HTMLCanvasElement | null>(
    () => (dotGrid ? renderDotCanvas(dotGrid, options) : null),
    [dotGrid, options],
  );

  const tsName = useCallback(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
  }, []);

  const handleDownload = useCallback(() => {
    if (!dotCanvas) return;
    const a = document.createElement('a');
    a.href = dotCanvas.toDataURL('image/png');
    a.download = `pixel-art-${tsName()}.png`;
    a.click();
  }, [dotCanvas, tsName]);

  const handleDownloadSvg = useCallback(() => {
    if (!dotGrid) return;
    // グリッド線なしのジオメトリ。Tinkercad等で押し出し可能。
    const svg = gridToSvg(dotGrid, { dotSize: 10 });
    saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `pixel-art-${tsName()}.svg`);
  }, [dotGrid, tsName]);

  const handleDownloadStl = useCallback(() => {
    if (!dotGrid) return;
    const stl = gridToReliefStl(dotGrid, stlOptions);
    saveBlob(new Blob([stl], { type: 'model/stl' }), `pixel-art-${tsName()}.stl`);
  }, [dotGrid, stlOptions, tsName]);

  const handleDownload3mf = useCallback(() => {
    if (!dotGrid) return;
    saveBlob(gridTo3mf(dotGrid, stlOptions), `pixel-art-${tsName()}.3mf`);
  }, [dotGrid, stlOptions, tsName]);

  const handleDownloadColorStls = useCallback(() => {
    if (!dotGrid) return;
    const files = gridToColorStls(dotGrid, stlOptions);
    if (files.length === 0) return;
    saveBlob(makeZip(files), `pixel-art-${tsName()}-colors.zip`);
  }, [dotGrid, stlOptions, tsName]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-4 py-3">
        <h1 className="text-xl font-bold text-gray-800">ドット絵メーカー</h1>
        <p className="text-sm text-gray-500">画像を2〜4色のドット絵に変換します</p>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {!imageSrc ? (
          <ImageUploader onFile={handleFile} />
        ) : (
          <>
            {/* プレビューエリア */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 元画像 */}
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    元画像{crop ? '（トリミング中）' : ''}
                  </span>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => setShowCropper(true)}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      トリミング
                    </button>
                    {crop && (
                      <button
                        onClick={() => setCrop(null)}
                        className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                      >
                        全体を使用
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setImageSrc(null);
                        setImageEl(null);
                        setCrop(null);
                      }}
                      className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                    >
                      別の画像
                    </button>
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt="元画像"
                  className="w-full object-contain rounded"
                  style={{ maxHeight: '400px' }}
                />
              </div>

              {/* 変換後 */}
              <DotPreview dotCanvas={dotCanvas} />
            </div>

            {/* 設定パネル */}
            <ControlPanel
              options={options}
              onChange={setOptions}
              onDownload={handleDownload}
              onDownloadSvg={handleDownloadSvg}
              stlOptions={stlOptions}
              onStlChange={setStlOptions}
              gridSize={dotGrid ? { cols: dotGrid.cols, rows: dotGrid.rows } : null}
              onDownloadStl={handleDownloadStl}
              onDownload3mf={handleDownload3mf}
              onDownloadColorStls={handleDownloadColorStls}
              onReset={() => { setOptions(DEFAULT_OPTIONS); setStlOptions(DEFAULT_STL); }}
              disabled={!dotCanvas}
            />
          </>
        )}
      </main>

      {/* トリミングモーダル */}
      {showCropper && imageSrc && (
        <ImageCropper
          imageSrc={imageSrc}
          onConfirm={(c) => { setCrop(c); setShowCropper(false); }}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </div>
  );
}
