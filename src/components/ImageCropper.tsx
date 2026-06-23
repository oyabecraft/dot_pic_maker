'use client';
import { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';

export interface NaturalPixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  imageSrc: string;
  onConfirm: (crop: NaturalPixelCrop) => void;
  onCancel: () => void;
}

export default function ImageCropper({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, width / height, width, height),
      width, height,
    ));
  }

  function handleConfirm() {
    if (!completedCrop || !imgRef.current) return;
    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    onConfirm({
      x: Math.round(completedCrop.x * scaleX),
      y: Math.round(completedCrop.y * scaleY),
      width: Math.round(completedCrop.width * scaleX),
      height: Math.round(completedCrop.height * scaleY),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <h2 className="text-lg font-bold mb-3 flex-shrink-0 text-gray-800">トリミング</h2>
        <p className="text-xs text-gray-500 mb-3 flex-shrink-0">ドラッグして使いたい範囲を選択してください</p>
        <div className="overflow-auto flex-1 flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              onLoad={onImageLoad}
              className="max-w-full"
              alt="トリミング対象画像"
            />
          </ReactCrop>
        </div>
        <div className="flex gap-2 mt-4 justify-end flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!completedCrop || completedCrop.width === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
