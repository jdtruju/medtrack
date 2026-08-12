import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest } from '../../lib/api';

export function RegisterPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);

    try {
      const response = await apiRequest<{ message: string }>('/api/auth/register', {
        method: 'POST',
        body: {
          nombre: form.get('nombre'),
          apellido: form.get('apellido'),
          email: form.get('email'),
          telefono: form.get('telefono'),
          password: form.get('password'),
        },
      });
      formElement.reset();
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Registro de paciente" subtitle="Cree su cuenta para solicitar citas medicas.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="nombre" name="nombre" label="Nombre" required />
        <FormField id="apellido" name="apellido" label="Apellido" required />
        <FormField id="email" name="email" type="email" label="Correo electronico" required />
        <FormField id="telefono" name="telefono" label="Telefono" />
        <FormField id="password" name="password" type="password" label="Contrasena" required minLength={8} />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Registrarme
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Ya tiene cuenta?{' '}
        <Link className="font-semibold text-teal-700 hover:text-teal-900" to="/login">
          Iniciar sesion
        </Link>
      </p>
    </AuthLayout>
  );
}
