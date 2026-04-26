import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import { App as CapacitorApp } from '@capacitor/app' // Capacitor App Plugin

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

// --- BACK BUTTON HANDLER COMPONENT ---
function BackButtonHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', () => {
      // Wo main pages jahan exit confirmation chahiye
      const rootPages = ['/', '/dashboard', '/login', '/register', '/admin/dashboard']

      if (rootPages.includes(location.pathname)) {
        const shouldExit = window.confirm("Kya aap Rankify app se bahar jaana chahte hain?")
        if (shouldExit) {
          CapacitorApp.exitApp()
        }
      } else {
        // Baaki pages par normal back jao
        navigate(-1)
      }
    })

    return () => {
      backButtonListener.then(l => l.remove())
    }
  }, [location, navigate])

  return null // Ye component sirf listener chalane ke liye hai
}

function App() {
  const [isInitializing, setIsInitializing] = useState(true)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    // 1. App start hote hi current session check karo
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsInitializing(false)
    })

    // 2. Auth State Change Listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_IN') {
        console.log('✅ Email Verified & Signed In!')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-pulse text-lg font-semibold text-indigo-600">Loading Rankify...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {/* Back Button Logic yahan trigger hogi */}
      <BackButtonHandler />

      <Routes>
        <Route 
          path="/" 
          element={
            session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          } 
        />

        {/* Public Routes */}
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/register" element={session ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        
        {/* --- STUDENT ROUTES --- */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/quiz/:quizId" element={<ProtectedRoute allowedRoles={['student']}><QuizDetail /></ProtectedRoute>} />
        <Route path="/quiz/:quizId/attempt" element={<ProtectedRoute allowedRoles={['student']}><QuizAttempt /></ProtectedRoute>} />
        <Route path="/quiz/:quizId/result" element={<ProtectedRoute allowedRoles={['student']}><QuizResult /></ProtectedRoute>} />
        <Route path="/quiz/:quizId/review" element={<ProtectedRoute allowedRoles={['student']}><QuizResult /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute allowedRoles={['student']}><StudentHistory /></ProtectedRoute>} />
        
        {/* --- ADMIN ROUTES --- */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/quizzes" element={<ProtectedRoute allowedRoles={['admin']}><QuizList /></ProtectedRoute>} />
        <Route path="/admin/quiz/new" element={<ProtectedRoute allowedRoles={['admin']}><CreateQuiz /></ProtectedRoute>} />
        <Route path="/admin/quiz/:id/edit" element={<ProtectedRoute allowedRoles={['admin']}><EditQuiz /></ProtectedRoute>} />
        <Route path="/admin/quiz/:quizId/questions" element={<ProtectedRoute allowedRoles={['admin']}><ManageQuestions /></ProtectedRoute>} />
        <Route path="/admin/quiz/:quizId/results" element={<ProtectedRoute allowedRoles={['admin']}><QuizResults /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><Analytics /></ProtectedRoute>} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>

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

