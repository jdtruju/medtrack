import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DoctorsPage } from '../pages/admin/DoctorsPage';
import { NotificationsPage } from '../pages/admin/NotificationsPage';
import { SchedulesPage } from '../pages/admin/SchedulesPage';
import { SpecialtiesPage } from '../pages/admin/SpecialtiesPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AppointmentsPage } from '../pages/patient/AppointmentsPage';
import { AvailabilityPage } from '../pages/patient/AvailabilityPage';
import { PatientDashboardPage } from '../pages/patient/PatientDashboardPage';
import { ProtectedRoute } from './ProtectedRoute';

// Recharts y jsPDF solo los necesitan estas dos pantallas de admin — se cargan
// aparte para que pacientes y el resto de admin no las descarguen de arranque.
const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const ReportsPage = lazy(() => import('../pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })));

export function AppRouter() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Cargando...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute allowedRoles={['PACIENTE']}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/availability"
          element={
            <ProtectedRoute allowedRoles={['PACIENTE']}>
              <AvailabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/appointments"
          element={
            <ProtectedRoute allowedRoles={['PACIENTE']}>
              <AppointmentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/doctors"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DoctorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schedules"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SchedulesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/specialties"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SpecialtiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
