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

  console.log('ProtectedRoute check:', { 
    loading, 
    userRole: user?.role, 
    userEmail: user?.email,
    allowedRoles,
    hasAccess: allowedRoles ? allowedRoles.includes(user?.role || '') : true
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) {
    console.log('User not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log('User does not have required role, redirecting')
    const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/dashboard'
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}
