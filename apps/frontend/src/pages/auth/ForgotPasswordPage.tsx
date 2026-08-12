import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest } from '../../lib/api';

export function ForgotPasswordPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: form.get('email') },
      });
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Recuperar contrasena" subtitle="Le enviaremos un enlace temporal al correo registrado.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="email" name="email" type="email" label="Correo electronico" required />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Enviar enlace
        </button>
      </form>
      <Link className="mt-5 inline-block text-sm font-semibold text-teal-700 hover:text-teal-900" to="/login">
        Volver al login
      </Link>
    </AuthLayout>
  );
}
