import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

export function RegisterPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);
    const nombre = String(form.get('nombre') ?? '').trim();

    if (!nombre) {
      setStatus({ tone: 'error', message: 'El nombre es un campo obligatorio.' });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      options: {
        data: {
          nombre,
          apellido: String(form.get('apellido') ?? ''),
          telefono: String(form.get('telefono') ?? ''),
        },
      },
    });

    if (error) {
      const message = error.message.toLowerCase().includes('already registered')
        ? 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.'
        : error.message;
      setStatus({ tone: 'error', message });
      return;
    }

    formElement.reset();
    setStatus({ tone: 'success', message: 'Cuenta creada exitosamente. Bienvenido a MedTrack.' });
  }

  return (
    <AuthLayout title="Registro de paciente" subtitle="Cree su cuenta para solicitar citas medicas.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="nombre" name="nombre" label="Nombre" />
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
