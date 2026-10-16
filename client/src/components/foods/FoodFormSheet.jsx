import React, { useId, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { FOOD_TYPES } from '@furlogic/shared';
import { ApiError, createFood, listFoods, updateFood } from '../../api/client';
import { BottomSheet, Button, FOCUS_RING, cx } from '../ui';
import Segmented from './Segmented';
import SourceBadge from './SourceBadge';

const ROLE_OPTIONS = [
  { value: 'protein', label: '蛋白質' },
  { value: 'plant', label: '蔬果主食' },
];
const SAFETY_OPTIONS = [
  { value: 'safe', label: '安全' },
  { value: 'caution', label: '注意' },
  { value: 'toxic', label: '禁止' },
];
const NUTRIENTS = [
  { key: 'calories', label: '熱量', unit: 'kcal', positive: true },
  { key: 'protein', label: '蛋白質', unit: 'g' },
  { key: 'fat', label: '脂肪', unit: 'g' },
  { key: 'ca', label: '鈣', unit: 'mg' },
  { key: 'p', label: '磷', unit: 'mg' },
];

const INPUT_CLASS = cx(
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-stone-900',
  FOCUS_RING,
);

const roleFor = (food) => {
  if (food?.recipeRole === 'protein' || food?.recipeRole === 'plant') {
    return food.recipeRole;
  }
  // 與 toFormValues 的類別預設(蛋白質)一致:沒有類別時也預設蛋白質
  return !food?.type || food.type === 'protein' ? 'protein' : 'plant';
};

const numText = (v) => (Number.isFinite(v) ? String(v) : '');

const toFormValues = (food = {}) => ({
  name: food.name ?? '',
  nameEn: food.nameEn ?? '',
  type: FOOD_TYPES[food.type] ? food.type : 'protein',
  recipeRole: roleFor(food),
  safety: ['safe', 'caution', 'toxic'].includes(food.safety)
    ? food.safety
    : 'safe',
  warning: food.warning ?? '',
  calories: numText(food.calories),
  protein: numText(food.protein),
  fat: numText(food.fat),
  ca: numText(food.ca),
  p: numText(food.p),
});

const parseNum = (text) => {
  const t = String(text).trim();
  if (t === '') return NaN;
  return Number(t);
};

const validate = (v) => {
  const errors = {};
  const name = v.name.trim();
  if (!name) errors.name = '請輸入名稱';
  else if (name.length > 40) errors.name = '名稱最多 40 字';
  if (v.nameEn.trim().length > 80) errors.nameEn = '英文名最多 80 字';
  if (v.warning.trim().length > 500) errors.warning = '警語最多 500 字';
  NUTRIENTS.forEach(({ key, positive }) => {
    const n = parseNum(v[key]);
    if (!Number.isFinite(n)) errors[key] = '請輸入數字';
    else if (positive && n <= 0) errors[key] = '需大於 0';
    else if (n < 0) errors[key] = '不可小於 0';
  });
  return errors;
};

/** 表單值 → API 欄位(可為 null 的字串欄位空白時回 null) */
const toFields = (v) => {
  const fields = {
    name: v.name.trim(),
    nameEn: v.nameEn.trim() || null,
    type: v.type,
    recipeRole: v.safety === 'toxic' ? 'excluded' : v.recipeRole,
    safety: v.safety,
    warning: v.warning.trim() || null,
  };
  NUTRIENTS.forEach(({ key }) => {
    fields[key] = parseNum(v[key]);
  });
  return fields;
};

/** POST /api/foods body:可選欄位為空時直接省略 */
const buildCreatePayload = (v, mode, initial) => {
  const fields = toFields(v);
  const payload = {};
  Object.entries(fields).forEach(([k, val]) => {
    if (val !== null) payload[k] = val;
  });
  const fromLookup =
    mode === 'lookup' &&
    (initial?.source === 'usda' || initial?.source === 'ai');
  payload.source = fromLookup ? initial.source : 'manual';
  if (
    fromLookup &&
    typeof initial.sourceRef === 'string' &&
    initial.sourceRef
  ) {
    payload.sourceRef = initial.sourceRef.slice(0, 300);
  }
  if (
    fromLookup &&
    typeof initial.description === 'string' &&
    initial.description.trim()
  ) {
    payload.description = initial.description.trim().slice(0, 500);
  }
  return payload;
};

/** PUT /api/foods/:id body:只送有變動的欄位 */
const buildPatch = (v, original) => {
  const fields = toFields(v);
  const patch = {};
  Object.entries(fields).forEach(([k, val]) => {
    if (val !== (original?.[k] ?? null)) patch[k] = val;
  });
  return patch;
};

/**
 * 新增 / 編輯食材的抽屜(批次頁與食材頁共用)。父元件在需要時才掛載。
 * @param {'manual'|'lookup'|'edit'} mode
 * @param {object} initial 預填資料(lookup draft / 既有食材 / { name })
 * @param {'high'|'low'} [confidence] lookup 信心度
 * @param {string} [notice] 表單上方提示(查詢失敗等)
 * @param {'batch'|'foods'} context batch:儲存後加入批次(有毒則只存入食材庫)
 * @param {(food: object) => void} onSaved 儲存成功或選擇「改用現有的」時呼叫
 */
export default function FoodFormSheet({
  open = true,
  onClose,
  mode = 'manual',
  initial,
  confidence,
  notice,
  context = 'foods',
  onSaved,
}) {
  const formId = useId();
  const [values, setValues] = useState(() => toFormValues(initial));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [duplicate, setDuplicate] = useState(false);
  const [usingExisting, setUsingExisting] = useState(false);

  const isEdit = mode === 'edit';
  const isToxic = values.safety === 'toxic';
  const title = isEdit ? '編輯食材' : '新增食材';

  const set = (key) => (value) => {
    setValues((v) => {
      const next = { ...v, [key]: value };
      // 改類別時順便帶入合理的配餐角色(使用者仍可再改)
      if (key === 'type')
        next.recipeRole = value === 'protein' ? 'protein' : 'plant';
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const onInput = (key) => (e) => set(key)(e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setApiError(null);
    setDuplicate(false);
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        const patch = buildPatch(values, initial);
        if (Object.keys(patch).length === 0) {
          onClose?.();
          return;
        }
        saved = await updateFood(initial.id, patch);
      } else {
        saved = await createFood(buildCreatePayload(values, mode, initial));
      }
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_name') {
        setDuplicate(true);
      } else {
        setApiError(err?.message || '儲存失敗');
      }
    } finally {
      setSaving(false);
    }
  };

  const useExisting = async () => {
    const name = values.name.trim();
    setUsingExisting(true);
    setApiError(null);
    try {
      const list = await listFoods({ q: name });
      const hit = (list ?? []).find((f) => f.name === name);
      if (hit) onSaved?.(hit);
      else setApiError('找不到同名食材');
    } catch (err) {
      setApiError(err?.message || '查詢失敗');
    } finally {
      setUsingExisting(false);
    }
  };

  let submitLabel = '儲存';
  if (isEdit) submitLabel = '儲存變更';
  else if (context === 'batch')
    submitLabel = isToxic ? '只存入食材庫' : '儲存並加入';

  const badgeSource = isEdit
    ? initial?.source
    : mode === 'lookup'
      ? initial?.source
      : 'manual';

  const footer = (
    <Button type="submit" form={formId} block size="lg" loading={saving}>
      {submitLabel}
    </Button>
  );

  const fieldError = (key) =>
    errors[key] ? (
      <p id={`${formId}-${key}-err`} className="mt-1 text-xs text-rose-700">
        {errors[key]}
      </p>
    ) : null;
  const errProps = (key) =>
    errors[key]
      ? { 'aria-invalid': true, 'aria-describedby': `${formId}-${key}-err` }
      : {};

  return (
    <BottomSheet open={open} onClose={onClose} title={title} footer={footer}>
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge
            source={badgeSource}
            sourceRef={initial?.sourceRef}
            lowConfidence={confidence === 'low'}
          />
        </div>

        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-800">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}

        {isToxic && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
          >
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            對狗有毒,無法加入餐點
          </p>
        )}

        <Field label="名稱" htmlFor={`${formId}-name`} required>
          <input
            id={`${formId}-name`}
            className={INPUT_CLASS}
            value={values.name}
            onChange={onInput('name')}
            maxLength={40}
            autoComplete="off"
            {...errProps('name')}
          />
          {fieldError('name')}
        </Field>

        <Field label="英文名(選填)" htmlFor={`${formId}-nameEn`}>
          <input
            id={`${formId}-nameEn`}
            className={INPUT_CLASS}
            value={values.nameEn}
            onChange={onInput('nameEn')}
            maxLength={80}
            autoComplete="off"
            lang="en"
            {...errProps('nameEn')}
          />
          {fieldError('nameEn')}
        </Field>

        <Field label="類別" htmlFor={`${formId}-type`}>
          <select
            id={`${formId}-type`}
            className={INPUT_CLASS}
            value={values.type}
            onChange={onInput('type')}
          >
            {Object.entries(FOOD_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="配餐角色" labelId={`${formId}-role`}>
          <Segmented
            labelId={`${formId}-role`}
            value={values.recipeRole}
            options={ROLE_OPTIONS}
            onChange={set('recipeRole')}
          />
        </Field>

        <Field label="安全性" labelId={`${formId}-safety`}>
          <Segmented
            labelId={`${formId}-safety`}
            value={values.safety}
            options={SAFETY_OPTIONS}
            onChange={set('safety')}
          />
        </Field>

        <Field label="警語(選填)" htmlFor={`${formId}-warning`}>
          <textarea
            id={`${formId}-warning`}
            className={cx(INPUT_CLASS, 'h-auto min-h-11 py-2')}
            rows={2}
            value={values.warning}
            onChange={onInput('warning')}
            maxLength={500}
            {...errProps('warning')}
          />
          {fieldError('warning')}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-800">
            每 100g 營養值(生食)
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {NUTRIENTS.map(({ key, label, unit }) => (
              <div key={key}>
                <label
                  htmlFor={`${formId}-${key}`}
                  className="mb-1 block text-xs text-stone-600"
                >
                  {label} {unit}
                </label>
                <input
                  id={`${formId}-${key}`}
                  className={cx(INPUT_CLASS, 'text-right tabular-nums')}
                  inputMode="decimal"
                  value={values[key]}
                  onChange={onInput(key)}
                  autoComplete="off"
                  {...errProps(key)}
                />
                {fieldError(key)}
              </div>
            ))}
          </div>
        </fieldset>

        {duplicate && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2"
          >
            <p className="text-sm font-semibold text-amber-700">已有同名食材</p>
            {!isEdit && (
              <Button
                variant="secondary"
                onClick={useExisting}
                loading={usingExisting}
              >
                改用現有的
              </Button>
            )}
          </div>
        )}

        {apiError && (
          <p role="alert" className="text-sm text-rose-700">
            {apiError}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}

function Field({ label, htmlFor, labelId, required, children }) {
  return (
    <div>
      {labelId ? (
        <p id={labelId} className="mb-1 text-sm font-medium text-stone-800">
          {label}
        </p>
      ) : (
        <label
          htmlFor={htmlFor}
          className="mb-1 block text-sm font-medium text-stone-800"
        >
          {label}
          {required && <span className="ml-0.5 text-rose-700">*</span>}
        </label>
      )}
      {children}
    </div>
  );
}
