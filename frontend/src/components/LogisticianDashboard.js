import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BetRow = ({ bet, counterBids }) => {
  const [open, setOpen] = useState(false);
  const hasCounterBids = counterBids && counterBids.length > 0;

  return (
    <>
      <TableRow 
        sx={{ 
          '& > *': { borderBottom: 'unset' },
          backgroundColor: hasCounterBids ? 'rgba(25, 118, 210, 0.04)' : 'inherit'
        }}
      >
        <TableCell>
          {hasCounterBids && (
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => setOpen(!open)}
            >
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body1" component="span">
              {bet.route}
            </Typography>
            {hasCounterBids && (
              <Typography
                variant="caption"
                color="primary"
                sx={{ ml: 1 }}
              >
                ({counterBids.length} встречн.)
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell>Ж/Д</TableCell>
        <TableCell>{bet.cost}</TableCell>
        <TableCell>{bet.deliveryDays}</TableCell>
        <TableCell>{new Date(bet.createdAt).toLocaleDateString()}</TableCell>
      </TableRow>
      {hasCounterBids && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ 
                margin: 1, 
                ml: 4,
                borderLeft: '2px solid #1976d2',
                pl: 2
              }}>
                <Typography 
                  variant="subtitle2" 
                  gutterBottom 
                  component="div"
                  color="primary"
                  sx={{ mb: 2 }}
                >
                  Встречные предложения по маршруту {bet.route}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary' }}>Email покупателя</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        Предложенная стоимость
                        {bet.cost > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            (ваша: {bet.cost} руб.)
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        Срок доставки
                        {bet.deliveryDays > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            (ваш: {bet.deliveryDays} дн.)
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>Дата предложения</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {counterBids.map((counterBid) => (
                      <TableRow 
                        key={counterBid.id}
                        sx={{
                          backgroundColor: 'rgba(25, 118, 210, 0.02)',
                          '&:hover': {
                            backgroundColor: 'rgba(25, 118, 210, 0.08)',
                          },
                        }}
                      >
                        <TableCell>{counterBid.userEmail}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {counterBid.cost} руб.
                            {counterBid.cost !== bet.cost && (
                              <Typography 
                                variant="caption" 
                                color={counterBid.cost < bet.cost ? "success.main" : "error.main"}
                                sx={{ ml: 1 }}
                              >
                                ({counterBid.cost < bet.cost ? '-' : '+'}
                                {Math.abs(counterBid.cost - bet.cost)} руб.)
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {counterBid.deliveryDays} дн.
                            {counterBid.deliveryDays !== bet.deliveryDays && (
                              <Typography 
                                variant="caption" 
                                color={counterBid.deliveryDays < bet.deliveryDays ? "success.main" : "error.main"}
                                sx={{ ml: 1 }}
                              >
                                ({counterBid.deliveryDays < bet.deliveryDays ? '-' : '+'}
                                {Math.abs(counterBid.deliveryDays - bet.deliveryDays)} дн.)
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {new Date(counterBid.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const LogisticianDashboard = () => {
  const [routes, setRoutes] = useState([]);
  const [bets, setBets] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [cost, setCost] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [error, setError] = useState('');
  const { logout } = useAuth();

  useEffect(() => {
    fetchRoutes();
    fetchBets();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await axios.get('/api/routes');
      setRoutes(response.data);
    } catch (error) {
      setError('Ошибка при загрузке маршрутов');
    }
  };

  const fetchBets = async () => {
    try {
      const response = await axios.get('/api/bets');
      // Group counter bids with their original bets
      const betsWithCounterBids = response.data.filter(bet => !bet.isCounterBid);
      betsWithCounterBids.forEach(bet => {
        bet.counterBids = response.data.filter(
          counterBid => counterBid.isCounterBid && counterBid.originalBetId === bet.id
        );
      });
      setBets(betsWithCounterBids);
    } catch (error) {
      setError('Ошибка при загрузке ставок');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/bets', {
        route: selectedRoute,
        transportType: 'train',
        cost: parseFloat(cost),
        deliveryDays: parseInt(deliveryDays),
      });
      fetchBets();
      setSelectedRoute('');
      setCost('');
      setDeliveryDays('');
    } catch (error) {
      setError('Ошибка при создании ставки');
    }
  };

  return (
    <Container>
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Панель логиста
        </Typography>
        <Button
          variant="outlined"
          color="secondary"
          onClick={logout}
          sx={{ position: 'absolute', top: 20, right: 20 }}
        >
          Выйти
        </Button>
      </Box>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Создать новую ставку
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Маршрут</InputLabel>
            <Select
              value={selectedRoute}
              label="Маршрут"
              onChange={(e) => setSelectedRoute(e.target.value)}
              required
            >
              {routes.map((route, index) => (
                <MenuItem key={index} value={`${route.from} – ${route.to}`}>
                  {route.from} – {route.to}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Стоимость (руб.)"
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Срок доставки (дней)"
            type="number"
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <Button type="submit" variant="contained" fullWidth>
            Создать ставку
          </Button>
        </Box>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Мои ставки и встречные предложения
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Маршрут</TableCell>
                <TableCell>Тип транспорта</TableCell>
                <TableCell>Стоимость (руб.)</TableCell>
                <TableCell>Срок доставки (дней)</TableCell>
                <TableCell>Дата создания</TableCell>
                <TableCell>Статус</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bets.map((bet) => (
                <BetRow key={bet.id} bet={bet} counterBids={bet.counterBids} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default LogisticianDashboard;
