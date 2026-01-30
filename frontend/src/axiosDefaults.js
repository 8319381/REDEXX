import axios from "axios";

// чтобы браузер отправлял httpOnly cookie на /api/*
axios.defaults.withCredentials = true;
