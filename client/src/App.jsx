import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DocumentViewPage from './pages/DocumentViewPage';
import PublicSignPage from './pages/PublicSignPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e1d2f',
              color: '#e2e2f0',
              border: '1px solid rgba(70, 68, 102, 0.5)',
              borderRadius: '12px',
              padding: '14px 20px',
              fontSize: '14px',
              boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#1e1d2f' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#1e1d2f' },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/sign/:token" element={<PublicSignPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/document/:id"
            element={
              <ProtectedRoute>
                <DocumentViewPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
