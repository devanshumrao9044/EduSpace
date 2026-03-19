import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import StudentDashboard from '@/pages/StudentDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import QuizList from '@/pages/admin/QuizList'
import CreateQuiz from '@/pages/admin/CreateQuiz'
import ManageQuestions from '@/pages/admin/ManageQuestions'
import QuizDetail from '@/pages/QuizDetail'
import NotFound from '@/pages/NotFound'
import ProtectedRoute from '@/components/layout/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Student Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz/:quizId"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <QuizDetail />
            </ProtectedRoute>
          }
        />
        
        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/quizzes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <QuizList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/quiz/new"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CreateQuiz />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/quiz/:quizId/questions"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ManageQuestions />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  )
}

export default App
