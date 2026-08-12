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

export interface Especialidad {
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface Medico {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  licencia: string;
  especialidadId: string;
}

export interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export interface Cita {
  id: string;
  pacienteId: string;
  pacienteEmail: string;
  medicoId: string;
  horarioId: string;
  fecha: string;
  horaInicio: string;
  estado: 'RESERVADA' | 'CANCELADA';
  motivoCancelacion?: string;
  recordatorioEnviado: boolean;
}

export interface Notificacion {
  id: string;
  usuarioId: string;
  email: string;
  tipo: 'CONFIRMACION_RESERVA' | 'RECORDATORIO_24H' | 'CANCELACION_CITA';
  citaId: string;
  enviadoEn: string;
  detalle?: string;
}

export const diasSemana: Record<string, string> = {
  LUN: 'Lunes',
  MAR: 'Martes',
  MIE: 'Miercoles',
  JUE: 'Jueves',
  VIE: 'Viernes',
  SAB: 'Sabado',
  DOM: 'Domingo',
};

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
