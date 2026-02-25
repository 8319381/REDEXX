-- Восстановление таблицы ставок логистов (bets)
-- Используется эндпоинтами /api/bets на бэкенде

CREATE TABLE IF NOT EXISTS bets (
  bet_id     TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bets_created_at_idx ON bets(created_at DESC);

