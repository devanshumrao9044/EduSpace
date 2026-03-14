import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, LogOut, Users, GraduationCap, FileText, TrendingUp, UserPlus, Settings, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authService, type User } from '@/lib/auth'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    }
    loadUser()
  }, [])

  const handleLogout = async () => {
    console.log('Logging out...')
    await authService.logout()
    toast.success('Logged out successfully')
    navigate('/login', { replace: true })
  }

  // Mock admin statistics
  const stats = [
    { label: 'Total Students', value: '1,234', change: '+12%', icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Active Courses', value: '48', change: '+3', icon: GraduationCap, color: 'bg-green-100 text-green-600' },
    { label: 'Assignments', value: '156', change: '+24', icon: FileText, color: 'bg-purple-100 text-purple-600' },
    { label: 'Completion Rate', value: '87%', change: '+5%', icon: TrendingUp, color: 'bg-orange-100 text-orange-600' },
  ]

  const recentActivity = [
    { type: 'New Student', description: 'Alex Thompson enrolled in Web Development', time: '5 min ago' },
    { type: 'Course Update', description: 'Data Science 101 materials updated', time: '1 hour ago' },
    { type: 'Assignment', description: '23 new submissions for Python Basics', time: '2 hours ago' },
    { type: 'Certificate', description: '5 students earned UI/UX certificates', time: '3 hours ago' },
  ]

  const topCourses = [
    { name: 'Web Development Bootcamp', students: 345, completion: 82 },
    { name: 'Data Science Fundamentals', students: 289, completion: 76 },
    { name: 'Mobile App Design', students: 234, completion: 91 },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">EduSpace</h1>
                <p className="text-sm text-muted-foreground">Admin Control Panel</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-foreground">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Admin Dashboard
          </h2>
          <p className="text-muted-foreground">
            Manage your platform, monitor performance, and support your students
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-green-600">{stat.change}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Quick Actions & Top Courses */}
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start">
                  <UserPlus className="w-4 h-4 mr-3" />
                  Add New Student
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <GraduationCap className="w-4 h-4 mr-3" />
                  Create Course
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-3" />
                  View Reports
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-3" />
                  Platform Settings
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Top Courses</CardTitle>
                <CardDescription>By enrollment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topCourses.map((course, index) => (
                  <div key={course.name} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary">#{index + 1}</span>
                          <p className="text-sm font-semibold text-foreground">{course.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {course.students} students
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-semibold text-primary">{course.completion}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5"
                          style={{ width: `${course.completion}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest platform events and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                      </div>
                      <div className="flex-1 pb-6 border-b last:border-0 last:pb-0">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-semibold text-sm text-foreground">{activity.type}</p>
                          <span className="text-xs text-muted-foreground">{activity.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm mt-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-2">Platform Health</h3>
                    <p className="text-sm opacity-90 mb-4">
                      All systems operational. Student satisfaction: 94%
                    </p>
                    <Button variant="secondary" size="sm">
                      View Detailed Analytics
                    </Button>
                  </div>
                  <BarChart3 className="w-16 h-16 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
