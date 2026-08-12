import { useEffect, useMemo, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession, Notificacion } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

const tipos = [
  { value: '', label: 'Todas' },
  { value: 'CONFIRMACION_RESERVA', label: 'Confirmaciones' },
  { value: 'RECORDATORIO_24H', label: 'Recordatorios 24h' },
  { value: 'CANCELACION_CITA', label: 'Cancelaciones' },
];

export function NotificationsPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ notificaciones: Notificacion[] }>('/api/notificaciones', { token })
      .then((response) => {
        setNotificaciones(response.notificaciones);
        setError('');
      })
      .catch((err) => {
        setNotificaciones([]);
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(
    () => notificaciones.filter((notificacion) => !tipo || notificacion.tipo === tipo),
    [notificaciones, tipo],
  );

  return (
    <AppShell title="Notificaciones" subtitle="Auditoria de correos enviados por reservas, recordatorios y cancelaciones." navItems={adminNavItems}>
      <WorkPanel title="Registro de envios">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="tipo">
            Tipo
            <select
              id="tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              className="mt-2 w-full min-w-56 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
            >
              {tipos.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {filtradas.length} de {notificaciones.length} registros
          </div>
        </div>

        {error ? <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

        {loading ? (
          <p className="text-sm text-slate-600">Cargando notificaciones...</p>
        ) : filtradas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Correo</th>
                  <th className="py-2 pr-4">Detalle</th>
                  <th className="py-2 pr-4">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((notificacion) => (
                  <tr key={notificacion.id}>
                    <td className="py-3 pr-4 font-semibold text-slate-950">{notificacion.tipo.replaceAll('_', ' ')}</td>
                    <td className="py-3 pr-4 text-slate-700">{notificacion.email}</td>
                    <td className="max-w-xl py-3 pr-4 text-slate-600">{notificacion.detalle ?? 'Sin detalle'}</td>
                    <td className="py-3 pr-4 text-slate-500">{new Date(notificacion.enviadoEn).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No hay notificaciones con este filtro.</p>
        )}
      </WorkPanel>
    </AppShell>
  );
}
