import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import SessionWatcher from './components/SessionWatcher';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import Sales from './pages/Sales';
import Users from './pages/Users';
import Settings from './pages/Settings';
import { Suppliers, Attendance, Reports, Notifications, Logs } from './pages/OtherPages';

function RequireAuth({ children, roles }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return (
    <Layout>
      <SessionWatcher />
      {children}
    </Layout>
  );
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/medicines" element={<RequireAuth roles={['admin','pharmacist']}><Medicines /></RequireAuth>} />
      <Route path="/sales" element={<RequireAuth><Sales /></RequireAuth>} />
      <Route path="/users" element={<RequireAuth roles={['admin']}><Users /></RequireAuth>} />
      <Route path="/suppliers" element={<RequireAuth roles={['admin','pharmacist']}><Suppliers /></RequireAuth>} />
      <Route path="/attendance" element={<RequireAuth><Attendance /></RequireAuth>} />
      {/* تم التعديل هنا للسماح للأدمن فقط بالدخول لصفحة التقارير */}
      <Route path="/reports" element={<RequireAuth roles={['admin']}><Reports /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth roles={['admin','pharmacist']}><Notifications /></RequireAuth>} />
      <Route path="/logs" element={<RequireAuth roles={['admin']}><Logs /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth roles={['admin', 'pharmacist']}><Settings /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontFamily:'Cairo,sans-serif', direction:'rtl', fontSize:'14px', borderRadius:'10px', boxShadow:'0 8px 24px rgba(0,0,0,0.12)' },
            duration: 3500,
            success: { iconTheme:{ primary:'#10b981', secondary:'#fff' } },
            error:   { iconTheme:{ primary:'#ef4444', secondary:'#fff' } },
          }}
        />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}