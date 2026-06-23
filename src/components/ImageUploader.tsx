'use client';
import { useRef, useState, useCallback } from 'react';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

interface Props { onFile: (src: string) => void }

export default function ImageUploader({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('この画像形式には対応していません。JPG・PNG・WebPを選択してください。');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('画像サイズが大きすぎます。10MB以下の画像を選択してください。');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onFile(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [onFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="mt-8 max-w-xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="画像をアップロード"
      >
        <div className="text-5xl mb-4 select-none">🖼️</div>
        <p className="text-gray-700 font-medium text-lg">画像をドロップ、またはクリックして選択</p>
        <p className="text-sm text-gray-400 mt-2">JPG・PNG・WebP / 最大10MB</p>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />
    </div>
  );
}
