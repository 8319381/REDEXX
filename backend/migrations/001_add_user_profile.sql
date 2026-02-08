-- Расширение таблицы users для регистрации с профилем и компанией
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS inn TEXT;

COMMENT ON COLUMN users.first_name IS 'Имя пользователя';
COMMENT ON COLUMN users.last_name IS 'Фамилия пользователя';
COMMENT ON COLUMN users.company_name IS 'Наименование компании';
COMMENT ON COLUMN users.inn IS 'ИНН организации (валидация через DaData)';
