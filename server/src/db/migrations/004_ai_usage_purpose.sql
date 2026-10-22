-- ai_usage 每筆呼叫的用途:'review'(AI 復盤)| 'food_lookup'(線上查詢食材營養)。
-- 既有資料為 NULL,視為 'review'。日 / 月額度不分用途一起加總。
-- food_lookup 的 verdict 欄記 'recognized' | 'unrecognized'(refusal / 回應不符 schema 時為 NULL)。
ALTER TABLE ai_usage ADD COLUMN purpose TEXT;
