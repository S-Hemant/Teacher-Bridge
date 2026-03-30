import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Discovery } from './pages/Discovery';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { StudentDashboard } from './pages/StudentDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { TeacherDetail } from './pages/TeacherDetail';
import { VoiceSearch } from './pages/VoiceSearch';
import { AuthCallback } from './pages/AuthCallback';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/teachers/:id" element={<TeacherDetail />} />
        <Route
          path="/student"
          element={
            <RequireAuth role="student">
              <StudentDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/student/discover"
          element={
            <RequireAuth role="student">
              <Discovery />
            </RequireAuth>
          }
        />
        <Route
          path="/student/voice"
          element={
            <RequireAuth role="student">
              <VoiceSearch />
            </RequireAuth>
          }
        />
        <Route
          path="/teacher"
          element={
            <RequireAuth role="teacher">
              <TeacherDashboard />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
