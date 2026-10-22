import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Sparkles, X } from 'lucide-react';
import { getAiStatus, reviewCalc } from '../api/client';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { useNav } from '../context/NavContext';
import useAsync from '../hooks/useAsync';
import { toReviewBody } from '../utils/review';
import { getLastCalc, getLastReview, saveLastReview } from '../utils/storage';

/** 同一次計算(computedAt)只自動觸發一次;模組層級,切分頁重新掛載也記得 */
const autoStarted = new Set();

const VERDICT = {
  pass: {
    icon: Check,
    text: '計算正確',
    className: 'text-emerald-700 bg-emerald-50',
  },
  warn: {
    icon: AlertCircle,
    text: '計算正確，有營養建議',
    className: 'text-amber-700 bg-amber-50',
  },
  fail: { icon: X, text: '計算有誤', className: 'text-rose-700 bg-rose-50' },
};

/** 美元:< 1 顯示 4 位小數,其餘 2 位 */
const fmtUsd = (n) => {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(v < 1 ? 4 : 2)}`;
};

const fmtTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-TW');
};

const KEY_HINT = '尚未設定 AI 金鑰（ANTHROPIC_API_KEY）';

/** AI 復盤:把最近一次計算送給 AI 重新驗算並檢查營養是否合理 */
export default function ReviewPage() {
  const { setTab, pendingReview, clearPendingReview } = useNav();
  const [lastCalc] = useState(getLastCalc);
  const computedAt = lastCalc?.computedAt ?? null;
  const [response, setResponse] = useState(() =>
    computedAt ? getLastReview(computedAt) : null,
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const status = useAsync((signal) => getAiStatus({ signal }), []);
  const aiStatus = status.data;
  const refetchStatus = status.refetch;
  const notConfigured = aiStatus?.configured === false;

  const run = useCallback(async () => {
    if (!lastCalc) return;
    setRunning(true);
    setError(null);
    try {
      const res = await reviewCalc(toReviewBody(lastCalc));
      const saved = {
        computedAt: lastCalc.computedAt,
        review: res.review,
        model: res.model,
        costUsd: res.costUsd,
      };
      // 離開分頁後才回來的結果仍存起來,回到分頁時看得到
      saveLastReview(saved);
      if (mounted.current) {
        setResponse(saved);
        refetchStatus(); // 更新今日用量
      }
    } catch (err) {
      if (mounted.current) setError(err);
    } finally {
      if (mounted.current) setRunning(false);
    }
  }, [lastCalc, refetchStatus]);

  // 從計算頁按「AI 復盤」進來:確認已設定金鑰後自動開始一次
  useEffect(() => {
    if (!pendingReview) return;
    if (!lastCalc) {
      clearPendingReview();
      return;
    }
    if (status.loading && !aiStatus) return; // 等狀態回來
    clearPendingReview();
    if (aiStatus?.configured === false) return;
    if (autoStarted.has(lastCalc.computedAt)) return;
    autoStarted.add(lastCalc.computedAt);
    run();
  }, [
    pendingReview,
    lastCalc,
    status.loading,
    aiStatus,
    clearPendingReview,
    run,
  ]);

  const header = (
    <PageHeader
      title="AI 復盤"
      subtitle="請 AI 重新驗算計算結果並檢查營養是否合理"
    />
  );

  if (!lastCalc) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Sparkles}
            title="還沒有計算結果"
            action={<Button onClick={() => setTab('batch')}>去計算</Button>}
          />
        </Card>
      </>
    );
  }

  const showKeyHint = notConfigured || error?.code === 'ai_unavailable';

  return (
    <>
      {header}
      <LastCalcCard calc={lastCalc} />

      <div className="mb-4 space-y-2">
        <Button
          icon={Sparkles}
          size="lg"
          block
          loading={running}
          disabled={notConfigured}
          onClick={run}
        >
          {running ? 'AI 驗算中…' : '請 AI 復盤'}
        </Button>
        {showKeyHint && <p className="text-sm text-amber-700">{KEY_HINT}</p>}
        {aiStatus && (
          <p className="text-xs text-stone-600 tabular-nums">
            今日用量 {fmtUsd(aiStatus.dailyUsd)} /{' '}
            {fmtUsd(aiStatus.dailyLimitUsd)}
          </p>
        )}
      </div>

      {error && error.code !== 'ai_unavailable' && (
        <ReviewError error={error} onRetry={run} />
      )}

      {response && <ReviewResultCard response={response} />}
    </>
  );
}

/** 最近一次計算摘要 */
function LastCalcCard({ calc }) {
  const { appResult, items } = calc;
  return (
    <Card
      as="section"
      aria-labelledby="last-calc-title"
      className="mb-4 space-y-2"
    >
      <div>
        <h2 id="last-calc-title" className="font-semibold text-stone-900">
          最近一次計算
        </h2>
        <p className="text-xs text-stone-600 tabular-nums">
          {fmtTime(calc.computedAt)}
        </p>
      </div>
      <p className="text-sm text-stone-800 tabular-nums">
        每餐 {appResult.totalGramsPerMeal} g · {appResult.perMealKcal} kcal /
        目標 {Math.round(calc.mealTarget)} kcal · {calc.mealsCount} 餐
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={`${item.name}-${i}`}
            className="break-words text-sm text-stone-700 tabular-nums"
          >
            {item.name} {item.pct}% → {item.gramsPerMeal} g
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 錯誤訊息:額度用完 / 其他(可重試);ai_unavailable 由金鑰提示處理 */
function ReviewError({ error, onRetry }) {
  if (error.code === 'ai_quota_exceeded') {
    return (
      <p role="alert" className="mb-4 text-sm text-rose-700">
        AI 額度已用完（{error.message}）
      </p>
    );
  }
  return (
    <div role="alert" className="mb-4 flex items-center justify-between gap-3">
      <p className="text-sm text-rose-700">AI 復盤失敗：{error.message}</p>
      <Button variant="ghost" className="shrink-0" onClick={onRetry}>
        重試
      </Button>
    </div>
  );
}

/** AI 復盤結果卡 */
function ReviewResultCard({ response }) {
  const { review, model, costUsd } = response;
  const verdict = VERDICT[review.verdict] ?? VERDICT.warn;
  const VerdictIcon = verdict.icon;
  const suggestions = (review.suggestions ?? []).filter(
    (s) => typeof s === 'string' && s.trim(),
  );

  return (
    <Card
      as="section"
      aria-labelledby="review-result-title"
      className="mb-4 space-y-4"
    >
      <h2 id="review-result-title" className="sr-only">
        AI 復盤結果
      </h2>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold ${verdict.className}`}
      >
        <VerdictIcon size={18} strokeWidth={2.5} aria-hidden="true" />
        {verdict.text}
      </span>
      {review.summary && (
        <p className="text-sm text-stone-800">{review.summary}</p>
      )}

      {review.checks.length > 0 && (
        <section aria-labelledby="review-checks-title">
          <h3
            id="review-checks-title"
            className="mb-2 text-sm font-semibold text-stone-900"
          >
            逐項檢查
          </h3>
          <ul className="space-y-2">
            {review.checks.map((c, i) => {
              const OkIcon = c.ok ? Check : X;
              return (
                <li key={`${c.label}-${i}`} className="flex gap-2">
                  <OkIcon
                    size={18}
                    className={checkIconClass(c.ok)}
                    role="img"
                    aria-label={c.ok ? '正確' : '有誤'}
                  />
                  <div className="min-w-0 text-sm text-stone-800">
                    <p className="break-words font-semibold">{c.label}</p>
                    <p className="text-xs text-stone-700 tabular-nums">
                      預期 {String(c.expected ?? '-')} · App{' '}
                      {String(c.actual ?? '-')}
                    </p>
                    {c.note && (
                      <p className="text-xs text-stone-600">{c.note}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && (
        <section aria-labelledby="review-suggestions-title">
          <h3
            id="review-suggestions-title"
            className="mb-2 text-sm font-semibold text-stone-900"
          >
            建議
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-stone-800">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-stone-600 tabular-nums">
        模型 {model || '-'} · 本次 $
        {(Number.isFinite(costUsd) ? costUsd : 0).toFixed(4)}
      </p>
    </Card>
  );
}

/** 逐項檢查圖示顏色 */
const checkIconClass = (ok) =>
  ok ? 'mt-0.5 shrink-0 text-emerald-700' : 'mt-0.5 shrink-0 text-rose-700';
