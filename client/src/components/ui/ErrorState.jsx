import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import Button from './Button';

/** API 錯誤狀態:標題 + 訊息 + 重試 */
export default function ErrorState({
  title = '連不上伺服器',
  message,
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center text-center py-10 px-6"
    >
      <WifiOff size={40} className="text-stone-400 mb-3" aria-hidden="true" />
      <p className="font-semibold text-stone-800">{title}</p>
      {message && <p className="text-sm text-stone-600 mt-1">{message}</p>}
      {onRetry && (
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={onRetry}
          className="mt-4"
        >
          重試
        </Button>
      )}
    </div>
  );
}
