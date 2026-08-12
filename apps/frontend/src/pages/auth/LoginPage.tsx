import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

interface LoginLockStatus {
  bloqueado: boolean;
  bloqueado_hasta: string | null;
  intentos: number;
}

interface LoginAttemptResult {
  bloqueado: boolean;
  intentos: number;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    const { data: lock } = await supabase.rpc('check_login_lock', { p_email: email });
    const lockStatus = lock as LoginLockStatus | null;

    if (lockStatus?.bloqueado) {
      setStatus({ tone: 'error', message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const { data: attempt } = await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_exitoso: false,
      });
      const attemptResult = attempt as LoginAttemptResult | null;

      if (attemptResult?.bloqueado) {
        setStatus({ tone: 'error', message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' });
      } else {
        setStatus({
          tone: 'error',
          message: `Correo o contraseña incorrectos. Intento ${attemptResult?.intentos ?? 1} de 5.`,
        });
      }
      return;
    }

    await supabase.rpc('record_login_attempt', { p_email: email, p_exitoso: true });

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', data.user!.id)
      .single();

    setStatus({ tone: 'success', message: 'Inicio de sesion exitoso.' });
    navigate(perfil?.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard');
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
