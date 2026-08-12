import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { DoctorsPage } from '../pages/admin/DoctorsPage';
import { ReportsPage } from '../pages/admin/ReportsPage';
import { SpecialtiesPage } from '../pages/admin/SpecialtiesPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AppointmentsPage } from '../pages/patient/AppointmentsPage';
import { PatientDashboardPage } from '../pages/patient/PatientDashboardPage';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRouter() {
  return (
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
    </Routes>
  );
}
