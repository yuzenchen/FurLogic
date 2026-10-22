import React, { useEffect, useRef, useState } from 'react';
import { Check, Search, Sparkles } from 'lucide-react';
import { FOOD_TYPES } from '@furlogic/shared';
import useFoods from '../../hooks/useFoods';
import AddFoodSheet from '../foods/AddFoodSheet';
import SafetyBadge from '../foods/SafetyBadge';
import useDebouncedValue from '../foods/useDebouncedValue';
import { BottomSheet, Button, ErrorState, FOCUS_RING, cx } from '../ui';

/**
 * 「加入食材」抽屜:搜尋資料庫 → 勾選多項 → 底部「加入 N 項」一次加入;
 * 找不到時可用 AI 新增食材(儲存後連同已勾選項一起加入並關閉)。
 * 新增食材抽屜(AddFoodSheet)會暫時取代這個抽屜,取消後回到搜尋。父元件需要時才掛載。
 * @param {Set<number>} addedIds 已在計算頁草稿中的食材 id
 * @param {(food: object) => void} onAdd 加入計算頁草稿
 */
export default function FoodSearchSheet({ onClose, addedIds, onAdd }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(null); // { initialName } | null
  const [message, setMessage] = useState(null);
  // 已勾選的食材(Map 保留勾選順序);換搜尋字不清掉
  const [selected, setSelected] = useState(() => new Map());
  const q = useDebouncedValue(query.trim(), 250);
  const inputRef = useRef(null);

  // BottomSheet 開啟時會 focus 第一個元素(關閉鈕);下一個 frame 改 focus 搜尋框
  useEffect(() => {
    if (adding) return undefined;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [adding]);
  const { data, loading, error, refetch } = useFoods({ q: q || undefined });

  const toggle = (food) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(food.id)) next.delete(food.id);
      else next.set(food.id, food);
      return next;
    });
  };

  const clearSelected = () => setSelected(new Map());

  // 依勾選順序逐一加入(reducer 會依類別重新分配比例);extra 為表單剛存好的食材
  const commit = (extra) => {
    for (const food of selected.values()) onAdd(food);
    if (extra && !selected.has(extra.id)) onAdd(extra);
    onClose();
  };

  const openAdd = (initialName = '') => {
    setMessage(null);
    setAdding({ initialName });
  };

  const handleSaved = (food) => {
    if (food.safety === 'toxic') {
      setAdding(null);
      setMessage(`已將「${food.name}」存入食材庫(對狗有毒,未加入計算)`);
      refetch();
      return;
    }
    setAdding(null);
    commit(food);
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
        <Button icon={Sparkles} className="mt-3" onClick={() => openAdd(q)}>
          用 AI 新增「{q}」
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
            checked={selected.has(food.id)}
            onToggle={toggle}
          />
        ))}
      </ul>
    );
  }

  const selectedNames = Array.from(selected.values(), (f) => f.name);
  const selectedSummary =
    selectedNames.slice(0, 3).join('、') +
    (selectedNames.length > 3 ? '…' : '');

  return (
    <>
      <BottomSheet
        open={!adding}
        onClose={onClose}
        title="加入食材"
        footer={
          <Button
            block
            size="lg"
            disabled={selected.size === 0}
            onClick={() => commit()}
          >
            {selected.size === 0 ? '加入食材' : `加入 ${selected.size} 項`}
          </Button>
        }
      >
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
          {selected.size > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 break-words text-xs text-stone-600">
                已選 {selected.size} 項:{selectedSummary}
              </p>
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={clearSelected}
              >
                清除
              </Button>
            </div>
          )}
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
            onClick={() => openAdd()}
            className={cx(
              'h-11 rounded-xl px-3 text-sm font-semibold text-orange-700 underline underline-offset-2 hover:bg-orange-50',
              FOCUS_RING,
            )}
          >
            新增食材
          </button>
        </div>
      </BottomSheet>

      {adding && (
        <AddFoodSheet
          initialName={adding.initialName}
          context="batch"
          onClose={() => setAdding(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

function FoodRow({ food, added, checked, onToggle }) {
  const isToxic = food.safety === 'toxic';
  const disabled = isToxic || added;
  const isChecked = !disabled && checked;
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        aria-label={food.name}
        disabled={disabled}
        onClick={() => onToggle(food)}
        className={cx(
          'flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left disabled:cursor-not-allowed disabled:hover:bg-transparent',
          isChecked ? 'bg-orange-50' : 'hover:bg-stone-50',
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
        {!disabled && (
          <span
            aria-hidden="true"
            className={cx(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
              isChecked
                ? 'border-orange-700 bg-orange-700 text-white'
                : 'border-stone-300',
            )}
          >
            {isChecked && <Check size={14} strokeWidth={3} />}
          </span>
        )}
        <SafetyBadge safety={food.safety} />
      </button>
    </li>
  );
}
