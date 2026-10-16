import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 兩段式確認:第一次 request() 進入確認狀態,timeout 後自動取消。
 * @returns {{ confirming: boolean, request: () => void, reset: () => void }}
 */
export default function useTwoStepConfirm(timeout = 4000) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setConfirming(false);
  }, []);

  const request = useCallback(() => {
    clearTimeout(timer.current);
    setConfirming(true);
    timer.current = setTimeout(() => setConfirming(false), timeout);
  }, [timeout]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { confirming, request, reset };
}
