import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface Specialty {
  id: string;
  nombre: string;
}

interface CreatedDoctor {
  nombre: string;
  apellido: string;
  email: string;
  licencia: string;
  especialidad: string;
}

export function DoctorsPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [createdDoctors, setCreatedDoctors] = useState<CreatedDoctor[]>([]);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    apiRequest<{ especialidades: Specialty[] }>('/api/especialidades')
      .then((response) => setSpecialties(response.especialidades))
      .catch(() => setSpecialties([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);
    const { token } = getSession();
    const selectedSpecialtyId = String(form.get('especialidadId') ?? '');
    const selectedSpecialty = specialties.find((item) => item.id === selectedSpecialtyId);

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
          especialidadId: selectedSpecialtyId,
        },
      });

      setCreatedDoctors((current) => [
        {
          nombre: String(form.get('nombre') ?? ''),
          apellido: String(form.get('apellido') ?? ''),
          email: String(form.get('email') ?? ''),
          licencia: String(form.get('licencia') ?? ''),
          especialidad: selectedSpecialty?.nombre ?? 'Sin especialidad',
        },
        ...current,
      ]);
      formElement.reset();
      setStatus({ tone: 'success', message: response.message });
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
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Seleccione una especialidad</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.nombre}
                  </option>
                ))}
              </select>
            </label>

            {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
            <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
              Registrar medico
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
            {createdDoctors.length ? (
              <div className="space-y-3">
                {createdDoctors.map((doctor) => (
                  <article key={`${doctor.email}-${doctor.licencia}`} className="rounded-md border border-slate-200 p-3">
                    <p className="font-semibold">
                      {doctor.nombre} {doctor.apellido}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{doctor.especialidad}</p>
                    <p className="mt-1 text-xs text-slate-500">{doctor.email}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Aun no hay medicos registrados en esta sesion.</p>
            )}
          </WorkPanel>
        </div>
      </div>
    </AppShell>
  );
}
