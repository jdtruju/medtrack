import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { useAuth } from '../../context/AuthContext';
import { getSession } from '../../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);

    try {
      await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
      setStatus({ tone: 'success', message: 'Inicio de sesion exitoso.' });
      const { user } = getSession();
      navigate(user?.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard');
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Inicio de sesion" subtitle="Ingrese con sus credenciales de MedTrack.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="email" name="email" type="email" label="Correo electronico" required />
        <FormField id="password" name="password" type="password" label="Contrasena" required />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Ingresar
        </button>
      </form>
      <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:justify-between">
        <Link className="font-semibold text-teal-700 hover:text-teal-900" to="/register">
          Crear cuenta
        </Link>
        <Link className="font-semibold text-teal-700 hover:text-teal-900" to="/forgot-password">
          Recuperar contrasena
        </Link>
      </div>
    </AuthLayout>
  );
}
