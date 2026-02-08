import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';

const PASSWORD_RULES = [
  'Не менее 8 символов',
  'Заглавная буква',
  'Строчная буква',
  'Цифра',
  'Спецсимвол (!@#$%^&* и т.д.)',
];

function checkPassword(password) {
  return {
    length: !!(password && password.length >= 8),
    upper: /[A-Z]/.test(password || ''),
    lower: /[a-z]/.test(password || ''),
    digit: /\d/.test(password || ''),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password || ''),
  };
}

const getBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname } = window.location;
  const port = window.location.port;
  if (port === '3000') return 'http://localhost:3001';
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inn, setInn] = useState('');
  const [innValid, setInnValid] = useState(null);
  const [innChecking, setInnChecking] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const passwordChecks = checkPassword(password);

  const validateInn = useCallback(async (value) => {
    const v = (value || '').trim();
    if (!v) {
      setInnValid(null);
      return;
    }
    if (v.length !== 10 && v.length !== 12) {
      setInnValid(false);
      return;
    }
    setInnChecking(true);
    setInnValid(null);
    try {
      const base = getBaseUrl();
      const res = await axios.get(`${base}/api/validate-inn`, { params: { inn: v }, withCredentials: true });
      const { valid, companyName: name } = res.data || {};
      setInnValid(!!valid);
      if (valid && name && !companyName) setCompanyName(name);
    } catch {
      setInnValid(false);
    } finally {
      setInnChecking(false);
    }
  }, [companyName]);

  const handleInnBlur = () => {
    if (inn.trim()) validateInn(inn);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    const checks = checkPassword(password);
    if (!(checks.length && checks.upper && checks.lower && checks.digit && checks.special)) {
      setError('Пароль не соответствует требованиям (см. подсказки ниже)');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Введите имя и фамилию');
      return;
    }
    if (!companyName.trim() || !inn.trim()) {
      setError('Введите наименование компании и ИНН');
      return;
    }
    if (innValid === false) {
      setError('Укажите корректный ИНН (проверка по DaData)');
      return;
    }

    setSubmitting(true);
    try {
      const user = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        inn: inn.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        role,
      });
      if (user.role === 'logistician') navigate('/logistician');
      else if (user.role === 'admin') navigate('/admin');
      else navigate('/buyer');
    } catch (err) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 4,
          marginBottom: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center">
            Регистрация
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            {error && (
              <Typography color="error" align="center" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}

            <TextField
              margin="normal"
              required
              fullWidth
              label="Имя"
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Фамилия"
              name="lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              label="Наименование компании"
              name="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="ИНН"
              name="inn"
              placeholder="10 или 12 цифр"
              value={inn}
              onChange={(e) => {
                setInn(e.target.value.replace(/\D/g, '').slice(0, 12));
                setInnValid(null);
              }}
              onBlur={handleInnBlur}
              error={innValid === false}
              helperText={
                innChecking
                  ? 'Проверка по DaData...'
                  : innValid === true
                  ? 'ИНН найден'
                  : innValid === false
                  ? 'ИНН не найден или организация недействующая'
                  : 'После ввода ИНН будет проверка по DaData'
              }
              inputProps={{ maxLength: 12, inputMode: 'numeric' }}
              InputProps={{
                endAdornment: innChecking ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : null,
              }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Пароль"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText={
                <Box component="span" sx={{ fontSize: '0.75rem' }}>
                  {PASSWORD_RULES.map((rule, i) => {
                    const key = ['length', 'upper', 'lower', 'digit', 'special'][i];
                    const ok = passwordChecks[key];
                    return (
                      <span key={key} style={{ color: ok ? 'green' : 'inherit', display: 'block' }}>
                        {ok ? '✓ ' : '○ '}
                        {rule}
                      </span>
                    );
                  })}
                </Box>
              }
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Подтверждение пароля"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={!!(confirmPassword && password !== confirmPassword)}
              helperText={confirmPassword && password !== confirmPassword ? 'Пароли не совпадают' : ''}
            />

            <FormControl component="fieldset" sx={{ mt: 2 }} required>
              <FormLabel component="legend">Роль</FormLabel>
              <RadioGroup
                row
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <FormControlLabel value="buyer" control={<Radio />} label="Заказчик" />
                <FormControlLabel value="logistician" control={<Radio />} label="Логист" />
                <FormControlLabel value="admin" control={<Radio />} label="Администратор" />
              </RadioGroup>
            </FormControl>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={submitting}
              sx={{ mt: 3, mb: 2 }}
            >
              {submitting ? <CircularProgress size={24} /> : 'Зарегистрироваться'}
            </Button>
            <Typography align="center">
              Уже есть аккаунт?{' '}
              <Link to="/login" style={{ textDecoration: 'none' }}>
                Войти
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register;
