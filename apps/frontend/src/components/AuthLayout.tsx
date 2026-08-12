import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

export function AuthLayout({ title, subtitle, eyebrow = 'Fase 1 - Gestion de Usuarios', children }: PropsWithChildren<AuthLayoutProps>) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_440px]">
        <aside className="flex flex-col justify-between bg-teal-800 p-8 text-white">
          <div>
            <Link to="/login" className="text-lg font-semibold">
              MedTrack
            </Link>
            <p className="mt-12 text-sm font-semibold text-teal-100">{eyebrow}</p>
            <h2 className="mt-3 max-w-xl text-4xl font-semibold leading-tight">
              Control seguro para pacientes, accesos y medicos.
            </h2>
            <div className="mt-8 grid gap-3 text-sm text-teal-50 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border border-teal-500/40 bg-teal-700/50 p-4">
                <p className="font-semibold">Cuentas protegidas</p>
                <p className="mt-1 text-teal-100">Validacion, bloqueo temporal y JWT.</p>
              </div>
              <div className="rounded-lg border border-teal-500/40 bg-teal-700/50 p-4">
                <p className="font-semibold">Supabase activo</p>
                <p className="mt-1 text-teal-100">Autenticacion y datos con respaldo real.</p>
              </div>
            </div>
          </div>
          <p className="mt-8 text-sm text-teal-100">Configure el primer admin desde Supabase SQL Editor.</p>
        </aside>

        <div className="flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <p className="text-sm font-semibold text-teal-700">MedTrack</p>
            <h1 className="mt-5 text-3xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
