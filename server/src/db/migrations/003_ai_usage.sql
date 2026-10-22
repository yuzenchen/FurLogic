-- AI 復盤每次呼叫 Anthropic 的用量與成本(USD)。日 / 月額度以 cost_usd 加總。
-- created_at 為 UTC ISO 字串;日 / 月界由程式以 Asia/Taipei 換算後比較。
-- verdict:成功解析出的 review.verdict;refusal / 回應不符 schema 時為 NULL(仍計費故仍記錄)。
CREATE TABLE ai_usage (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  verdict TEXT
);

CREATE INDEX idx_ai_usage_created ON ai_usage (created_at);
