import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Download, Eye, Trophy, Users, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import type { Quiz, QuizAttempt } from '@/types/database'
import Papa from 'papaparse'

interface AttemptWithProfile extends QuizAttempt {
  student_name: string
  student_email: string
}

export default function QuizResults() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempts, setAttempts] = useState<AttemptWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResults()
  }, [quizId])

  const loadResults = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (quizError) throw quizError
      setQuiz(quizData)

      // Get attempts with student profiles
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          profiles!quiz_attempts_student_id_fkey (
            full_name,
            email
          )
        `)
        .eq('quiz_id', quizId)
        .not('submitted_at', 'is', null)
        .order('score', { ascending: false, nullsFirst: false })
        .order('submitted_at', { ascending: true })

      if (attemptsError) throw attemptsError

      const attemptsWithProfiles = attemptsData?.map((attempt: any) => ({
        ...attempt,
        student_name: attempt.profiles?.full_name || 'Unknown',
        student_email: attempt.profiles?.email || 'Unknown'
      })) || []

      setAttempts(attemptsWithProfiles)
    } catch (error: any) {
      console.error('Error loading results:', error)
      toast.error('Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!attempts.length) {
      toast.error('No data to export')
      return
    }

    const csvData = attempts.map((attempt, index) => ({
      Rank: index + 1,
      'Student Name': attempt.student_name,
      'Student Email': attempt.student_email,
      'Score': attempt.score || 0,
      'Total Marks': quiz?.total_marks || 0,
      'Percentage': ((attempt.score || 0) / (quiz?.total_marks || 1) * 100).toFixed(2) + '%',
      'Status': attempt.is_evaluated ? 'Evaluated' : 'Pending',
      'Submitted At': new Date(attempt.submitted_at!).toLocaleString(),
      'Time Taken': calculateTimeTaken(attempt)
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quiz?.title}_results.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Results exported successfully')
  }

  const calculateTimeTaken = (attempt: QuizAttempt) => {
    const start = new Date(attempt.started_at).getTime()
    const end = new Date(attempt.submitted_at!).getTime()
    const minutes = Math.floor((end - start) / 60000)
    return `${minutes} min`
  }

  const getStats = () => {
    if (!attempts.length || !quiz) return { avgScore: 0, passRate: 0, totalAttempts: 0 }

    const totalAttempts = attempts.length
    const avgScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalAttempts
    const passed = attempts.filter(a => (a.score || 0) >= quiz.passing_marks).length
    const passRate = (passed / totalAttempts) * 100

    return { avgScore, passRate, totalAttempts }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    )
  }

  const stats = getStats()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quizzes
          </Button>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{quiz?.title}</h1>
              <p className="text-muted-foreground">Quiz Results & Analytics</p>
            </div>
            <Button onClick={handleExportCSV} disabled={!attempts.length}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Attempts</p>
                  <p className="text-3xl font-bold">{stats.totalAttempts}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                  <p className="text-3xl font-bold">{stats.avgScore.toFixed(1)}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pass Rate</p>
                  <p className="text-3xl font-bold">{stats.passRate.toFixed(1)}%</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Student Submissions</CardTitle>
            <CardDescription>Ranked by score and submission time</CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No submissions yet</h3>
                <p className="text-muted-foreground">Student submissions will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">Time</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((attempt, index) => {
                      const percentage = ((attempt.score || 0) / (quiz?.total_marks || 1)) * 100
                      const passed = (attempt.score || 0) >= (quiz?.passing_marks || 0)

                      return (
                        <TableRow key={attempt.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                              <span className="font-semibold">#{index + 1}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{attempt.student_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {attempt.student_email}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                                {attempt.score}/{quiz?.total_marks}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {calculateTimeTaken(attempt)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={attempt.is_evaluated ? 'default' : 'secondary'}>
                              {attempt.is_evaluated ? 'Published' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {new Date(attempt.submitted_at!).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/quiz/${quizId}/attempt/${attempt.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
