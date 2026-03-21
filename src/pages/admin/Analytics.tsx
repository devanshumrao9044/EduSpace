import { useEffect, useState } from 'react'
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
      // Get all data
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

      // Calculate quiz performance
      const quizPerformance = quizzes.map(quiz => {
        const quizAttempts = attempts.filter((a: any) => a.quiz_id === quiz.id)
        const avgScore = quizAttempts.length > 0
          ? quizAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / quizAttempts.length
          : 0
        
        return {
          name: quiz.title.substring(0, 20) + (quiz.title.length > 20 ? '...' : ''),
          avgScore: Math.round(avgScore * 10) / 10,
          attempts: quizAttempts.length
        }
      }).slice(0, 10) // Top 10 quizzes

      // Score distribution
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

      // Pass/Fail ratio
      let passed = 0
      let failed = 0
      attempts.forEach((attempt: any) => {
        if ((attempt.score || 0) >= (attempt.quizzes?.passing_marks || 0)) {
          passed++
        } else {
          failed++
        }
      })

      const passFailRatio = [
        { name: 'Passed', value: passed },
        { name: 'Failed', value: failed }
      ]

      // Student engagement (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        return date.toISOString().split('T')[0]
      })

      const studentEngagement = last7Days.map(date => {
        const count = attempts.filter((a: any) => {
          const attemptDate = new Date(a.submitted_at).toISOString().split('T')[0]
          return attemptDate === date
        }).length

        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          attempts: count
        }
      })

      // Average score
      const totalScore = attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0)
      const averageScore = attempts.length > 0 ? totalScore / attempts.length : 0

      setData({
        totalQuizzes: quizzes.length,
        totalStudents: studentsRes.count || 0,
        totalAttempts: attempts.length,
        averageScore: Math.round(averageScore * 10) / 10,
        quizPerformance,
        scoreDistribution: scoreRanges,
        passFailRatio,
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
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-foreground">Analytics & Insights</h1>
            <p className="text-muted-foreground mt-1">Track performance and engagement metrics</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Total Quizzes</p>
                  <p className="text-4xl font-bold">{data.totalQuizzes}</p>
                  <p className="text-xs opacity-75 mt-2">Active & Inactive</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <BookOpen className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Total Students</p>
                  <p className="text-4xl font-bold">{data.totalStudents}</p>
                  <p className="text-xs opacity-75 mt-2">Registered users</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Total Attempts</p>
                  <p className="text-4xl font-bold">{data.totalAttempts}</p>
                  <p className="text-xs opacity-75 mt-2">All submissions</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <Activity className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Average Score</p>
                  <p className="text-4xl font-bold">{data.averageScore}</p>
                  <p className="text-xs opacity-75 mt-2">Out of total marks</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <Award className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="pass-rate">Pass Rate</TabsTrigger>
          </TabsList>

          {/* Quiz Performance */}
          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Quiz Performance Overview
                </CardTitle>
                <CardDescription>Average scores and attempt counts per quiz</CardDescription>
              </CardHeader>
              <CardContent>
                {data.quizPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data.quizPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                      <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="avgScore" fill="#3b82f6" name="Average Score" />
                      <Bar yAxisId="right" dataKey="attempts" fill="#10b981" name="Attempts" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No quiz performance data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Score Distribution */}
          <TabsContent value="distribution">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Score Distribution
                </CardTitle>
                <CardDescription>Distribution of scores across all attempts</CardDescription>
              </CardHeader>
              <CardContent>
                {data.scoreDistribution.some(d => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8b5cf6" name="Number of Students">
                        {data.scoreDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No score distribution data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Student Engagement */}
          <TabsContent value="engagement">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Student Engagement
                </CardTitle>
                <CardDescription>Quiz attempts over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.studentEngagement}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="attempts"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Quiz Attempts"
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pass/Fail Ratio */}
          <TabsContent value="pass-rate">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Pass/Fail Ratio
                </CardTitle>
                <CardDescription>Overall success rate across all quizzes</CardDescription>
              </CardHeader>
              <CardContent>
                {data.passFailRatio.some(d => d.value > 0) ? (
                  <div className="grid md:grid-cols-2 gap-8 items-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={data.passFailRatio}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {data.passFailRatio.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="space-y-6">
                      {data.passFailRatio.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: index === 0 ? '#10b981' : '#ef4444' }}
                            />
                            <span className="font-semibold text-foreground">{item.name}</span>
                          </div>
                          <span className="text-2xl font-bold text-foreground">{item.value}</span>
                        </div>
                      ))}
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                        <p className="text-sm text-blue-900 font-medium">
                          Success Rate: {data.passFailRatio[0]?.value > 0
                            ? ((data.passFailRatio[0].value / (data.passFailRatio[0].value + data.passFailRatio[1].value)) * 100).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No pass/fail data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
