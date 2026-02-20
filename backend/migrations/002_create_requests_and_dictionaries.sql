-- Создание справочников

-- Справочник Инкотермс
CREATE TABLE IF NOT EXISTS incoterms (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

INSERT INTO incoterms (code, name, description) VALUES
  ('EXW', 'EXW - Ex Works', 'Франко завод'),
  ('FCA', 'FCA - Free Carrier', 'Франко перевозчик'),
  ('CPT', 'CPT - Carriage Paid To', 'Фрахт/перевозка оплачены до'),
  ('CIP', 'CIP - Carriage and Insurance Paid', 'Фрахт/перевозка и страхование оплачены до'),
  ('DAP', 'DAP - Delivered At Place', 'Поставка в месте назначения'),
  ('DPU', 'DPU - Delivered at Place Unloaded', 'Поставка в месте назначения разгружено'),
  ('DDP', 'DDP - Delivered Duty Paid', 'Поставка с оплатой пошлин'),
  ('FAS', 'FAS - Free Alongside Ship', 'Свободно вдоль борта судна'),
  ('FOB', 'FOB - Free On Board', 'Свободно на борту'),
  ('CFR', 'CFR - Cost and Freight', 'Стоимость и фрахт'),
  ('CIF', 'CIF - Cost, Insurance and Freight', 'Стоимость, страхование и фрахт')
ON CONFLICT (code) DO NOTHING;

-- Справочник типов контейнеров
CREATE TABLE IF NOT EXISTS container_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

INSERT INTO container_types (code, name, description) VALUES
  ('20DC', '20DC - 20 футов стандартный', '20-футовый стандартный контейнер'),
  ('40DC', '40DC - 40 футов стандартный', '40-футовый стандартный контейнер'),
  ('40HC', '40HC - 40 футов высокий', '40-футовый высокий контейнер')
ON CONFLICT (code) DO NOTHING;

-- Справочник типов груза
CREATE TABLE IF NOT EXISTS cargo_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO cargo_types (code, name) VALUES
  ('safe', 'Неопасный'),
  ('dangerous', 'Опасный'),
  ('bulk', 'Сыпучий'),
  ('refrigerated', 'Рефрижераторный'),
  ('liquid', 'Жидкий (цистерна)')
ON CONFLICT (code) DO NOTHING;

-- Справочник видов транспорта
CREATE TABLE IF NOT EXISTS transport_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO transport_types (code, name) VALUES
  ('auto', 'Авто'),
  ('rail', 'ЖД'),
  ('sea', 'Море'),
  ('air', 'Авиа')
ON CONFLICT (code) DO NOTHING;

-- Справочник городов/портов/пунктов (для валидации)
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('city', 'port', 'point')),
  country TEXT,
  region TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);

-- Таблица заявок на перевозку
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Обязательные поля
  cargo_ready_date DATE NOT NULL,
  origin_location TEXT NOT NULL, -- Пункт отправки
  destination_location TEXT NOT NULL, -- Пункт назначения
  container_type_code TEXT NOT NULL REFERENCES container_types(code),
  incoterm_code TEXT NOT NULL REFERENCES incoterms(code),
  cargo_weight DECIMAL(12, 2), -- Вес груза (опционально)
  
  -- Опциональные поля
  cargo_volume DECIMAL(12, 2), -- Объем
  cargo_type_code TEXT REFERENCES cargo_types(code), -- Тип груза
  desired_delivery_days INTEGER, -- Желаемый срок поставки (дней)
  preferred_transport_code TEXT REFERENCES transport_types(code), -- Предпочитаемый вид транспорта
  cargo_value DECIMAL(15, 2), -- Стоимость груза
  comment TEXT, -- Дополнительный комментарий
  
  -- Метаданные
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);

COMMENT ON TABLE requests IS 'Заявки на перевозку от заказчиков';
COMMENT ON COLUMN requests.cargo_ready_date IS 'Дата готовности груза';
COMMENT ON COLUMN requests.origin_location IS 'Пункт отправки (город, порт, пункт)';
COMMENT ON COLUMN requests.destination_location IS 'Пункт назначения (город, порт, пункт)';
COMMENT ON COLUMN requests.cargo_weight IS 'Вес груза (опционально)';
COMMENT ON COLUMN requests.cargo_volume IS 'Объем груза (опционально)';
COMMENT ON COLUMN requests.desired_delivery_days IS 'Желаемый срок поставки в днях (опционально)';
COMMENT ON COLUMN requests.cargo_value IS 'Стоимость груза (опционально)';
