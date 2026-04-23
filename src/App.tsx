import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'

// Auth & Layout
import ProtectedRoute from '@/components/layout/ProtectedRoute'

// Public Pages
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import NotFound from '@/pages/NotFound'

// Student Pages
import StudentDashboard from '@/pages/StudentDashboard'
import StudentHistory from '@/pages/StudentHistory'
import QuizDetail from '@/pages/QuizDetail'
import QuizAttempt from '@/pages/QuizAttempt'
import QuizResult from '@/pages/QuizResult'

// Admin Pages
import AdminDashboard from '@/pages/AdminDashboard'
import QuizList from '@/pages/admin/QuizList'
import CreateQuiz from '@/pages/admin/CreateQuiz'
import EditQuiz from '@/pages/admin/EditQuiz'
import ManageQuestions from '@/pages/admin/ManageQuestions'
import QuizResults from '@/pages/admin/QuizResults'
import Analytics from '@/pages/admin/Analytics'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public Routes - No Protection Needed */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* --- STUDENT ROUTES (MATERIALHUB QUIZX CORE) --- */}
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
        <Route
          path="/quiz/:quizId/attempt"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <QuizAttempt />
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
          path="/history"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentHistory />
            </ProtectedRoute>
          }
        />
        
        {/* --- ADMIN ROUTES (SECURE MANAGEMENT) --- */}
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
        
        {/* 404 Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Global Notifications */}
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: { borderRadius: '1rem', border: 'none', fontWeight: 'bold' }
        }}
      />
    </BrowserRouter>
  )
}

export default App
