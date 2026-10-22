import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { buildDraftPayload, describeLookupError } from './foodDraft';

const draft = {
  name: ' 冬瓜 ',
  nameEn: 'Winter melon',
  type: 'veg',
  recipeRole: 'plant',
  subtype: null,
  safety: 'safe',
  warning: '',
  description: '水分高、低熱量。',
  calories: 13,
  protein: 0.4,
  fat: 0.2,
  ca: 19,
  p: 19,
  source: 'ai',
  sourceRef: 'claude',
  confidence: 'high', // 非允許欄位:不能送出
};

describe('buildDraftPayload', () => {
  it('只送 POST /api/foods 允許的欄位,source 固定 ai', () => {
    const payload = buildDraftPayload(draft);
    expect(payload).toEqual({
      name: '冬瓜',
      nameEn: 'Winter melon',
      type: 'veg',
      recipeRole: 'plant',
      subtype: null,
      safety: 'safe',
      warning: null,
      description: '水分高、低熱量。',
      calories: 13,
      protein: 0.4,
      fat: 0.2,
      ca: 19,
      p: 19,
      source: 'ai',
      sourceRef: 'claude',
    });
  });

  it('截斷過長字串、有毒食材改為 excluded', () => {
    const payload = buildDraftPayload({
      ...draft,
      name: '名'.repeat(60),
      sourceRef: 'x'.repeat(400),
      safety: 'toxic',
    });
    expect(payload.name).toHaveLength(40);
    expect(payload.sourceRef).toHaveLength(300);
    expect(payload.recipeRole).toBe('excluded');
  });
});

describe('describeLookupError', () => {
  it.each([
    [422, 'food_unrecognized', 'unrecognized', 'AI 看不懂這個食材：原因'],
    [
      503,
      'ai_unavailable',
      'unavailable',
      'AI 未設定（ANTHROPIC_API_KEY），請改用手動輸入',
    ],
    [429, 'ai_quota_exceeded', 'quota', 'AI 額度已用完或太頻繁：原因'],
    [429, 'rate_limited', 'quota', 'AI 額度已用完或太頻繁：原因'],
    [502, 'ai_failed', 'failed', 'AI 查詢失敗：原因'],
  ])('%i %s → %s', (status, code, kind, text) => {
    expect(describeLookupError(new ApiError(status, code, '原因'))).toEqual({
      kind,
      text,
    });
  });

  it('非 ApiError 也顯示查詢失敗', () => {
    expect(describeLookupError(new Error('boom'))).toEqual({
      kind: 'failed',
      text: 'AI 查詢失敗：boom',
    });
  });
});
