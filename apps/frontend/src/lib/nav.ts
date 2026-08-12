export interface NavItem {
  label: string;
  to: string;
}

export const adminNavItems: NavItem[] = [
  { label: 'Panel', to: '/admin/dashboard' },
  { label: 'Medicos', to: '/admin/doctors' },
  { label: 'Horarios', to: '/admin/schedules' },
  { label: 'Especialidades', to: '/admin/specialties' },
  { label: 'Notificaciones', to: '/admin/notifications' },
  { label: 'Reportes', to: '/admin/reports' },
];

export const patientNavItems: NavItem[] = [
  { label: 'Panel', to: '/patient/dashboard' },
  { label: 'Disponibilidad', to: '/patient/availability' },
  { label: 'Mis citas', to: '/patient/appointments' },
];
