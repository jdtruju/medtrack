import type { PropsWithChildren } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
}

interface AppShellProps {
  title: string;
  subtitle: string;
  navItems: NavItem[];
}

export function AppShell({ title, subtitle, navItems, children }: PropsWithChildren<AppShellProps>) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to={user?.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard'} className="text-sm font-semibold text-teal-700">
              MedTrack
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user ? `${user.nombre} ${user.apellido}` : 'Sesion activa'}</p>
              <p className="text-xs text-slate-500">{user?.rol ?? 'USUARIO'}</p>
            </div>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={handleLogout}
              type="button"
            >
              Salir
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-4">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-6">{children}</section>
    </main>
  );
}

export function StatGrid({ stats }: { stats: Array<{ label: string; value: string; detail: string }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">{stat.label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</p>
          <p className="mt-1 text-sm text-slate-500">{stat.detail}</p>
        </article>
      ))}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

export function WorkPanel({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
