'use client';
import { useMemo } from 'react';

interface Props { dotCanvas: HTMLCanvasElement | null }

export default function DotPreview({ dotCanvas }: Props) {
  const previewUrl = useMemo(
    () => (dotCanvas ? dotCanvas.toDataURL('image/png') : null),
    [dotCanvas],
  );

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm">
      <span className="text-sm font-medium text-gray-600 block mb-2">変換後（ドット絵）</span>
      {previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={previewUrl}
          alt="変換後のドット絵"
          className="w-full object-contain rounded"
          style={{ maxHeight: '400px', imageRendering: 'pixelated' }}
        />
      ) : (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded text-gray-400 text-sm">
          画像をアップロードしてください
        </div>
      )}
    </div>
  );
}
