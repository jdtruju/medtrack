const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo completar la solicitud.');
  }

  return data as T;
}

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'PACIENTE' | 'ADMIN';
}

export function saveSession(token: string, user: SessionUser): void {
  localStorage.setItem('medtrack.token', token);
  localStorage.setItem('medtrack.user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('medtrack.token');
  localStorage.removeItem('medtrack.user');
}

export function getSession(): { token: string | null; user: SessionUser | null } {
  const token = localStorage.getItem('medtrack.token');
  const rawUser = localStorage.getItem('medtrack.user');
  return {
    token,
    user: rawUser ? (JSON.parse(rawUser) as SessionUser) : null,
  };
}
