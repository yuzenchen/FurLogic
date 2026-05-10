import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Sparkles, AlertCircle } from 'lucide-react';

/**
 * 拍照 / 上傳 + 縮圖預覽 + 觸發 onAnalyze。
 * 在不支援後端時隱藏分析按鈕,只允許「下一步」(全手動)。
 *
 * 圖片在 client 端先 down-scale + 重壓成 JPEG,降低送上 Worker 的 payload。
 */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

export default function PhotoCapture({
  onAnalyze,
  onSkip,
  isAnalyzing,
  error,
  hasVision,
}) {
  const fileRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPreviewUrl(compressed);
    } catch (err) {
      console.error('compress failed', err);
    } finally {
      e.target.value = ''; // 允許再次選同一張
    }
  };

  const reset = () => setPreviewUrl(null);

  return (
    <div className="p-5 h-full flex flex-col animate-in fade-in duration-300">
      <h2 className="font-bold text-2xl text-gray-800 mb-1">拍照配餐</h2>
      <p className="text-sm text-gray-500 mb-6">
        {hasVision
          ? '對著冰箱裡的食材拍一張,AI 會幫你列出可入菜的清單。'
          : '上傳一張食材照當記憶輔助,接著手動選食材並輸入克數。'}
      </p>

      {!previewUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-3xl bg-white">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-orange-500 shadow-inner">
            <Camera size={32} />
          </div>
          <p className="text-sm text-gray-500">把食材拍進畫面裡</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.setAttribute('capture', 'environment');
                  fileRef.current.click();
                }
              }}
              className="bg-gray-900 text-white font-bold rounded-xl px-4 py-2.5 flex items-center gap-2 active:scale-95 transition shadow-md"
            >
              <Camera size={16} /> 開相機
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.removeAttribute('capture');
                  fileRef.current.click();
                }
              }}
              className="bg-white border border-gray-200 text-gray-700 font-bold rounded-xl px-4 py-2.5 flex items-center gap-2 active:scale-95 transition"
            >
              <Upload size={16} /> 從相簿
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handlePick}
            className="hidden"
            aria-label="選擇食材照片"
          />
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 text-sm text-gray-400 underline hover:text-gray-700"
          >
            略過拍照,直接手動選
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          <div className="relative rounded-3xl overflow-hidden bg-black aspect-square">
            <img
              src={previewUrl}
              alt="食材預覽"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={reset}
              aria-label="重拍"
              className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full backdrop-blur"
            >
              <X size={16} />
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                AI 分析失敗。可以重拍,或略過讓你手動建立清單。
                <span className="block opacity-70 mt-1 font-mono">
                  {error.message ?? '未知錯誤'}
                </span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-auto">
            <button
              type="button"
              onClick={onSkip}
              className="bg-white border border-gray-200 text-gray-700 font-bold rounded-xl py-3 active:scale-95 transition"
            >
              手動建立
            </button>
            {hasVision ? (
              <button
                type="button"
                onClick={() => onAnalyze(previewUrl)}
                disabled={isAnalyzing}
                className={`rounded-xl py-3 font-bold flex justify-center items-center gap-2 text-white shadow-lg active:scale-95 transition ${
                  isAnalyzing
                    ? 'bg-gray-400'
                    : 'bg-gradient-to-r from-orange-500 to-red-500'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> AI 辨識
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onSkip}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl py-3 active:scale-95 transition shadow-lg"
              >
                下一步
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 把 user 選的圖片 down-scale 到 MAX_DIMENSION 並輸出 JPEG dataURL。
 */
async function compressImage(file) {
  const img = await loadImage(file);
  const { width, height } = scaleToFit(img.width, img.height, MAX_DIMENSION);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function scaleToFit(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
