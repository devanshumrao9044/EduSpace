import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import StudentDashboard from '@/pages/StudentDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import QuizList from '@/pages/admin/QuizList'
import CreateQuiz from '@/pages/admin/CreateQuiz'
import ManageQuestions from '@/pages/admin/ManageQuestions'
import QuizResults from '@/pages/admin/QuizResults'
import Analytics from '@/pages/admin/Analytics'
import QuizDetail from '@/pages/QuizDetail'
import QuizAttempt from '@/pages/QuizAttempt'
import QuizResult from '@/pages/QuizResult'
import NotFound from '@/pages/NotFound'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import EditQuiz from '@/pages/admin/EditQuiz'
import StudentHistory from '@/pages/StudentHistory'

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
          path="/quiz/:quizId/result"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <QuizResult />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz/:quizId/review"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <QuizResult />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz/:quizId/attempt"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <QuizAttempt />
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
        <Route
          path="/history"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentHistory />
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
          path="/admin/quiz/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <EditQuiz />
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
        <Route
          path="/admin/quiz/:quizId/results"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <QuizResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Analytics />
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
