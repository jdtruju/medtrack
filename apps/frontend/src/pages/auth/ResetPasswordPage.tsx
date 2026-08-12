import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

export function ResetPasswordPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus({ tone: 'error', message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' });
      return;
    }

    setStatus({ tone: 'success', message: 'Contraseña actualizada correctamente.' });
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
