import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthTokenResponse>('/auth/login', {
    email,
    password,
  });
  return data;
}

export async function register(
  email: string,
  password: string,
  role: 'teacher' | 'student',
) {
  const { data } = await api.post<AuthTokenResponse>('/auth/register', {
    email,
    password,
    role,
  });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}
