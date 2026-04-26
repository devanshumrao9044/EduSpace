import { useEffect, useState } from 'react' // 'import' small letter mein kiya
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, TrendingUp, Users, Award, Target, Activity, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AnalyticsData {
  totalQuizzes: number
  totalStudents: number
  totalAttempts: number
  averageScore: number
  quizPerformance: Array<{ name: string; avgScore: number; attempts: number }>
  scoreDistribution: Array<{ range: string; count: number }>
  passFailRatio: Array<{ name: string; value: number }>
  studentEngagement: Array<{ date: string; attempts: number }>
}

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6']

export default function Analytics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData>({
    totalQuizzes: 0,
    totalStudents: 0,
    totalAttempts: 0,
    averageScore: 0,
    quizPerformance: [],
    scoreDistribution: [],
    passFailRatio: [],
    studentEngagement: []
  })

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      const [quizzesRes, studentsRes, attemptsRes] = await Promise.all([
        supabase.from('quizzes').select('id, title, total_marks, passing_marks'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student'),
        supabase.from('quiz_attempts').select(`
          id,
          score,
          submitted_at,
          quiz_id,
          quizzes!inner (
            title,
            total_marks,
            passing_marks
          )
        `).not('submitted_at', 'is', null)
      ])

      const quizzes = quizzesRes.data || []
      const attempts = attemptsRes.data || []

      const quizPerformance = quizzes.map(quiz => {
        const quizAttempts = attempts.filter((a: any) => a.quiz_id === quiz.id)
        const avgScore = quizAttempts.length > 0
          ? quizAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / quizAttempts.length
          : 0
        
        return {
          name: quiz.title.substring(0, 15) + (quiz.title.length > 15 ? '...' : ''),
          avgScore: Math.round(avgScore * 10) / 10,
          attempts: quizAttempts.length
        }
      }).slice(0, 8)

      const scoreRanges = [
        { range: '0-20%', min: 0, max: 20, count: 0 },
        { range: '21-40%', min: 21, max: 40, count: 0 },
        { range: '41-60%', min: 41, max: 60, count: 0 },
        { range: '61-80%', min: 61, max: 80, count: 0 },
        { range: '81-100%', min: 81, max: 100, count: 0 }
      ]

      attempts.forEach((attempt: any) => {
        const percentage = ((attempt.score || 0) / (attempt.quizzes?.total_marks || 1)) * 100
        const range = scoreRanges.find(r => percentage >= r.min && percentage <= r.max)
        if (range) range.count++
      })

      let passed = 0
      let failed = 0
      attempts.forEach((attempt: any) => {
        if ((attempt.score || 0) >= (attempt.quizzes?.passing_marks || 0)) {
          passed++
        } else {
          failed++
        }
      })

      const studentEngagement = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        const dateStr = date.toISOString().split('T')[0]
        const count = attempts.filter((a: any) => new Date(a.submitted_at).toISOString().split('T')[0] === dateStr).length
        return {
          date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          attempts: count
        }
      })

      const totalScore = attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0)
      const averageScore = attempts.length > 0 ? totalScore / attempts.length : 0

      setData({
        totalQuizzes: quizzes.length,
        totalStudents: studentsRes.count || 0,
        totalAttempts: attempts.length,
        averageScore: Math.round(averageScore * 10) / 10,
        quizPerformance,
        scoreDistribution: scoreRanges,
        passFailRatio: [{ name: 'Passed', value: passed }, { name: 'Failed', value: failed }],
        studentEngagement
      })
    } catch (error: any) {
      console.error('Error loading analytics:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Analytics & Insights</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Key Metrics - Grid fix for mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard title="Quizzes" value={data.totalQuizzes} icon={<BookOpen className="w-5 h-5" />} color="from-blue-500 to-blue-600" />
          <MetricCard title="Students" value={data.totalStudents} icon={<Users className="w-5 h-5" />} color="from-purple-500 to-purple-600" />
          <MetricCard title="Attempts" value={data.totalAttempts} icon={<Activity className="w-5 h-5" />} color="from-green-500 to-green-600" />
          <MetricCard title="Avg Score" value={data.averageScore} icon={<Award className="w-5 h-5" />} color="from-orange-500 to-orange-600" />
        </div>

        {/* 👇 TABS MASHUP FIX YAHAN HAI 👇 */}
        <Tabs defaultValue="performance" className="space-y-6">
          <div className="w-full overflow-hidden rounded-lg bg-muted p-1">
            <TabsList className="flex w-full justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap bg-transparent no-scrollbar">
              <TabsTrigger value="performance" className="flex-1 min-w-[100px]">Performance</TabsTrigger>
              <TabsTrigger value="distribution" className="flex-1 min-w-[100px]">Distribution</TabsTrigger>
              <TabsTrigger value="engagement" className="flex-1 min-w-[100px]">Engagement</TabsTrigger>
              <TabsTrigger value="pass-rate" className="flex-1 min-w-[100px]">Pass Rate</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="performance">
            <Card>
              <CardHeader><CardTitle className="text-lg">Quiz Performance</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.quizPerformance}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} tick={{fill: '#6b7280'}} />
                    <YAxis fontSize={10} tick={{fill: '#6b7280'}} />
                    <Tooltip />
                    <Bar dataKey="avgScore" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ... Baaki content containers ko bhi ResponsiveContainer mein rakha hai ... */}
          <TabsContent value="engagement">
            <Card>
              <CardHeader><CardTitle className="text-lg">Engagement (Last 7 Days)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.studentEngagement}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="attempts" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pass Rate Content */}
          <TabsContent value="pass-rate">
            <Card>
              <CardHeader><CardTitle className="text-lg">Pass/Fail Ratio</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.passFailRatio} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {data.passFailRatio.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

// Helper component for metrics
function MetricCard({ title, value, icon, color }: any) {
  return (
    <Card className={`border-0 shadow-sm bg-gradient-to-br ${color} text-white`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider opacity-80">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="opacity-30">{icon}</div>
      </CardContent>
    </Card>
  )
}

