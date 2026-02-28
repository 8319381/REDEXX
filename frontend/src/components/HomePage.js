import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button,
  TextField,
  AppBar,
  Toolbar,
  Link,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// Using standard TextField for date input instead of DatePicker

// Styled components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#2c3e50',
}));

const StyledContainer = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
}));

const RouteCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[8],
  },
}));

const HomePage = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [containerType, setContainerType] = useState('20\'');
  const [departureDate, setDepartureDate] = useState(null);
  const [bestOffers, setBestOffers] = useState([]);
  const [containerTypes, setContainerTypes] = useState([]);
  
  // Extract unique cities from routes
  const [cities, setCities] = useState([]);
  
  // Helper function to get unique cities from routes
  const extractCities = (routesData) => {
    const uniqueCities = new Set();
    routesData.forEach(route => {
      uniqueCities.add(route.from);
      uniqueCities.add(route.to);
    });
    return Array.from(uniqueCities).sort();
  };

  useEffect(() => {
    // Fetch data from the API
    const fetchData = async () => {
      try {
        // Fetch routes
        const routesResponse = await axios.get('/api/routes');
        setRoutes(routesResponse.data);
        
        // Extract and set cities from routes
        const citiesList = extractCities(routesResponse.data);
        setCities(citiesList);
        
        // Fetch container types
        const containerTypesResponse = await axios.get('/api/container-types');
        setContainerTypes(containerTypesResponse.data);
        if (containerTypesResponse.data.length > 0) {
          setContainerType(containerTypesResponse.data[0]?.code || "");
        }
        
        // Fetch best offers (optional endpoint)
          try {
          // best-offers disabled
          setBestOffers([]);
} catch (e) {
            setBestOffers([]);
          }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleSearch = () => {
    // In a real app, this would search for routes matching the criteria
    // For now, we'll just navigate to the login page
    navigate('/login');
  };

  const handleOfferClick = (offer) => {
    // In a real app, this would navigate to a details page for the offer
    // For now, we'll just navigate to the login page
    navigate('/login');
  };

  return (
    <>
      <StyledAppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Logistics Exchange
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Link color="inherit" href="/login" underline="none">
              Вход
            </Link>
            <Link color="inherit" href="/register" underline="none">
              Регистрация
            </Link>
          </Box>
        </Toolbar>
      </StyledAppBar>

      <StyledContainer>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Контейнерная логистика онлайн
          </Typography>
          <Typography variant="h5" component="h2" color="primary" gutterBottom>
            быстро, просто, достоверно
          </Typography>
        </Box>

        <StyledPaper elevation={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <FormControl fullWidth>
                <InputLabel>Место отправки</InputLabel>
                <Select
                  value={fromLocation}
                  label="Место отправки"
                  onChange={(e) => setFromLocation(e.target.value)}
                >
                  {cities.map((city) => (
                    <MenuItem key={`from-${city}`} value={city}>{city}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={5}>
              <FormControl fullWidth>
                <InputLabel>Место доставки</InputLabel>
                <Select
                  value={toLocation}
                  label="Место доставки"
                  onChange={(e) => setToLocation(e.target.value)}
                >
                  {cities.map((city) => (
                    <MenuItem key={`to-${city}`} value={city}>{city}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Оборудование</InputLabel>
                <Select
                  value={containerType}
                  label="Оборудование"
                  onChange={(e) => setContainerType(e.target.value)}
                >
                  {containerTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>{type.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Дата выхода"
                type="date"
                value={departureDate || ''}
                onChange={(e) => setDepartureDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Button 
                variant="contained" 
                color="primary" 
                fullWidth 
                size="large"
                onClick={handleSearch}
                sx={{ height: '56px' }}
              >
                Найти
              </Button>
            </Grid>
          </Grid>
        </StyledPaper>

        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            Лучшее предложение из Китая <span role="img" aria-label="China flag">🇨🇳</span>
          </Typography>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 3 }}>
            Доставка контейнера
          </Typography>

          <Grid container spacing={3}>
            {bestOffers.map((offer) => (
              <Grid item xs={12} sm={6} md={3} key={offer.id}>
                <RouteCard>
                  <CardContent>
                    <Typography variant="h6" component="div" gutterBottom>
                      {offer.from} - {offer.to}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Тип:
                      </Typography>
                      <Typography variant="body2">
                        {typeof offer.containerType === "string" ? offer.containerType : (offer.containerType?.name || offer.containerType?.code || "")}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Цена:
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {Number(offer.price || 0).toLocaleString()} р
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Срок:
                      </Typography>
                      <Typography variant="body2">
                        {offer.days} дней
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      color="primary" 
                      fullWidth
                      onClick={() => handleOfferClick(offer)}
                    >
                      Подробнее
                    </Button>
                  </CardActions>
                </RouteCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      </StyledContainer>
    </>
  );
};

export default HomePage;
