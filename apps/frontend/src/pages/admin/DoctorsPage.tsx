import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, Especialidad, getSession, Medico } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

export function DoctorsPage() {
  const [specialties, setSpecialties] = useState<Especialidad[]>([]);
  const [doctors, setDoctors] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function fetchData() {
    const { token } = getSession();
    const [especialidadesRes, medicosRes] = await Promise.all([
      apiRequest<{ especialidades: Especialidad[] }>('/api/especialidades', { token }),
      apiRequest<{ medicos: Medico[] }>('/api/medicos', { token }),
    ]);
    setSpecialties(especialidadesRes.especialidades);
    setDoctors(medicosRes.medicos);
  }

  useEffect(() => {
    fetchData()
      .catch(() => {
        setSpecialties([]);
        setDoctors([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);
    const { token } = getSession();
    const especialidadId = String(form.get('especialidadId') ?? '');

    try {
      const response = await apiRequest<{ message: string }>('/api/medicos', {
        method: 'POST',
        token,
        body: {
          nombre: form.get('nombre'),
          apellido: form.get('apellido'),
          email: form.get('email'),
          telefono: form.get('telefono'),
          licencia: form.get('licencia'),
          especialidadId,
        },
      });

      formElement.reset();
      setStatus({ tone: 'success', message: response.message });
      await fetchData();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AppShell title="Medicos" subtitle="Registro administrativo de profesionales y especialidades." navItems={adminNavItems}>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <WorkPanel title="Registrar medico">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="nombre" name="nombre" label="Nombre" required />
              <FormField id="apellido" name="apellido" label="Apellido" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="email" name="email" type="email" label="Correo electronico" required />
              <FormField id="telefono" name="telefono" label="Telefono" />
            </div>
            <FormField id="licencia" name="licencia" label="Numero de licencia" required />

            <label className="block text-sm font-semibold text-slate-700" htmlFor="especialidadId">
              Especialidad
              <select
                id="especialidadId"
                name="especialidadId"
                required
                disabled={loading || !specialties.length}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="">
                  {loading ? 'Cargando especialidades...' : specialties.length ? 'Seleccione una especialidad' : 'Primero cree una especialidad'}
                </option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.nombre}
                  </option>
                ))}
              </select>
            </label>

            {!loading && !specialties.length ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                No hay especialidades disponibles.{' '}
                <Link className="font-semibold underline" to="/admin/specialties">
                  Crear especialidad
                </Link>
              </div>
            ) : null}
            {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
            <button
              className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
              disabled={loading || !specialties.length}
            >
              {loading ? 'Cargando...' : 'Registrar medico'}
            </button>
          </form>
        </WorkPanel>

        <div className="grid gap-5">
          <WorkPanel title="Especialidades disponibles">
            <div className="flex flex-wrap gap-2">
              {specialties.map((specialty) => (
                <span key={specialty.id} className="rounded-md bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
                  {specialty.nombre}
                </span>
              ))}
            </div>
          </WorkPanel>

          <WorkPanel title="Registros recientes">
            {doctors.length ? (
              <div className="space-y-3">
                {doctors.map((doctor) => (
                  <article key={`${doctor.email}-${doctor.licencia}`} className="rounded-md border border-slate-200 p-3">
                    <p className="font-semibold">
                      {doctor.nombre} {doctor.apellido}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {specialties.find((item) => item.id === doctor.especialidadId)?.nombre ?? 'Especialidad pendiente'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {doctor.email} · Lic. {doctor.licencia}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Aun no hay medicos registrados.</p>
            )}
          </WorkPanel>
        </div>
      </div>
    </AppShell>
  );
}
