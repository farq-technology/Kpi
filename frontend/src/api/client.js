import axios from 'axios';

const PROD_API = 'https://kpi-backend-zqfb.onrender.com';
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PROD_API : '');

const client = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default client;
export { API_BASE };
