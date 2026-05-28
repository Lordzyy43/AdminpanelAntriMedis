import { Navigate, Route, Routes } from 'react-router-dom'

import { LoginPage } from '../features/auth/pages/login-page'
import { ProtectedRoute } from '../features/auth/routes/protected-route'
import { DashboardPage } from '../features/dashboard/pages/dashboard-page'
import { DoctorManagementPage } from '../features/master-data/pages/doctor-management-page'
import { PolyclinicManagementPage } from '../features/master-data/pages/polyclinic-management-page'
import { QueueManagementPage } from '../features/queues/pages/queue-management-page'
import { ScheduleManagementPage } from '../features/schedules/pages/schedule-management-page'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/queues"
        element={
          <ProtectedRoute>
            <QueueManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedules"
        element={
          <ProtectedRoute>
            <ScheduleManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctors"
        element={
          <ProtectedRoute>
            <DoctorManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/polyclinics"
        element={
          <ProtectedRoute>
            <PolyclinicManagementPage />
          </ProtectedRoute>
        }
      />
      <Route path="/master-data" element={<Navigate replace to="/doctors" />} />
      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  )
}
