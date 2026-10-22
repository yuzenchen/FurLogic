import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { FOOD_TYPES } from '@furlogic/shared';
import { ApiError, createFood, lookupFood } from '../../api/client';
import { buildDraftPayload, describeLookupError } from '../../utils/foodDraft';
import { BottomSheet, Button, FOCUS_RING, Stat, cx } from '../ui';
import FoodFormSheet from './FoodFormSheet';
import SafetyBadge from './SafetyBadge';

const NUTRIENTS = [
  { key: 'calories', label: '熱量', unit: 'kcal' },
  { key: 'protein', label: '蛋白質', unit: 'g' },
  { key: 'fat', label: '脂肪', unit: 'g' },
  { key: 'ca', label: '鈣', unit: 'mg' },
  { key: 'p', label: '磷', unit: 'mg' },
];

const SUBTYPE_LABELS = { organ: '內臟', fatty_fish: '高脂魚' };

const CONFIDENCE = {
  high: { label: 'AI 信心高', className: 'text-emerald-700 bg-emerald-50' },
  medium: { label: 'AI 信心中', className: 'text-amber-700 bg-amber-50' },
  low: { label: 'AI 信心低', className: 'text-rose-700 bg-rose-50' },
};

const fmt = (v) => (Number.isFinite(v) ? v : '—');

/**
 * 新增食材抽屜:輸入名稱 → AI 回填營養 → 預覽 → 儲存。
 * 「修改 / 手動輸入」會暫時換成 FoodFormSheet,取消後回到這裡。父元件需要時才掛載。
 * @param {string} [initialName] 名稱預設值(例如搜尋字)
 * @param {'batch'|'foods'} context batch:儲存後由父元件加入計算(有毒則只存入食材庫)
 * @param {(food: object) => void} onSaved 食材建立成功時呼叫
 */
export default function AddFoodSheet({
  onClose,
  initialName = '',
  context = 'foods',
  onSaved,
}) {
  const formId = useId();
  const errorId = useId();
  const [step, setStep] = useState('input'); // 'input' | 'preview'
  const [name, setName] = useState(() => initialName.slice(0, 50));
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState(null); // { kind, text }
  const [result, setResult] = useState(null); // { draft, confidence, note }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState(null); // { mode, initial, confidence }
  const inputRef = useRef(null);
  const headingRef = useRef(null);
  const requestRef = useRef(0);

  // BottomSheet 開啟時會 focus 關閉鈕;換步驟或從表單回來時改 focus 主要內容
  useEffect(() => {
    if (form) return undefined;
    const id = requestAnimationFrame(() => {
      if (step === 'input') inputRef.current?.focus();
      else headingRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [form, step]);

  const trimmed = name.trim();

  const runLookup = async (e) => {
    e?.preventDefault();
    if (!trimmed || looking) return;
    const reqId = ++requestRef.current;
    setLooking(true);
    setLookupError(null);
    try {
      const { draft, confidence, note } = await lookupFood(trimmed);
      if (reqId !== requestRef.current) return;
      setResult({ draft, confidence, note });
      setSaveError(null);
      setStep('preview');
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setLookupError(describeLookupError(err));
    } finally {
      if (reqId === requestRef.current) setLooking(false);
    }
  };

  const openManual = () =>
    setForm({ mode: 'manual', initial: { name: trimmed.slice(0, 40) } });

  const openEdit = () =>
    setForm({
      mode: 'lookup',
      initial: result.draft,
      confidence: result.confidence,
    });

  const backToInput = () => {
    setStep('input');
    setSaveError(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await createFood(buildDraftPayload(result.draft));
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_name') {
        setSaveError(`已有同名食材「${result.draft?.name ?? ''}」`);
      } else {
        setSaveError(err?.message || '儲存失敗');
      }
    } finally {
      setSaving(false);
    }
  };

  if (form) {
    return (
      <FoodFormSheet
        mode={form.mode}
        initial={form.initial}
        confidence={form.confidence}
        context={context}
        onClose={() => setForm(null)}
        onSaved={onSaved}
      />
    );
  }

  const draft = result?.draft;
  const isToxic = draft?.safety === 'toxic';
  let saveLabel = '儲存';
  if (context === 'batch') saveLabel = isToxic ? '只存入食材庫' : '儲存並加入';

  const footer =
    step === 'input' ? (
      <Button
        type="submit"
        form={formId}
        block
        size="lg"
        icon={Sparkles}
        loading={looking}
        disabled={!trimmed}
      >
        {looking ? 'AI 查詢中…' : 'AI 查詢'}
      </Button>
    ) : (
      <div className="space-y-2">
        <Button block size="lg" loading={saving} onClick={save}>
          {saveLabel}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={saving}
            onClick={openEdit}
          >
            修改
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            disabled={saving}
            onClick={backToInput}
          >
            重新查詢
          </Button>
        </div>
      </div>
    );

  return (
    <BottomSheet open onClose={onClose} title="新增食材" footer={footer}>
      {step === 'input' ? (
        <form id={formId} onSubmit={runLookup} noValidate className="space-y-3">
          <p className="text-sm text-stone-600">
            輸入食材名稱，AI 會依資料庫格式填好營養值
          </p>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="食材名稱"
            maxLength={50}
            autoComplete="off"
            aria-invalid={lookupError ? true : undefined}
            aria-describedby={lookupError ? errorId : undefined}
            className={cx(
              'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-stone-900',
              FOCUS_RING,
            )}
          />
          {lookupError && (
            <LookupErrorBlock
              id={errorId}
              error={lookupError}
              onManual={openManual}
              onRetry={runLookup}
            />
          )}
        </form>
      ) : (
        <Preview
          headingRef={headingRef}
          draft={draft}
          confidence={result.confidence}
          note={result.note}
          saveError={saveError}
        />
      )}
    </BottomSheet>
  );
}

function LookupErrorBlock({ id, error, onManual, onRetry }) {
  return (
    <div id={id} role="alert" className="space-y-1">
      <p className="text-sm text-rose-700 break-words">{error.text}</p>
      {error.kind === 'unrecognized' && (
        <div className="flex flex-wrap items-center gap-x-2">
          <p className="text-xs text-stone-600">
            請換個更明確的名稱，例如「雞胸肉」「冬瓜」
          </p>
          <button
            type="button"
            onClick={onManual}
            className={cx(
              'min-h-11 rounded-xl px-2 text-xs font-semibold text-orange-700 underline underline-offset-2 hover:bg-orange-50',
              FOCUS_RING,
            )}
          >
            改為手動輸入
          </button>
        </div>
      )}
      {error.kind === 'unavailable' && (
        <Button variant="secondary" onClick={onManual}>
          手動輸入
        </Button>
      )}
      {error.kind === 'failed' && (
        <Button variant="ghost" onClick={() => onRetry()}>
          重試
        </Button>
      )}
    </div>
  );
}

function Preview({ headingRef, draft, confidence, note, saveError }) {
  const conf = CONFIDENCE[confidence];
  const subtypeLabel = SUBTYPE_LABELS[draft?.subtype];
  return (
    <div className="space-y-4">
      <div>
        <p
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold text-stone-900 break-words focus:outline-none"
        >
          {draft?.name}
        </p>
        {draft?.nameEn && (
          <p lang="en" className="text-xs text-stone-600 break-words">
            {draft.nameEn}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill className="text-stone-700 bg-stone-100">
            {FOOD_TYPES[draft?.type] ?? draft?.type}
          </Pill>
          <SafetyBadge safety={draft?.safety} />
          {subtypeLabel && (
            <Pill className="text-stone-700 bg-stone-100">{subtypeLabel}</Pill>
          )}
          {conf && <Pill className={conf.className}>{conf.label}</Pill>}
        </div>
      </div>

      {draft?.warning && (
        <p className="text-sm text-amber-700 break-words">{draft.warning}</p>
      )}
      {draft?.description && (
        <p className="text-sm text-stone-700 break-words">
          {draft.description}
        </p>
      )}

      <section aria-label="每 100 g 營養">
        <h3 className="mb-2 text-sm font-medium text-stone-800">
          每 100 g 營養
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {NUTRIENTS.map(({ key, label, unit }) => (
            <Stat
              key={key}
              label={label}
              value={fmt(draft?.[key])}
              unit={unit}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-600">
          營養以生重計（名稱帶「(熟)」為熟重）
        </p>
      </section>

      {confidence === 'low' && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          AI 對這筆數值把握較低，建議手動確認
        </p>
      )}

      {(note || draft?.sourceRef) && (
        <div className="space-y-1 text-xs text-stone-600 break-words">
          {note && <p>{note}</p>}
          {draft?.sourceRef && <p>來源：{draft.sourceRef}</p>}
        </div>
      )}

      {saveError && (
        <p role="alert" className="text-sm text-rose-700 break-words">
          {saveError}
        </p>
      )}
    </div>
  );
}

function Pill({ className, children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}
