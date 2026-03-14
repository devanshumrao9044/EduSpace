import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, LogOut, Book, Clock, Award, TrendingUp, PlayCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authService, type User } from '@/lib/auth'

export default function StudentDashboard() {
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

  // Mock data for student dashboard
  const stats = [
    { label: 'Courses Enrolled', value: '4', icon: Book, color: 'bg-blue-100 text-blue-600' },
    { label: 'Hours Learned', value: '28', icon: Clock, color: 'bg-green-100 text-green-600' },
    { label: 'Certificates', value: '2', icon: Award, color: 'bg-purple-100 text-purple-600' },
    { label: 'Progress', value: '67%', icon: TrendingUp, color: 'bg-orange-100 text-orange-600' },
  ]

  const courses = [
    {
      id: 1,
      title: 'Introduction to Web Development',
      progress: 75,
      nextLesson: 'CSS Grid Layout',
      instructor: 'Dr. Sarah Chen'
    },
    {
      id: 2,
      title: 'Data Structures & Algorithms',
      progress: 45,
      nextLesson: 'Binary Search Trees',
      instructor: 'Prof. Michael Roberts'
    },
    {
      id: 3,
      title: 'UI/UX Design Fundamentals',
      progress: 90,
      nextLesson: 'Final Project Review',
      instructor: 'Emma Wilson'
    },
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
                <p className="text-sm text-muted-foreground">Student Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-foreground">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
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
            Welcome back, {user?.full_name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-muted-foreground">
            Continue your learning journey. You're making great progress!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
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

        {/* Continue Learning Section */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Continue Learning</CardTitle>
                <CardDescription>Pick up where you left off</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">by {course.instructor}</p>
                      </div>
                      <Button size="sm" className="ml-4">
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Next: {course.nextLesson}</span>
                        <span className="font-semibold text-primary">{course.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Book className="w-4 h-4 mr-3" />
                  Browse All Courses
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-3" />
                  View Assignments
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Award className="w-4 h-4 mr-3" />
                  My Certificates
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <CardContent className="p-6">
                <Award className="w-12 h-12 mb-4 opacity-90" />
                <h3 className="font-bold text-lg mb-2">Learning Streak</h3>
                <p className="text-sm opacity-90 mb-4">
                  You've learned for 7 consecutive days! Keep it up!
                </p>
                <div className="text-3xl font-bold">7 Days 🔥</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
