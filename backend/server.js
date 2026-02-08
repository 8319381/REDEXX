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

    res.json({ bet_id: betId, data: bet, created_at: bet.createdAt });
  } catch (e) {
    console.error('bets post error', e);
    res.status(500).json({ message: 'Error creating bet' });
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

    res.json(userBets);
  } catch (e) {
    console.error('bets get error', e);
    res.status(500).json({ message: 'Error loading bets' });
  }
});

// Available routes and container types
app.get('/api/routes', (req, res) => res.json(routes));
app.get('/api/container-types', (req, res) => res.json(containerTypes));

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await db.query('select now()');
    console.log('DB: OK');
  } catch (e) {
    console.error('DB: FAIL', e.message);
  }
});
