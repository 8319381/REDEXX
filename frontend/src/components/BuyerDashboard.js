import React, { useState, useEffect, useCallback } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  IconButton,
  Grid,
  Autocomplete,
  Chip,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const fmtDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("ru-RU");
};

const BuyerDashboard = () => {
  const { logout } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Состояния для формы заявки
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  
  // Данные формы заявки
  const [cargoReadyDate, setCargoReadyDate] = useState('');
  const [originLocation, setOriginLocation] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationLocation, setDestinationLocation] = useState('');
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [containerTypeCode, setContainerTypeCode] = useState('');
  const [incotermCode, setIncotermCode] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoVolume, setCargoVolume] = useState('');
  const [cargoTypeCode, setCargoTypeCode] = useState('');
  const [desiredDeliveryDays, setDesiredDeliveryDays] = useState('');
  const [preferredTransportCode, setPreferredTransportCode] = useState('');
  const [cargoValue, setCargoValue] = useState('');
  const [comment, setComment] = useState('');
  
  // Справочники
  const [containerTypes, setContainerTypes] = useState([]);
  const [incoterms, setIncoterms] = useState([]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [transportTypes, setTransportTypes] = useState([]);
  
  // Список заявок
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Загрузка справочников
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        const [containerRes, incotermRes, cargoRes, transportRes] = await Promise.all([
          axios.get('/api/container-types'),
          axios.get('/api/incoterms'),
          axios.get('/api/cargo-types'),
          axios.get('/api/transport-types'),
        ]);
        
        // Обработка типов контейнеров (может быть массив объектов или строк)
        const containerTypesData = containerRes.data.map(item => {
          if (typeof item === 'string') {
            return { code: item, name: item };
          }
          return { code: item.code, name: item.name || item.code };
        });
        setContainerTypes(containerTypesData);
        
        setIncoterms(incotermRes.data || []);
        setCargoTypes(cargoRes.data || []);
        setTransportTypes(transportRes.data || []);
        
        if (containerTypesData.length > 0) {
          setContainerTypeCode(containerTypesData[0].code);
        }
      } catch (err) {
        console.error('Error loading dictionaries:', err);
        setError('Ошибка при загрузке справочников');
      }
    };
    
    loadDictionaries();
    fetchRequests();
  }, []);

  // Поиск локаций через DaData
  const searchLocations = async (query, setSuggestions) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await axios.get('/api/validate-location', { params: { q: query } });
      if (response.data.suggestions) {
        setSuggestions(response.data.suggestions);
      }
    } catch (err) {
      console.error('Location search error:', err);
    }
  };

  // Загрузка заявок
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/requests');
      setRequests(response.data);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Ошибка при загрузке заявок');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          runId:'initial',
          hypothesisId:'H9',
          location:'BuyerDashboard.js:132',
          message:'GET /api/requests error',
          data:{
            name:err.name,
            message:err.message,
            responseStatus:err.response?.status||null,
            responseMessage:err.response?.data?.message||null
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion
    } finally {
      setLoading(false);
    }
  };

  // Открытие формы создания/редактирования
  const handleOpenRequestForm = (request = null) => {
    if (request) {
      setEditingRequest(request);
      setCargoReadyDate(request.cargo_ready_date || '');
      setOriginLocation(request.origin_location || '');
      setDestinationLocation(request.destination_location || '');
      setContainerTypeCode(request.container_type_code || '');
      setIncotermCode(request.incoterm_code || '');
      setCargoWeight(request.cargo_weight || '');
      setCargoVolume(request.cargo_volume || '');
      setCargoTypeCode(request.cargo_type_code || '');
      setDesiredDeliveryDays(request.desired_delivery_days || '');
      setPreferredTransportCode(request.preferred_transport_code || '');
      setCargoValue(request.cargo_value || '');
      setComment(request.comment || '');
    } else {
      resetForm();
    }
    setIsRequestDialogOpen(true);
  };

  // Сброс формы
  const resetForm = () => {
    setEditingRequest(null);
    setCargoReadyDate('');
    setOriginLocation('');
    setDestinationLocation('');
    setContainerTypeCode(containerTypes.length > 0 ? containerTypes[0].code : '');
    setIncotermCode('');
    setCargoWeight('');
    setCargoVolume('');
    setCargoTypeCode('');
    setDesiredDeliveryDays('');
    setPreferredTransportCode('');
    setCargoValue('');
    setComment('');
    setOriginSuggestions([]);
    setDestinationSuggestions([]);
  };

  // Закрытие формы
  const handleCloseRequestForm = () => {
    setIsRequestDialogOpen(false);
    resetForm();
  };

  // Сохранение заявки
  const handleSaveRequest = async (isFromCollapse = false) => {
    try {
      setError('');
      setSuccess('');
      
      // Валидация обязательных полей
      if (!cargoReadyDate || !originLocation || !destinationLocation || !containerTypeCode || !incotermCode) {
        setError('Заполните все обязательные поля');
        return;
      }

      const requestData = {
        cargo_ready_date: cargoReadyDate,
        origin_location: originLocation,
        destination_location: destinationLocation,
        container_type_code: containerTypeCode,
        incoterm_code: incotermCode,
        cargo_weight: cargoWeight ? parseFloat(cargoWeight) : null,
        cargo_volume: cargoVolume ? parseFloat(cargoVolume) : null,
        cargo_type_code: cargoTypeCode || null,
        desired_delivery_days: desiredDeliveryDays ? parseInt(desiredDeliveryDays) : null,
        preferred_transport_code: preferredTransportCode || null,
        cargo_value: cargoValue ? parseFloat(cargoValue) : null,
        comment: comment || null,
      };

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          runId:'initial',
          hypothesisId:'H10',
          location:'BuyerDashboard.js:204',
          message: editingRequest ? 'PUT /api/requests payload' : 'POST /api/requests payload',
          data:{
            hasEditingRequest:!!editingRequest,
            cargo_ready_date:cargoReadyDate,
            origin_location:originLocation,
            destination_location:destinationLocation,
            container_type_code:containerTypeCode,
            incoterm_code:incotermCode
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion

      if (editingRequest) {
        await axios.put(`/api/requests/${editingRequest.id}`, requestData);
        setSuccess('Заявка успешно обновлена');
        handleCloseRequestForm();
      } else {
        await axios.post('/api/requests', requestData);
        setSuccess('Заявка успешно создана');
        if (isFromCollapse) {
          resetForm();
          setShowRequestForm(false);
        } else {
          handleCloseRequestForm();
        }
      }
      
      fetchRequests();
      
      // Очистка сообщения об успехе через 3 секунды
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving request:', err);
      setError(err.response?.data?.message || 'Ошибка при сохранении заявки');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/be7a3e2f-42d0-4b31-b834-acdb399d6ea7',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          runId:'initial',
          hypothesisId:'H11',
          location:'BuyerDashboard.js:238',
          message:'Error saving request',
          data:{
            name:err.name,
            message:err.message,
            responseStatus:err.response?.status||null,
            responseMessage:err.response?.data?.message||null
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion
    }
  };

  // Удаление заявки
  const handleDeleteRequest = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту заявку?')) {
      return;
    }
    try {
      await axios.delete(`/api/requests/${id}`);
      setSuccess('Заявка успешно удалена');
      fetchRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting request:', err);
      setError('Ошибка при удалении заявки');
    }
  };

  return (
    <Container>
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Панель покупателя
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Форма создания заявки */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Создание заявки на перевозку</Typography>
          <Button 
            variant="outlined" 
            onClick={() => setShowRequestForm(!showRequestForm)}
            size="small"
            startIcon={showRequestForm ? null : <AddIcon />}
          >
            {showRequestForm ? 'Скрыть' : 'Создать заявку'}
          </Button>
        </Box>
        
        <Collapse in={showRequestForm}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Обязательные поля */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
                Обязательные поля
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Дата готовности груза *"
                type="date"
                value={cargoReadyDate}
                onChange={(e) => setCargoReadyDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={originSuggestions}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.value || ''}
                value={originLocation}
                onInputChange={(event, newInputValue) => {
                  setOriginLocation(newInputValue);
                  searchLocations(newInputValue, setOriginSuggestions);
                }}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setOriginLocation(typeof newValue === 'string' ? newValue : newValue.value);
                  }
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Пункт отправки *" required />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">{typeof option === 'string' ? option : option.value}</Typography>
                      {typeof option !== 'string' && option.region && (
                        <Typography variant="caption" color="text.secondary">
                          {option.region}, {option.country}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={destinationSuggestions}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.value || ''}
                value={destinationLocation}
                onInputChange={(event, newInputValue) => {
                  setDestinationLocation(newInputValue);
                  searchLocations(newInputValue, setDestinationSuggestions);
                }}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setDestinationLocation(typeof newValue === 'string' ? newValue : newValue.value);
                  }
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Пункт назначения *" required />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">{typeof option === 'string' ? option : option.value}</Typography>
                      {typeof option !== 'string' && option.region && (
                        <Typography variant="caption" color="text.secondary">
                          {option.region}, {option.country}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Тип контейнера *</InputLabel>
                <Select
                  value={containerTypeCode}
                  label="Тип контейнера *"
                  onChange={(e) => setContainerTypeCode(e.target.value)}
                >
                  {containerTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name || type.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Правила Инкотермс *</InputLabel>
                <Select
                  value={incotermCode}
                  label="Правила Инкотермс *"
                  onChange={(e) => setIncotermCode(e.target.value)}
                >
                  {incoterms.map((term) => (
                    <MenuItem key={term.code} value={term.code}>
                      {term.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Вес груза (кг)"
                type="number"
                value={cargoWeight}
                onChange={(e) => setCargoWeight(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            {/* Опциональные поля */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                Опциональные поля
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Объем (м³)"
                type="number"
                value={cargoVolume}
                onChange={(e) => setCargoVolume(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Тип груза</InputLabel>
                <Select
                  value={cargoTypeCode}
                  label="Тип груза"
                  onChange={(e) => setCargoTypeCode(e.target.value)}
                >
                  <MenuItem value="">Не указано</MenuItem>
                  {cargoTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Желаемый срок поставки (дней)"
                type="number"
                value={desiredDeliveryDays}
                onChange={(e) => setDesiredDeliveryDays(e.target.value)}
                fullWidth
                inputProps={{ min: 1 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Предпочитаемый вид транспорта</InputLabel>
                <Select
                  value={preferredTransportCode}
                  label="Предпочитаемый вид транспорта"
                  onChange={(e) => setPreferredTransportCode(e.target.value)}
                >
                  <MenuItem value="">Не указано</MenuItem>
                  {transportTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Стоимость груза (руб.)"
                type="number"
                value={cargoValue}
                onChange={(e) => setCargoValue(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Дополнительный комментарий"
                multiline
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleSaveRequest}
                fullWidth
                size="large"
              >
                Создать заявку
              </Button>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>
      
      {/* Список заявок */}
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Мои заявки
        </Typography>
        
        {loading ? (
          <Typography>Загрузка...</Typography>
        ) : requests.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            У вас пока нет заявок. Создайте первую заявку выше.
          </Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Дата готовности</TableCell>
                  <TableCell>Маршрут</TableCell>
                  <TableCell>Контейнер</TableCell>
                  <TableCell>Инкотермс</TableCell>
                  <TableCell>Вес</TableCell>
                  <TableCell>Тип груза</TableCell>
                  <TableCell>Транспорт</TableCell>
                  <TableCell>Дата создания</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{fmtDate(request.cargo_ready_date)}</TableCell>
                    <TableCell>
                      {request.origin_location} → {request.destination_location}
                    </TableCell>
                    <TableCell>{request.container_type_name || request.container_type_code}</TableCell>
                    <TableCell>{request.incoterm_name || request.incoterm_code}</TableCell>
                    <TableCell>
                      {request.cargo_weight ? `${request.cargo_weight} кг` : '-'}
                    </TableCell>
                    <TableCell>{request.cargo_type_name || '-'}</TableCell>
                    <TableCell>{request.transport_type_name || '-'}</TableCell>
                    <TableCell>{fmtDate(request.created_at)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={request.status === 'active' ? 'Активна' : request.status === 'completed' ? 'Завершена' : 'Отменена'}
                        color={request.status === 'active' ? 'success' : request.status === 'completed' ? 'default' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenRequestForm(request)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteRequest(request.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Диалог редактирования заявки */}
      <Dialog open={isRequestDialogOpen} onClose={handleCloseRequestForm} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRequest ? 'Редактирование заявки' : 'Создание заявки'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Дата готовности груза *"
                type="date"
                value={cargoReadyDate}
                onChange={(e) => setCargoReadyDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={originSuggestions}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.value || ''}
                value={originLocation}
                onInputChange={(event, newInputValue) => {
                  setOriginLocation(newInputValue);
                  searchLocations(newInputValue, setOriginSuggestions);
                }}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setOriginLocation(typeof newValue === 'string' ? newValue : newValue.value);
                  }
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Пункт отправки *" required />
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={destinationSuggestions}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.value || ''}
                value={destinationLocation}
                onInputChange={(event, newInputValue) => {
                  setDestinationLocation(newInputValue);
                  searchLocations(newInputValue, setDestinationSuggestions);
                }}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setDestinationLocation(typeof newValue === 'string' ? newValue : newValue.value);
                  }
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Пункт назначения *" required />
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Тип контейнера *</InputLabel>
                <Select
                  value={containerTypeCode}
                  label="Тип контейнера *"
                  onChange={(e) => setContainerTypeCode(e.target.value)}
                >
                  {containerTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name || type.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Правила Инкотермс *</InputLabel>
                <Select
                  value={incotermCode}
                  label="Правила Инкотермс *"
                  onChange={(e) => setIncotermCode(e.target.value)}
                >
                  {incoterms.map((term) => (
                    <MenuItem key={term.code} value={term.code}>
                      {term.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Вес груза (кг)"
                type="number"
                value={cargoWeight}
                onChange={(e) => setCargoWeight(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Объем (м³)"
                type="number"
                value={cargoVolume}
                onChange={(e) => setCargoVolume(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Тип груза</InputLabel>
                <Select
                  value={cargoTypeCode}
                  label="Тип груза"
                  onChange={(e) => setCargoTypeCode(e.target.value)}
                >
                  <MenuItem value="">Не указано</MenuItem>
                  {cargoTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Желаемый срок поставки (дней)"
                type="number"
                value={desiredDeliveryDays}
                onChange={(e) => setDesiredDeliveryDays(e.target.value)}
                fullWidth
                inputProps={{ min: 1 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Предпочитаемый вид транспорта</InputLabel>
                <Select
                  value={preferredTransportCode}
                  label="Предпочитаемый вид транспорта"
                  onChange={(e) => setPreferredTransportCode(e.target.value)}
                >
                  <MenuItem value="">Не указано</MenuItem>
                  {transportTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Стоимость груза (руб.)"
                type="number"
                value={cargoValue}
                onChange={(e) => setCargoValue(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Дополнительный комментарий"
                multiline
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRequestForm}>Отмена</Button>
          <Button onClick={() => handleSaveRequest(false)} variant="contained">
            {editingRequest ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BuyerDashboard;
