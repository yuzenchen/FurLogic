import React, { useEffect, useRef, useState } from 'react';
import { Globe, Search } from 'lucide-react';
import { FOOD_TYPES } from '@furlogic/shared';
import { ApiError, lookupFood } from '../../api/client';
import useFoods from '../../hooks/useFoods';
import FoodFormSheet from '../foods/FoodFormSheet';
import SafetyBadge from '../foods/SafetyBadge';
import useDebouncedValue from '../foods/useDebouncedValue';
import { BottomSheet, Button, ErrorState, FOCUS_RING, cx } from '../ui';

/**
 * 「加入食材」抽屜:搜尋資料庫 → 點選加入;找不到時可線上查詢或手動新增。
 * 新增食材的表單會暫時取代這個抽屜,取消後回到搜尋。父元件需要時才掛載。
 * @param {Set<number>} addedIds 已在批次草稿中的食材 id
 * @param {(food: object) => void} onAdd 加入批次草稿
 */
export default function FoodSearchSheet({ onClose, addedIds, onAdd }) {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null); // { mode, initial, confidence, notice }
  const [looking, setLooking] = useState(false);
  const [message, setMessage] = useState(null);
  const q = useDebouncedValue(query.trim(), 250);
  const inputRef = useRef(null);

  // BottomSheet 開啟時會 focus 第一個元素(關閉鈕);下一個 frame 改 focus 搜尋框
  useEffect(() => {
    if (form) return undefined;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [form]);
  const { data, loading, error, refetch } = useFoods({ q: q || undefined });

  const pick = (food) => {
    onAdd(food);
    onClose();
  };

  const openManual = (notice) =>
    setForm({ mode: 'manual', initial: { name: q.slice(0, 40) }, notice });

  const runLookup = async () => {
    setLooking(true);
    setMessage(null);
    try {
      const { draft, confidence } = await lookupFood(q);
      setForm({ mode: 'lookup', initial: draft, confidence });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'lookup_unavailable') {
        openManual('線上查詢未設定,請手動輸入每 100g 營養值');
      } else {
        openManual(`查詢失敗:${err?.message || '未知錯誤'},請手動輸入`);
      }
    } finally {
      setLooking(false);
    }
  };

  const handleSaved = (food) => {
    if (food.safety === 'toxic') {
      setForm(null);
      setMessage(`已將「${food.name}」存入食材庫(對狗有毒,未加入批次)`);
      refetch();
      return;
    }
    setForm(null);
    pick(food);
  };

  const foods = data ?? [];
  const showNoResults = q !== '' && !loading && !error && foods.length === 0;

  let list;
  if (error && !data) {
    list = <ErrorState message={error.message} onRetry={refetch} />;
  } else if (!data && loading) {
    list = (
      <p role="status" className="py-8 text-center text-sm text-stone-600">
        載入中…
      </p>
    );
  } else if (showNoResults) {
    list = (
      <div className="py-6 text-center">
        <p className="text-sm text-stone-800">資料庫找不到「{q}」</p>
        <Button
          icon={Globe}
          className="mt-3"
          loading={looking}
          onClick={runLookup}
        >
          線上查詢「{q}」
        </Button>
      </div>
    );
  } else {
    list = (
      <ul
        className="divide-y divide-stone-100"
        aria-busy={loading || undefined}
      >
        {foods.map((food) => (
          <FoodRow
            key={food.id}
            food={food}
            added={addedIds?.has(food.id)}
            onPick={pick}
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      <BottomSheet open={!form} onClose={onClose} title="加入食材">
        <div className="sticky top-0 z-10 -mx-5 bg-white px-5 pb-2">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-600"
              aria-hidden="true"
            />
            <input
              type="search"
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋食材名稱"
              aria-label="搜尋食材"
              maxLength={50}
              className={cx(
                'h-11 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3 text-stone-900',
                FOCUS_RING,
              )}
            />
          </div>
        </div>

        {message && (
          <p role="status" className="mb-2 text-sm text-stone-800">
            {message}
          </p>
        )}

        {list}

        <div className="mt-2 border-t border-stone-100 pt-2 text-center">
          <button
            type="button"
            onClick={() => openManual(undefined)}
            className={cx(
              'h-11 rounded-xl px-3 text-sm font-semibold text-orange-700 underline underline-offset-2 hover:bg-orange-50',
              FOCUS_RING,
            )}
          >
            手動新增食材
          </button>
        </div>
      </BottomSheet>

      {form && (
        <FoodFormSheet
          mode={form.mode}
          initial={form.initial}
          confidence={form.confidence}
          notice={form.notice}
          context="batch"
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

function FoodRow({ food, added, onPick }) {
  const isToxic = food.safety === 'toxic';
  const disabled = isToxic || added;
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(food)}
        className={cx(
          'flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
          FOCUS_RING,
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            className={cx(
              'font-semibold break-words',
              disabled ? 'text-stone-600' : 'text-stone-900',
            )}
          >
            {food.name}
          </p>
          <p className="text-xs text-stone-600 tabular-nums">
            {FOOD_TYPES[food.type] ?? food.type} · {food.calories} kcal/100g
          </p>
          {isToxic && (
            <p className="text-xs font-semibold text-rose-700">
              對狗有毒,不可加入
            </p>
          )}
          {!isToxic && added && (
            <p className="text-xs font-semibold text-stone-600">已加入</p>
          )}
        </div>
        <SafetyBadge safety={food.safety} />
      </button>
    </li>
  );
}
