import React, { useMemo, useState } from 'react';
import { Apple, Plus, Search } from 'lucide-react';
import { deleteFood } from '../api/client';
import FoodCard from '../components/foods/FoodCard';
import FoodFormSheet from '../components/foods/FoodFormSheet';
import useDebouncedValue from '../components/foods/useDebouncedValue';
import {
  Button,
  EmptyState,
  ErrorState,
  FOCUS_RING,
  PageHeader,
  cx,
} from '../components/ui';
import { useNav } from '../context/NavContext';
import useFoods from '../hooks/useFoods';
import useMealDraft from '../hooks/useMealDraft';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'custom', label: '我的食材' },
  { key: 'protein', label: '蛋白質', type: 'protein' },
  { key: 'veg', label: '蔬菜', type: 'veg' },
  { key: 'fruit', label: '水果', type: 'fruit' },
  { key: 'starch', label: '澱粉', type: 'starch' },
];

/** 食材資料庫:搜尋、篩選、自訂食材的新增/編輯/刪除 */
export default function FoodsPage() {
  const { setTab } = useNav();
  const { addFood } = useMealDraft();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null); // { mode, initial }
  const q = useDebouncedValue(query.trim(), 250);

  const { data, loading, error, refetch } = useFoods({
    q: q || undefined,
    source: filter === 'custom' ? 'custom' : undefined,
  });

  const typeFilter = FILTERS.find((f) => f.key === filter)?.type;
  const foods = useMemo(
    () =>
      (data ?? []).filter((food) => !typeFilter || food.type === typeFilter),
    [data, typeFilter],
  );

  const openCreate = () => setForm({ mode: 'manual', initial: {} });

  const handleAdd = (food) => {
    addFood(food);
    setTab('log');
  };

  const handleDelete = async (food) => {
    await deleteFood(food.id);
    refetch();
  };

  const handleSaved = () => {
    setForm(null);
    refetch();
  };

  let content;
  if (error && !data) {
    content = <ErrorState message={error.message} onRetry={refetch} />;
  } else if (!data && loading) {
    content = (
      <p role="status" className="py-10 text-center text-sm text-stone-600">
        載入中…
      </p>
    );
  } else if (foods.length === 0) {
    content =
      filter === 'custom' && !q ? (
        <EmptyState
          icon={Apple}
          title="還沒有自訂食材"
          action={
            <Button icon={Plus} onClick={openCreate}>
              新增
            </Button>
          }
        />
      ) : (
        <EmptyState icon={Search} title="找不到符合的食材" />
      );
  } else {
    content = (
      <ul className="space-y-3" aria-busy={loading || undefined}>
        {foods.map((food) => (
          <li key={food.id}>
            <FoodCard
              food={food}
              onAdd={handleAdd}
              onEdit={(f) => setForm({ mode: 'edit', initial: f })}
              onDelete={handleDelete}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title="食材"
        action={
          <Button variant="secondary" icon={Plus} onClick={openCreate}>
            新增
          </Button>
        }
      />

      <div className="relative mb-3">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-600"
          aria-hidden="true"
        />
        <input
          type="search"
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

      <div
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label="篩選"
      >
        {FILTERS.map((f) => {
          const selected = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(f.key)}
              className={cx(
                'h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors',
                selected
                  ? 'bg-orange-700 text-white'
                  : 'bg-white border border-stone-300 text-stone-800 hover:bg-stone-50',
                FOCUS_RING,
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {content}

      {form && (
        <FoodFormSheet
          mode={form.mode}
          initial={form.initial}
          context="foods"
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
