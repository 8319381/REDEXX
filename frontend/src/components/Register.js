import React, { useState } from 'react';
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
} from '@mui/material';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    try {
      const user = await register(email, password, role);
      navigate(user.role === 'logistician' ? '/logistician' : '/buyer');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center">
            Регистрация
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            {error && (
              <Typography color="error" align="center" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
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
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Подтвердите пароль"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <FormLabel component="legend">Роль</FormLabel>
              <RadioGroup
                row
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <FormControlLabel
                  value="logistician"
                  control={<Radio />}
                  label="Логист"
                />
                <FormControlLabel
                  value="buyer"
                  control={<Radio />}
                  label="Покупатель"
                />
              </RadioGroup>
            </FormControl>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Зарегистрироваться
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
