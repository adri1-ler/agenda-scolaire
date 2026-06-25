import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/ui/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

const SchedulePage = lazy(() => import('./pages/schedule/SchedulePage'))
const ClassManagementPage = lazy(() => import('./pages/classes/ClassManagementPage'))
const RevisionPage = lazy(() => import('./pages/revision/RevisionPage'))
const DevoirsPage = lazy(() => import('./pages/devoirs/DevoirsPage'))
const MessagingPage = lazy(() => import('./pages/messaging/MessagingPage'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'))
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'))

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/devoirs" element={<DevoirsPage />} />
            <Route path="/revision" element={<RevisionPage />} />
            <Route path="/messaging" element={<MessagingPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/classes" element={<ClassManagementPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/" element={<Navigate to="/schedule" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
