import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { authService } from '@/lib/auth'
import type { User } from '@/lib/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await authService.getCurrentUser()
      console.log('ProtectedRoute - User loaded:', currentUser)
      setUser(currentUser)
      setLoading(false)
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin' && allowedRoles.includes('student')) {
      return <>{children}</>
    }
    const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/dashboard'
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}
