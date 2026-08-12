import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, Especialidad, getSession, Medico } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

export function SpecialtiesPage() {
  const [specialties, setSpecialties] = useState<Especialidad[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [editing, setEditing] = useState<Especialidad | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function fetchData() {
    const { token } = getSession();
    const [especialidadesRes, medicosRes] = await Promise.all([
      apiRequest<{ especialidades: Especialidad[] }>('/api/especialidades', { token }),
      apiRequest<{ medicos: Medico[] }>('/api/medicos', { token }),
    ]);
    setSpecialties(especialidadesRes.especialidades);
    setMedicos(medicosRes.medicos);
  }

  useEffect(() => {
    fetchData()
      .catch(() => {
        setSpecialties([]);
        setMedicos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { token } = getSession();
    const path = editing ? `/api/especialidades/${editing.id}` : '/api/especialidades';

    try {
      const response = await apiRequest<{ message: string }>(path, {
        method: editing ? 'PUT' : 'POST',
        token,
        body: {
          nombre: form.get('nombre'),
          descripcion: form.get('descripcion'),
        },
      });
      setStatus({ tone: 'success', message: response.message });
      setEditing(null);
      formElement.reset();
      await fetchData();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  async function handleDelete(id: string) {
    const { token } = getSession();
    try {
      const response = await apiRequest<{ message: string }>(`/api/especialidades/${id}`, { method: 'DELETE', token });
      setStatus({ tone: 'success', message: response.message });
      await fetchData();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  function countMedicos(especialidadId: string) {
    return medicos.filter((medico) => medico.especialidadId === especialidadId).length;
  }

  return (
    <AppShell title="Especialidades" subtitle="Gestiona el catalogo que alimenta medicos, horarios y citas." navItems={adminNavItems}>
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <WorkPanel title={editing ? 'Editar especialidad' : 'Crear especialidad'}>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="nombre">
              Nombre
              <input
                key={editing?.id ?? 'new-name'}
                id="nombre"
                name="nombre"
                required
                minLength={2}
                defaultValue={editing?.nombre ?? ''}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="descripcion">
              Descripcion
              <textarea
                key={editing?.id ?? 'new-description'}
                id="descripcion"
                name="descripcion"
                rows={4}
                defaultValue={editing?.descripcion ?? ''}
                className="mt-2 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              />
            </label>
            {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
                {editing ? 'Guardar cambios' : 'Crear especialidad'}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setEditing(null)}
                >
                  Cancelar edicion
                </button>
              ) : null}
            </div>
          </form>
        </WorkPanel>

        <WorkPanel title="Catalogo disponible">
          {loading ? (
            <p className="text-sm leading-6 text-slate-600">Cargando especialidades...</p>
          ) : specialties.length ? (
            <div className="grid gap-3">
              {specialties.map((specialty) => {
                const medicosCount = countMedicos(specialty.id);
                return (
                  <article key={specialty.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-semibold text-slate-950">{specialty.nombre}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {specialty.descripcion || 'Sin descripcion registrada.'}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-teal-800">{medicosCount} medicos asociados</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                          onClick={() => setEditing(specialty)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={medicosCount > 0}
                          onClick={() => handleDelete(specialty.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              No hay especialidades registradas. Crea una para habilitar el registro de medicos.
            </p>
          )}
        </WorkPanel>
      </div>
    </AppShell>
  );
}
