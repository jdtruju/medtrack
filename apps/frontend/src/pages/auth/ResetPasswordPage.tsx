import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest } from '../../lib/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const accessToken =
    searchParams.get('access_token') ??
    searchParams.get('token') ??
    new URLSearchParams(window.location.hash.replace(/^#/, '')).get('access_token') ??
    '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: { accessToken, password: form.get('password') },
      });
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Nueva contrasena" subtitle="Defina una contrasena nueva para su cuenta.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="password" name="password" type="password" label="Nueva contrasena" required minLength={8} />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Actualizar contrasena
        </button>
      </form>
      <Link className="mt-5 inline-block text-sm font-semibold text-teal-700 hover:text-teal-900" to="/login">
        Volver al login
      </Link>
    </AuthLayout>
  );
}
