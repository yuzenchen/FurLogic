import { useState, useCallback } from 'react';

/**
 * 包住對 vision proxy /analyze 的呼叫(目前部署在 Deno Deploy,見 deno/)。
 * URL 從 build-time 的 VITE_VISION_WORKER_URL 取得 — 沒設代表沒部署服務,
 * isAvailable === false,UI 應該降級到「全手動」模式。
 */
const WORKER_URL = import.meta.env.VITE_VISION_WORKER_URL || '';

export default function useVisionWorker() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (dataUrl, catalog) => {
    if (!WORKER_URL) {
      throw new Error('vision_worker_not_configured');
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${WORKER_URL.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, catalog }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`worker_${res.status}: ${detail.slice(0, 80)}`);
      }
      const json = await res.json();
      return Array.isArray(json?.items) ? json.items : [];
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analyze,
    isAnalyzing,
    error,
    isAvailable: Boolean(WORKER_URL),
  };
}
