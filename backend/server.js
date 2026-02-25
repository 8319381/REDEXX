require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set in .env");
  process.exit(1);
}

// важно за nginx (secure cookies)
app.set('trust proxy', 1);

// если фронт и бэк на одном домене — CORS почти не нужен,
// но оставим аккуратно (на будущее, для dev)
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://mybets1.site')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // curl/сервер-сервер
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Static lists (ok to keep in code)
const routes = [
  { from: 'Москва', to: 'Шанхай' },
  { from: 'Москва', to: 'Пекин' },
  { from: 'Москва', to: 'Нингбо' },
  { from: 'Москва', to: 'Циндао' },
  { from: 'Москва', to: 'Яньтянь' },
  { from: 'Санкт-Петербург', to: 'Шанхай' },
  { from: 'Санкт-Петербург', to: 'Пекин' },
  { from: 'Санкт-Петербург', to: 'Нингбо' },
  { from: 'Екатеринбург', to: 'Шанхай' },
  { from: 'Екатеринбург', to: 'Гуанчжоу' }
];
const containerTypes = ["20'", "20' Heavy", "40'", "40' HC"];

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  return jwt.sign(
    { id: String(user.id), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function setAuthCookie(res, token) {
  const isProd = (process.env.NODE_ENV || 'production') === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,       // на проде true (у тебя https)
    sameSite: 'lax',      // базовая защита от CSRF
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Auth middleware: сначала cookie, потом Authorization Bearer (для совместимости)
function authenticateToken(req, res, next) {
  const cookieToken = req.cookies?.[COOKIE_NAME];

  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  const token = cookieToken || bearerToken;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Health
app.get('/api/health', async (req, res) => {
  try {
    await db.query('select 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

// Валидация пароля: не менее 8 символов, заглавные и строчные буквы, цифры и спецсимволы
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { ok: false, message: 'Пароль должен быть не менее 8 символов' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: 'Пароль должен содержать хотя бы одну заглавную букву' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: 'Пароль должен содержать хотя бы одну строчную букву' };
  }
  if (!/\d/.test(password)) {
    return { ok: false, message: 'Пароль должен содержать хотя бы одну цифру' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { ok: false, message: 'Пароль должен содержать хотя бы один спецсимвол' };
  }
  return { ok: true };
}

const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party';
const DADATA_ADDRESS_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

async function validateInnWithDaData(inn) {
  const apiKey = process.env.DADATA_API_KEY;
  if (!apiKey) {
    return { valid: true, companyName: null };
  }
  const trimmed = String(inn || '').trim();
  if (!trimmed) return { valid: false, companyName: null };
  try {
    const response = await fetch(DADATA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
      body: JSON.stringify({ query: trimmed }),
    });
    if (!response.ok) return { valid: false, companyName: null };
    const data = await response.json();
    const suggestions = data.suggestions || [];
    if (suggestions.length === 0) return { valid: false, companyName: null };
    const first = suggestions[0];
    const state = first.data?.state?.status;
    if (state === 'LIQUIDATED' || state === 'BANKRUPT') {
      return { valid: false, companyName: null };
    }
    const companyName = first.data?.name?.short_with_opf || first.data?.name?.full_with_opf || first.value || null;
    return { valid: true, companyName };
  } catch (e) {
    console.error('DaData error', e.message);
    return { valid: false, companyName: null };
  }
}

// Валидация адреса/города через DaData
async function validateLocationWithDaData(query) {
  const apiKey = process.env.DADATA_API_KEY;
  if (!apiKey) {
    // Если нет ключа, проверяем в БД
    return await validateLocationInDB(query);
  }
  const trimmed = String(query || '').trim();
  if (!trimmed) return { valid: false, suggestions: [] };
  try {
    const response = await fetch(DADATA_ADDRESS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
      body: JSON.stringify({ query: trimmed, count: 10 }),
    });
    if (!response.ok) {
      // Fallback на БД если DaData недоступен
      return await validateLocationInDB(query);
    }
    const data = await response.json();
    const suggestions = (data.suggestions || []).map(s => ({
      value: s.value,
      city: s.data?.city || s.data?.settlement || '',
      region: s.data?.region || '',
      country: s.data?.country || '',
    }));
    return { valid: suggestions.length > 0, suggestions };
  } catch (e) {
    console.error('DaData address error', e.message);
    // Fallback на БД
    return await validateLocationInDB(query);
  }
}

// Валидация локации в БД
async function validateLocationInDB(query) {
  try {
    const trimmed = String(query || '').trim();
    if (!trimmed) return { valid: false, suggestions: [] };
    const result = await db.query(
      `SELECT name, type, country, region FROM locations 
       WHERE LOWER(name) LIKE LOWER($1) || '%' 
       ORDER BY name LIMIT 10`,
      [`%${trimmed}%`]
    );
    const suggestions = result.rows.map(row => ({
      value: row.name,
      city: row.name,
      region: row.region || '',
      country: row.country || '',
    }));
    return { valid: suggestions.length > 0, suggestions };
  } catch (e) {
    console.error('DB location validation error', e.message);
    return { valid: false, suggestions: [] };
  }
}

app.get('/api/validate-inn', async (req, res) => {
  try {
    const inn = req.query.inn;
    if (!inn || !String(inn).trim()) {
      return res.json({ valid: false, companyName: null });
    }
    const result = await validateInnWithDaData(inn);
    res.json(result);
  } catch (e) {
    console.error('validate-inn error', e);
    res.status(500).json({ valid: false, companyName: null });
  }
});

// Register
const ALLOWED_ROLES = ['buyer', 'logistician', 'admin'];

app.post('/api/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      companyName,
      inn,
      email,
      password,
      confirmPassword,
      role,
    } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Обязательны: email, пароль и роль' });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'Укажите имя и фамилию' });
    }
    if (!companyName || !inn) {
      return res.status(400).json({ message: 'Укажите наименование компании и ИНН' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Пароли не совпадают' });
    }

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.ok) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Недопустимая роль' });
    }

    const innResult = await validateInnWithDaData(inn);
    if (!innResult.valid) {
      return res.status(400).json({ message: 'ИНН не найден или организация недействующая. Проверьте ИНН по DaData.' });
    }

    const existing = await db.query('select id from users where email=$1', [email]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: 'Пользователь с таким email уже зарегистрирован' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const ins = await db.query(
      `insert into users(email, password_hash, role, first_name, last_name, company_name, inn)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, email, role, first_name, last_name, company_name, inn, created_at`,
      [email, passwordHash, role, firstName.trim(), lastName.trim(), companyName.trim(), String(inn).trim()]
    );

    const row = ins.rows[0];
    const user = {
      id: row.id,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
      company_name: row.company_name,
      inn: row.inn,
      created_at: row.created_at,
    };
    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({ token, user });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ message: 'Ошибка при регистрации' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const r = await db.query(
      'select id, email, password_hash, role, first_name, last_name, company_name, inn, created_at from users where email=$1',
      [email]
    );

    if (r.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userRow = r.rows[0];
    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      first_name: userRow.first_name,
      last_name: userRow.last_name,
      company_name: userRow.company_name,
      inn: userRow.inn,
      created_at: userRow.created_at,
    };

    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({ token, user });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// "Who am I" — полный профиль из БД
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const r = await db.query(
      'select id, email, role, first_name, last_name, company_name, inn, created_at from users where id=$1',
      [req.user.id]
    );
    if (r.rowCount === 0) return res.sendStatus(404);
    const row = r.rows[0];
    res.json({
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        first_name: row.first_name,
        last_name: row.last_name,
        company_name: row.company_name,
        inn: row.inn,
        created_at: row.created_at,
      },
    });
  } catch (e) {
    console.error('me error', e);
    res.status(500).json({ message: 'Error' });
  }
});

// Bets: POST
app.post('/api/bets', authenticateToken, async (req, res) => {
  try {
    const { route, transportType, cost, deliveryDays, isCounterBid, originalBetId } = req.body;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        runId:'initial',
        hypothesisId:'H1',
        location:'server.js:396',
        message:'POST /api/bets received payload',
        data:{
          userId:req.user?.id,
          userRole:req.user?.role,
          route,
          transportType,
          cost,
          deliveryDays,
          isCounterBid:!!isCounterBid,
          originalBetId:originalBetId||null
        },
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    const bet = {
      userId: String(req.user.id),
      userEmail: req.user.email,
      userRole: req.user.role,
      route,
      transportType,
      cost,
      deliveryDays,
      isCounterBid: !!isCounterBid,
      originalBetId: originalBetId || null,
      createdAt: new Date().toISOString(),
    };

    const betId = crypto.randomUUID();

    await db.query(
      'insert into bets(bet_id, data) values ($1, $2::jsonb)',
      [betId, JSON.stringify(bet)]
    );

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        runId:'initial',
        hypothesisId:'H2',
        location:'server.js:416',
        message:'POST /api/bets inserted bet',
        data:{betId, userId:req.user?.id},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    res.json({ bet_id: betId, data: bet, created_at: bet.createdAt });
  } catch (e) {
    console.error('bets post error', e);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        runId:'initial',
        hypothesisId:'H3',
        location:'server.js:423',
        message:'POST /api/bets error',
        data:{name:e.name,message:e.message,code:e.code},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion
    res.status(500).json({ 
      message: 'Error creating bet', 
      code: e.code || null,
      error: e.message || String(e)
    });
  }
});

// Bets: GET (простая логика фильтрации как у тебя было)
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    const r = await db.query(
      'select bet_id, data, created_at from bets order by created_at desc limit 500'
    );

    const all = r.rows.map(row => ({
      id: row.bet_id,
      ...row.data,
      created_at: row.created_at,
    }));

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        runId:'initial',
        hypothesisId:'H4',
        location:'server.js:435',
        message:'GET /api/bets loaded from DB',
        data:{count:all.length,userRole:req.user?.role},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    let userBets;
    if (req.user.role === 'logistician') {
      userBets = all.filter(b =>
        b.userId === String(req.user.id) ||
        (b.isCounterBid && all.find(x => x.id === b.originalBetId)?.userId === String(req.user.id))
      );
    } else {
      userBets = all.filter(b =>
        b.userRole === 'logistician' ||
        (b.isCounterBid && b.userId === String(req.user.id))
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        runId:'initial',
        hypothesisId:'H5',
        location:'server.js:454',
        message:'GET /api/bets filtered for user',
        data:{resultCount:userBets.length,userRole:req.user?.role,userId:req.user?.id},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    res.json(userBets);
  } catch (e) {
    console.error('bets get error', e);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        runId:'initial',
        hypothesisId:'H6',
        location:'server.js:456',
        message:'GET /api/bets error',
        data:{name:e.name,message:e.message,code:e.code},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion
    res.status(500).json({ message: 'Error loading bets' });
  }
});

// Available routes and container types
app.get('/api/routes', (req, res) => res.json(routes));
app.get('/api/container-types', async (req, res) => {
  try {
    const result = await db.query('SELECT code, name, description FROM container_types ORDER BY code');
    if (result.rowCount > 0) {
      res.json(result.rows);
    } else {
      // Fallback на статический список если БД пустая
      res.json(containerTypes.map(ct => ({ code: ct, name: ct })));
    }
  } catch (e) {
    console.error('container-types error', e);
    // Fallback на статический список при ошибке
    res.json(containerTypes.map(ct => ({ code: ct, name: ct })));
  }
});

// Валидация локации (города/порта/пункта)
app.get('/api/validate-location', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || !String(query).trim()) {
      return res.json({ valid: false, suggestions: [] });
    }
    const result = await validateLocationWithDaData(query);
    res.json(result);
  } catch (e) {
    console.error('validate-location error', e);
    res.status(500).json({ valid: false, suggestions: [] });
  }
});

// Справочники
app.get('/api/incoterms', async (req, res) => {
  try {
    const result = await db.query('SELECT code, name, description FROM incoterms ORDER BY code');
    res.json(result.rows);
  } catch (e) {
    console.error('incoterms error', e);
    res.status(500).json({ message: 'Error loading incoterms' });
  }
});

app.get('/api/cargo-types', async (req, res) => {
  try {
    const result = await db.query('SELECT code, name FROM cargo_types ORDER BY code');
    res.json(result.rows);
  } catch (e) {
    console.error('cargo-types error', e);
    res.status(500).json({ message: 'Error loading cargo types' });
  }
});

app.get('/api/transport-types', async (req, res) => {
  try {
    const result = await db.query('SELECT code, name FROM transport_types ORDER BY code');
    res.json(result.rows);
  } catch (e) {
    console.error('transport-types error', e);
    res.status(500).json({ message: 'Error loading transport types' });
  }
});

// CRUD для заявок на перевозку
// GET /api/requests - получить все заявки пользователя
app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, 
              ct.name as container_type_name,
              i.name as incoterm_name,
              cg.name as cargo_type_name,
              tt.name as transport_type_name
       FROM requests r
       LEFT JOIN container_types ct ON r.container_type_code = ct.code
       LEFT JOIN incoterms i ON r.incoterm_code = i.code
       LEFT JOIN cargo_types cg ON r.cargo_type_code = cg.code
       LEFT JOIN transport_types tt ON r.preferred_transport_code = tt.code
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('requests get error', e);
    res.status(500).json({ message: 'Ошибка при загрузке заявок' });
  }
});

// GET /api/requests/:id - получить одну заявку
app.get('/api/requests/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, 
              ct.name as container_type_name,
              i.name as incoterm_name,
              cg.name as cargo_type_name,
              tt.name as transport_type_name
       FROM requests r
       LEFT JOIN container_types ct ON r.container_type_code = ct.code
       LEFT JOIN incoterms i ON r.incoterm_code = i.code
       LEFT JOIN cargo_types cg ON r.cargo_type_code = cg.code
       LEFT JOIN transport_types tt ON r.preferred_transport_code = tt.code
       WHERE r.id = $1 AND r.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }
    res.json(result.rows[0]);
  } catch (e) {
    console.error('request get error', e);
    res.status(500).json({ message: 'Ошибка при загрузке заявки' });
  }
});

// POST /api/requests - создать заявку
app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const {
      cargo_ready_date,
      origin_location,
      destination_location,
      container_type_code,
      incoterm_code,
      cargo_weight,
      cargo_volume,
      cargo_type_code,
      desired_delivery_days,
      preferred_transport_code,
      cargo_value,
      comment,
    } = req.body;

    // Валидация обязательных полей
    if (!cargo_ready_date || !origin_location || !destination_location || 
        !container_type_code || !incoterm_code) {
      return res.status(400).json({ 
        message: 'Обязательны: дата готовности груза, пункт отправки, пункт назначения, тип контейнера, Инкотермс' 
      });
    }

    const result = await db.query(
      `INSERT INTO requests (
        user_id, cargo_ready_date, origin_location, destination_location,
        container_type_code, incoterm_code, cargo_weight,
        cargo_volume, cargo_type_code, desired_delivery_days,
        preferred_transport_code, cargo_value, comment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.user.id,
        cargo_ready_date,
        origin_location.trim(),
        destination_location.trim(),
        container_type_code,
        incoterm_code,
        cargo_weight || null,
        cargo_volume || null,
        cargo_type_code || null,
        desired_delivery_days || null,
        preferred_transport_code || null,
        cargo_value || null,
        comment || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('request post error', e);
    if (e.code === '23503') { // Foreign key violation
      return res.status(400).json({ message: 'Некорректное значение справочника' });
    }
    res.status(500).json({ message: 'Ошибка при создании заявки' });
  }
});

// PUT /api/requests/:id - обновить заявку
app.put('/api/requests/:id', authenticateToken, async (req, res) => {
  try {
    const {
      cargo_ready_date,
      origin_location,
      destination_location,
      container_type_code,
      incoterm_code,
      cargo_weight,
      cargo_volume,
      cargo_type_code,
      desired_delivery_days,
      preferred_transport_code,
      cargo_value,
      comment,
      status,
    } = req.body;

    // Проверяем, что заявка принадлежит пользователю
    const checkResult = await db.query(
      'SELECT id FROM requests WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (checkResult.rowCount === 0) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    const result = await db.query(
      `UPDATE requests SET
        cargo_ready_date = COALESCE($1, cargo_ready_date),
        origin_location = COALESCE($2, origin_location),
        destination_location = COALESCE($3, destination_location),
        container_type_code = COALESCE($4, container_type_code),
        incoterm_code = COALESCE($5, incoterm_code),
        cargo_weight = $6,
        cargo_volume = $7,
        cargo_type_code = $8,
        desired_delivery_days = $9,
        preferred_transport_code = $10,
        cargo_value = $11,
        comment = $12,
        status = COALESCE($13, status),
        updated_at = NOW()
      WHERE id = $14 AND user_id = $15
      RETURNING *`,
      [
        cargo_ready_date,
        origin_location ? origin_location.trim() : null,
        destination_location ? destination_location.trim() : null,
        container_type_code,
        incoterm_code,
        cargo_weight || null,
        cargo_volume || null,
        cargo_type_code || null,
        desired_delivery_days || null,
        preferred_transport_code || null,
        cargo_value || null,
        comment || null,
        status,
        req.params.id,
        req.user.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (e) {
    console.error('request put error', e);
    if (e.code === '23503') {
      return res.status(400).json({ message: 'Некорректное значение справочника' });
    }
    res.status(500).json({ message: 'Ошибка при обновлении заявки' });
  }
});

// DELETE /api/requests/:id - удалить заявку
app.delete('/api/requests/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM requests WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }
    res.json({ message: 'Заявка удалена', id: result.rows[0].id });
  } catch (e) {
    console.error('request delete error', e);
    res.status(500).json({ message: 'Ошибка при удалении заявки' });
  }
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await db.query('select now()');
    console.log('DB: OK');
  } catch (e) {
    console.error('DB: FAIL', e.message);
  }
});
