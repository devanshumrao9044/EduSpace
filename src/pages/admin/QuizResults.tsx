import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Award, Calendar, Download, TrendingUp, Trophy, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import type { Quiz, QuizAttempt } from '@/types/database'
import QuestionAnalytics from '@/components/features/QuestionAnalytics'

interface AttemptWithProfile extends QuizAttempt {
  profiles?: {
    full_name: string
    email: string
  }
  rank?: number
  isLive?: boolean
}

export default function QuizResults() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempts, setAttempts] = useState<AttemptWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (quizId) {
      loadQuiz()
      loadAttempts()
    }
  }, [quizId])

  const loadQuiz = async () => {
    const { data } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
    if (data) setQuiz(data)
  }

  const loadAttempts = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`*, profiles!inner (full_name, email)`)
        .eq('quiz_id', quizId)
        .not('submitted_at', 'is', null)
        .order('score', { ascending: false })
        .order('submitted_at', { ascending: true })

      if (error) throw error

      const quizData = await supabase.from('quizzes').select('end_time').eq('id', quizId).single()
      const deadline = new Date(quizData.data?.end_time)

      let currentRank = 0
      const processedData = (data || []).map((attempt: any) => {
        const isLive = new Date(attempt.submitted_at) <= deadline
        return { ...attempt, isLive }
      })

      const rankedData = processedData.map((attempt) => {
        if (attempt.isLive) {
          currentRank++
          return { ...attempt, rank: currentRank }
        }
        return { ...attempt, rank: undefined }
      })

      setAttempts(rankedData)
    } catch (error: any) {
      toast.error('Failed to load attempts')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRanks = async () => {
    if (!quizId || attempts.length === 0) return
    setGenerating(true)
    try {
      for (const attempt of attempts) {
        await supabase
          .from('quiz_attempts')
          .update({ rank: attempt.rank, is_evaluated: true })
          .eq('id', attempt.id)
      }

      const { error: quizError } = await supabase
        .from('quizzes')
        .update({ show_results_immediately: true })
        .eq('id', quizId)

      if (quizError) throw quizError

      toast.success('Ranks generated and results published!')
      setQuiz(prev => prev ? { ...prev, show_results_immediately: true } : prev)
      loadAttempts()
    } catch (error: any) {
      console.error('Error generating ranks:', error)
      toast.error('Failed to generate ranks')
    } finally {
      setGenerating(false)
    }
  }

  const handleExportCSV = () => {
    if (attempts.length === 0) {
      toast.error('No attempts to export')
      return
    }

    const csvData = attempts.map(attempt => ({
      Rank: attempt.rank || 'N/A',
      Name: attempt.profiles?.full_name || 'N/A',
      Email: attempt.profiles?.email || 'N/A',
      Score: attempt.score || 0,
      'Total Marks': quiz?.total_marks || 0,
      Percentage: quiz ? ((attempt.score || 0) / quiz.total_marks * 100).toFixed(2) : 0,
      Status: (attempt.score || 0) >= (quiz?.passing_marks || 0) ? 'Passed' : 'Failed',
      'Submitted At': new Date(attempt.submitted_at!).toLocaleString(),
      Type: attempt.isLive ? 'Live' : 'Practice'
    }))

    const headers = Object.keys(csvData[0])
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quiz?.title || 'quiz'}_results.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Results exported successfully!')
  }

  const calculateStats = () => {
    if (attempts.length === 0) return { avgScore: 0, liveCount: 0, practiceCount: 0 }
    const scores = attempts.map(a => a.score || 0)
    const avgScore = (scores.reduce((s, c) => s + c, 0) / scores.length).toFixed(1)
    const liveCount = attempts.filter(a => a.isLive).length
    return { avgScore, liveCount, practiceCount: attempts.length - liveCount }
  }

  const stats = calculateStats()
  const leaderboardData = attempts.filter(a => a.isLive)

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 py-4 px-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-xl font-bold">
            {quiz?.title}{' '}
            <Badge variant="outline" className="ml-2">Admin View</Badge>
            {quiz?.show_results_immediately && (
              <Badge className="ml-2 bg-green-500 hover:bg-green-600">Published</Badge>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-green-600">Live: {stats.liveCount}</Badge>
          <Badge className="bg-blue-600">Practice: {stats.practiceCount}</Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <Users className="text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Attempts</p>
                <p className="text-2xl font-bold">{attempts.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <TrendingUp className="text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg. Score</p>
                <p className="text-2xl font-bold">{stats.avgScore}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <Clock className="text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Live Deadline</p>
                <p className="text-sm font-medium">{quiz && new Date(quiz.end_time).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            onClick={handleGenerateRanks}
            disabled={generating || attempts.length === 0 || !!quiz?.show_results_immediately}
          >
            <Trophy className="w-4 h-4 mr-2" />
            {generating
              ? 'Generating...'
              : quiz?.show_results_immediately
              ? 'Results Already Published'
              : 'Generate Ranks & Publish Results'}
          </Button>
          <Button variant="outline" onClick={handleExportCSV} disabled={attempts.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Leaderboard Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Official Live Leaderboard</CardTitle>
              <CardDescription>Only students who submitted before the deadline are ranked here.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {leaderboardData.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No live attempts yet</h3>
                <p className="text-muted-foreground">Students haven't submitted before the deadline</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Percentage</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaderboardData.map((attempt, index) => {
                      const percentage = quiz ? ((attempt.score || 0) / quiz.total_marks * 100) : 0
                      const passed = (attempt.score || 0) >= (quiz?.passing_marks || 0)
                      return (
                        <tr key={attempt.id} className={index === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 font-bold text-lg text-blue-600 flex items-center gap-2">
                            {attempt.rank === 1 && <Trophy className="w-4 h-4 text-yellow-500" />}
                            #{attempt.rank}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{attempt.profiles?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{attempt.profiles?.email}</p>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold">{attempt.score} / {quiz?.total_marks}</td>
                          <td className="px-4 py-3">{percentage.toFixed(1)}%</td>
                          <td className="px-4 py-3">
                            <Badge variant={passed ? 'default' : 'destructive'}>
                              {passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(attempt.submitted_at!).toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question Analytics */}
        {quizId && <QuestionAnalytics quizId={quizId} />}
      </main>
    </div>
  )
}
