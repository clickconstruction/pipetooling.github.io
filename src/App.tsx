import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ResetPassword from './pages/ResetPassword'
import ResetPasswordConfirm from './pages/ResetPasswordConfirm'
import Customers from './pages/Customers'
import CustomerForm from './pages/CustomerForm'
import Projects from './pages/Projects'
import ProjectForm from './pages/ProjectForm'
import Workflow from './pages/Workflow'
import Settings from './pages/Settings'
import Calendar from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import People from './pages/People'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!user) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password-confirm" element={<ResetPasswordConfirm />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/new" element={<CustomerForm />} />
        <Route path="customers/:id/edit" element={<CustomerForm />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id/edit" element={<ProjectForm />} />
        <Route path="workflows/:projectId" element={<Workflow />} />
        <Route path="people" element={<People />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="templates" element={<Templates />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
