import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

function MedicalIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-14 w-14"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="30" fill="white" fillOpacity="0.08" />
      <path
        d="M32 15c-4.5-6-13-6-16 0-3.5 6.5.5 12.5 16 24 15.5-11.5 19.5-17.5 16-24-3-6-11.5-6-16 0Z"
        fill="white"
        fillOpacity="0.16"
        stroke="white"
        strokeWidth="1.5"
      />
      <path
        d="M12 33h7l3-7 4 14 3-9 2 5h9"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AuthLayout({
  title,
  subtitle,
  eyebrow = 'Gestión de Citas Médicas',
  children,
}: PropsWithChildren<AuthLayoutProps>) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_440px]">
        <aside className="flex flex-col justify-between bg-teal-800 p-8 text-white">
          <div>
            <Link to="/login" className="text-lg font-semibold">
              MedTrack
            </Link>
            <MedicalIcon />
            <p className="mt-6 text-sm font-semibold text-teal-100">{eyebrow}</p>
            <h2 className="mt-3 max-w-xl text-4xl font-semibold leading-tight">
              Control seguro para pacientes, accesos y médicos.
            </h2>
            <div className="mt-8 grid gap-3 text-sm text-teal-50 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border border-teal-500/40 bg-teal-700/50 p-4">
                <p className="font-semibold">Cuentas protegidas</p>
                <p className="mt-1 text-teal-100">
                  Autenticación real con Supabase y bloqueo tras 5 intentos fallidos.
                </p>
              </div>
              <div className="rounded-lg border border-teal-500/40 bg-teal-700/50 p-4">
                <p className="font-semibold">Citas sin conflictos</p>
                <p className="mt-1 text-teal-100">
                  Reserva protegida contra doble agenda, con notificaciones automáticas.
                </p>
              </div>
            </div>
          </div>
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