import { ApiError } from '../api/client';

/** POST /api/foods 允許的欄位(未知欄位後端回 400) */
const CREATE_KEYS = [
  'name',
  'nameEn',
  'type',
  'recipeRole',
  'subtype',
  'safety',
  'warning',
  'description',
  'calories',
  'protein',
  'fat',
  'ca',
  'p',
  'sourceRef',
];
const MAX_LEN = {
  name: 40,
  nameEn: 80,
  warning: 500,
  description: 500,
  sourceRef: 300,
};

/** AI draft → POST /api/foods body:只挑允許欄位、字串截長度、空字串轉 null */
export const buildDraftPayload = (draft) => {
  const payload = {};
  CREATE_KEYS.forEach((key) => {
    let val = draft?.[key];
    if (val === undefined) return;
    if (typeof val === 'string') {
      val = val.trim();
      if (MAX_LEN[key]) val = val.slice(0, MAX_LEN[key]);
      if (val === '' && key !== 'name') val = null;
    }
    payload[key] = val;
  });
  // 有毒食材不參與配餐(與 FoodFormSheet 一致)
  if (payload.safety === 'toxic') payload.recipeRole = 'excluded';
  payload.source = 'ai';
  return payload;
};

/** lookup 錯誤 → 顯示用的 { kind, text } */
export const describeLookupError = (err) => {
  const message = err?.message || '未知錯誤';
  if (err instanceof ApiError) {
    if (err.code === 'food_unrecognized') {
      return { kind: 'unrecognized', text: `AI 看不懂這個食材：${message}` };
    }
    if (err.code === 'ai_unavailable') {
      return {
        kind: 'unavailable',
        text: 'AI 未設定（ANTHROPIC_API_KEY），請改用手動輸入',
      };
    }
    if (
      err.status === 429 ||
      err.code === 'ai_quota_exceeded' ||
      err.code === 'rate_limited'
    ) {
      return { kind: 'quota', text: `AI 額度已用完或太頻繁：${message}` };
    }
  }
  return { kind: 'failed', text: `AI 查詢失敗：${message}` };
};
