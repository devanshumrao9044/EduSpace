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
      console.log('ProtectedRoute - Auth Check:', {
        userId: currentUser?.id,
        email: currentUser?.email,
        databaseRole: currentUser?.role,
        allowedRoles: allowedRoles
      })
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

 // if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (false && allowedRoles && !allowedRoles.includes(user.role)) {

    // Allow admins to access student routes
    if (user.role === 'admin' && allowedRoles.includes('student')) {
      console.log('ProtectedRoute - Admin accessing student route: ALLOWED')
      return <>{children}</>
    }
    
    console.log('ProtectedRoute - Access denied:', {
      userRole: user.role,
      requiredRoles: allowedRoles,
      redirecting: user.role === 'admin' ? '/admin/dashboard' : '/dashboard'
    })
    
    const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/dashboard'
    return <Navigate to={redirectPath} replace />
  }

  console.log('ProtectedRoute - Access granted:', { userRole: user.role, allowedRoles })

  return <>{children}</>
}
