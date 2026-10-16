import React, { useMemo, useState } from 'react';
import { Cat, Footprints, Save, Scale, User, Zap } from 'lucide-react';
import { DEFAULT_MEALS_PER_DAY } from '@furlogic/shared';
import { Button, Card, FOCUS_RING, Stat, cx } from '../components/ui';
import { computePetMetrics, usePet } from '../context/PetContext';
import { useNav } from '../context/NavContext';

const ACTIVITY_OPTIONS = [
  { value: 'low', label: '慵懶', sub: '少動 / 老犬', icon: Cat },
  { value: 'normal', label: '一般', sub: '日常散步', icon: Footprints },
  { value: 'high', label: '好動', sub: '運動 / 工作犬', icon: Zap },
];

const MEALS_OPTIONS = [1, 2, 3, 4];
const FIELDS = ['name', 'weight', 'isNeutered', 'activityLevel', 'mealsPerDay'];

const INPUT_CLASS = cx(
  'w-full h-11 px-3 bg-white border border-stone-300 rounded-xl text-stone-900',
  FOCUS_RING,
);

const segmentClass = (active) =>
  cx(
    'min-h-11 rounded-xl border text-sm font-semibold transition-colors',
    active
      ? 'bg-orange-50 border-orange-500 text-orange-700'
      : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50',
    FOCUS_RING,
  );

const initialForm = (pet) => ({
  name: pet?.name ?? '',
  weight: pet?.weight != null ? String(pet.weight) : '',
  isNeutered: Boolean(pet?.isNeutered),
  activityLevel: pet?.activityLevel ?? 'normal',
  mealsPerDay: pet?.mealsPerDay ?? DEFAULT_MEALS_PER_DAY,
});

/** 毛孩檔案設定(全頁,頂部列提供返回) */
export default function SettingsPage() {
  const { pet, savePet } = usePet();
  const { closeSettings } = useNav();
  const [form, setForm] = useState(() => initialForm(pet));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const weightNum = Number(form.weight);
  const weightValid =
    form.weight.trim() !== '' && Number.isFinite(weightNum) && weightNum > 0;
  const nameValid = form.name.trim() !== '';

  const preview = useMemo(
    () =>
      weightValid
        ? computePetMetrics({
            weight: weightNum,
            isNeutered: form.isNeutered,
            activityLevel: form.activityLevel,
            mealsPerDay: form.mealsPerDay,
          })
        : null,
    [
      weightValid,
      weightNum,
      form.isNeutered,
      form.activityLevel,
      form.mealsPerDay,
    ],
  );

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nameValid) {
      setError('請輸入毛孩名字');
      return;
    }
    if (!weightValid) {
      setError('體重需大於 0');
      return;
    }
    const next = {
      name: form.name.trim(),
      weight: weightNum,
      isNeutered: form.isNeutered,
      activityLevel: form.activityLevel,
      mealsPerDay: form.mealsPerDay,
    };
    const patch = {};
    for (const key of FIELDS) {
      if (next[key] !== pet?.[key]) patch[key] = next[key];
    }
    if (Object.keys(patch).length === 0) {
      closeSettings();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await savePet(patch);
      closeSettings();
    } catch (err) {
      setError(err?.message || '儲存失敗,請稍後再試');
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 animate-in fade-in"
    >
      <div>
        <label
          htmlFor="pet-name"
          className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-800"
        >
          <User size={16} className="text-stone-600" aria-hidden="true" />
          名字
        </label>
        <input
          id="pet-name"
          type="text"
          maxLength={30}
          autoComplete="off"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-invalid={!nameValid}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label
          htmlFor="pet-weight"
          className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-800"
        >
          <Scale size={16} className="text-stone-600" aria-hidden="true" />
          體重 (kg)
        </label>
        <input
          id="pet-weight"
          type="number"
          inputMode="decimal"
          min="0.1"
          step="0.1"
          value={form.weight}
          onChange={(e) => update({ weight: e.target.value })}
          aria-invalid={!weightValid}
          className={cx(INPUT_CLASS, 'tabular-nums')}
        />
      </div>

      <label className="min-h-11 flex items-center justify-between gap-3 rounded-xl border border-stone-300 bg-white px-3 py-2 cursor-pointer">
        <span className="text-sm font-medium text-stone-800">已結紮</span>
        <input
          type="checkbox"
          checked={form.isNeutered}
          onChange={(e) => update({ isNeutered: e.target.checked })}
          className={cx('w-5 h-5 accent-orange-700 rounded', FOCUS_RING)}
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-stone-800">
          活動量
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITY_OPTIONS.map(({ value, label, sub, icon: Icon }) => {
            const active = form.activityLevel === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ activityLevel: value })}
                className={cx(
                  segmentClass(active),
                  'py-2.5 flex flex-col items-center gap-1',
                )}
              >
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
                <span className="text-[11px] font-normal text-stone-600 leading-tight">
                  {sub}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-stone-800">
          每日餐數
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {MEALS_OPTIONS.map((n) => {
            const active = form.mealsPerDay === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                onClick={() => update({ mealsPerDay: n })}
                className={cx(segmentClass(active), 'tabular-nums')}
              >
                {n} 餐
              </button>
            );
          })}
        </div>
      </fieldset>

      <Card aria-live="polite">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">熱量預估</h2>
        {preview ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="RER 靜止能量" value={preview.rer} unit="kcal" />
            <Stat label="活動係數" value={preview.factor.toFixed(1)} />
            <Stat label="DER 每日所需" value={preview.der} unit="kcal" />
            <Stat
              label="單餐目標"
              value={preview.mealTarget}
              unit="kcal"
              hint={`每日 ${preview.mealsPerDay} 餐`}
            />
          </div>
        ) : (
          <p className="text-sm text-stone-600">輸入體重後顯示預估熱量</p>
        )}
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block icon={Save} loading={saving}>
        儲存
      </Button>
    </form>
  );
}
