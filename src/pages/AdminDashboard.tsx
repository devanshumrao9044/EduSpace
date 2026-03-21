import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Users, FileText, Plus, BarChart3, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authService, type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    activeQuizzes: 0,
    totalStudents: 0,
    totalAttempts: 0
  })

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    }
    loadUser()
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [quizzes, students, attempts] = await Promise.all([
        supabase.from('quizzes').select('id, is_active', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student'),
        supabase.from('quiz_attempts').select('id', { count: 'exact' })
      ])

      setStats({
        totalQuizzes: quizzes.count || 0,
        activeQuizzes: quizzes.data?.filter(q => q.is_active).length || 0,
        totalStudents: students.count || 0,
        totalAttempts: attempts.count || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const statsCards = [
    { label: 'Total Quizzes', value: stats.totalQuizzes.toString(), icon: FileText, color: 'bg-blue-100 text-blue-600' },
    { label: 'Active Quizzes', value: stats.activeQuizzes.toString(), icon: ListTodo, color: 'bg-green-100 text-green-600' },
    { label: 'Total Students', value: stats.totalStudents.toString(), icon: Users, color: 'bg-purple-100 text-purple-600' },
    { label: 'Quiz Attempts', value: stats.totalAttempts.toString(), icon: BarChart3, color: 'bg-orange-100 text-orange-600' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-0 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16 md:mt-0">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Admin Dashboard
            </h2>
            <p className="text-muted-foreground">
              Manage quizzes, monitor performance, and support your students
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statsCards.map((stat) => (
              <Card key={stat.label} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Manage quizzes and platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" onClick={() => navigate('/admin/quiz/new')}>
                  <Plus className="w-4 h-4 mr-3" />
                  Create New Quiz
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/admin/quizzes')}>
                  <ListTodo className="w-4 h-4 mr-3" />
                  Manage Quizzes
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/admin/analytics')}>
                  <BarChart3 className="w-4 h-4 mr-3" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm md:col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <CardContent className="p-8">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-2xl mb-2">Quiz Management System</h3>
                    <p className="text-sm opacity-90 mb-6">
                      Create, manage, and evaluate quizzes efficiently. Track student performance and generate insights.
                    </p>
                    <Button variant="secondary" onClick={() => navigate('/admin/quizzes')}>
                      Get Started
                    </Button>
                  </div>
                  <FileText className="w-20 h-20 opacity-80 hidden lg:block" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
