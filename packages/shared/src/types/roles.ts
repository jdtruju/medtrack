export type RolUsuario = 'PACIENTE' | 'ADMIN';

export type EstadoCita =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'REPROGRAMADA'
  | 'CANCELADA'
  | 'COMPLETADA';

export type DiaSemana = 'LUN' | 'MAR' | 'MIE' | 'JUE' | 'VIE' | 'SAB' | 'DOM';

export type TipoNotificacion =
  | 'CONFIRMACION'
  | 'RECORDATORIO'
  | 'CANCELACION'
  | 'REPROGRAMACION';

export type CanalNotificacion = 'EMAIL' | 'IN_APP';
