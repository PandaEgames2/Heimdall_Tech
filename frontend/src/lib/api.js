const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000/api`;

let accessToken = '';
let refreshPromise = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || '';
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const apiErrorMessage = (payload, fallback) => {
  const body = payload?.message ?? payload;
  if (typeof body === 'string') return body;
  if (body?.detail) return body.detail;
  if (Array.isArray(body?.non_field_errors)) return body.non_field_errors[0];
  if (body && typeof body === 'object') {
    const firstValue = Object.values(body).flat(2).find((value) => typeof value === 'string');
    if (firstValue) return firstValue;
  }
  return fallback;
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await window.fetch(`${API_BASE_URL}/identidad/auth/refresh/`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!response.ok) {
          setAccessToken('');
          return false;
        }
        const payload = await parseResponse(response);
        setAccessToken(payload.access);
        return Boolean(payload.access);
      } catch {
        setAccessToken('');
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

export const apiRequest = async (input, options = {}, retry = true) => {
  const url = input.startsWith('http') ? input : `${API_BASE_URL}${input}`;
  const headers = { ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await window.fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry && !url.includes('/auth/')) {
    const renewed = await refreshAccessToken();
    if (renewed) return apiRequest(input, options, false);
  }

  return response;
};

export const apiFetch = async (path, options = {}) => {
  const response = await apiRequest(path, options);
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(apiErrorMessage(payload, 'Error de API'));
  return payload;
};

export const loginRequest = async (username, password) => {
  const response = await apiRequest(
    '/identidad/auth/login/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    false,
  );
  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, 'Credenciales inválidas'));
  }
  setAccessToken(payload.access);
  return payload;
};

export const refreshSession = async () => refreshAccessToken();

export const logoutRequest = async () => {
  try {
    await apiRequest('/identidad/auth/logout/', { method: 'POST' }, false);
  } catch {
    // El cierre local debe funcionar aunque el servidor no responda.
  } finally {
    setAccessToken('');
  }
};

export { API_BASE_URL };
