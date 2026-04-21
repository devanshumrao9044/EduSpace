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
        .order('submitted_at', { ascending: true }) // Tie-breaker: Pehle submit karne wala upar

      if (error) throw error

      const quizData = await supabase.from('quizzes').select('end_time').eq('id', quizId).single()
      const deadline = new Date(quizData.data?.end_time)

      // 🔥 LOGIC: Filter and Rank ONLY LIVE attempts for the leaderboard
      let currentRank = 0
      const processedData = (data || []).map((attempt: any) => {
        const isLive = new Date(attempt.submitted_at) <= deadline
        return { ...attempt, isLive }
      })

      // Sirf live walon ko rank do
      const rankedData = processedData.map((attempt) => {
        if (attempt.isLive) {
          currentRank++
          return { ...attempt, rank: currentRank }
        }
        return { ...attempt, rank: undefined } // Practice walon ki rank hide kar di
      })

      setAttempts(rankedData)
    } catch (error: any) {
      toast.error('Failed to load attempts')
    } finally {
      setLoading(false)
    }
  }

  // Stats calculate karte waqt hum saare attempts lenge (Live + Practice)
  const calculateStats = () => {
    if (attempts.length === 0) return { avgScore: 0, passRate: 0, liveCount: 0, practiceCount: 0 }
    const scores = attempts.map(a => a.score || 0)
    const avgScore = scores.reduce((s, c) => s + c, 0) / scores.length
    const liveCount = attempts.filter(a => a.isLive).length
    return {
      avgScore: avgScore.toFixed(1),
      liveCount,
      practiceCount: attempts.length - liveCount
    }
  }

  const stats = calculateStats()
  // 🔥 Table mein sirf Live bache dikhane ke liye filter
  const leaderboardData = attempts.filter(a => a.isLive)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 py-4 px-6 flex justify-between items-center">
         <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/quizzes')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            <h1 className="text-xl font-bold">{quiz?.title} <Badge variant="outline" className="ml-2">Admin View</Badge></h1>
         </div>
         <div className="flex gap-2">
            <Badge className="bg-green-600">Live: {stats.liveCount}</Badge>
            <Badge className="bg-blue-600">Practice: {stats.practiceCount}</Badge>
         </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center gap-4">
                <Users className="text-blue-500"/> <div><p className="text-sm text-muted-foreground">Total Attempts</p><p className="text-2xl font-bold">{attempts.length}</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-4">
                <TrendingUp className="text-purple-500"/> <div><p className="text-sm text-muted-foreground">Avg. Score</p><p className="text-2xl font-bold">{stats.avgScore}</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-4">
                <Clock className="text-orange-500"/> <div><p className="text-sm text-muted-foreground">Live Deadline</p><p className="text-sm font-medium">{quiz && new Date(quiz.end_time).toLocaleString()}</p></div>
            </CardContent></Card>
        </div>

        {/* Leaderboard Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Official Live Leaderboard</CardTitle>
                <CardDescription>Only students who submitted before deadline are ranked here.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info("Practice results are hidden from public leaderboard.")}>
                <Download className="w-4 h-4 mr-2"/> Export Live Data
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Time Taken</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leaderboardData.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-lg text-blue-600">#{attempt.rank}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{attempt.profiles?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{attempt.profiles?.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">{attempt.score} / {quiz?.total_marks}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(attempt.submitted_at!).toLocaleTimeString()}</td>
                      <td className="px-4 py-3"><Badge className="bg-green-100 text-green-700 border-0">LIVE</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaderboardData.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">No live attempts found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question Analytics (Keep it for full data) */}
        {quizId && <QuestionAnalytics quizId={quizId} />}
      </main>
    </div>
  )
}
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
      Rank: attempt.rank,
      Name: attempt.profiles?.full_name || 'N/A',
      Email: attempt.profiles?.email || 'N/A',
      Score: attempt.score || 0,
      'Total Marks': quiz?.total_marks || 0,
      Percentage: quiz ? ((attempt.score || 0) / quiz.total_marks * 100).toFixed(2) : 0,
      Status: (attempt.score || 0) >= (quiz?.passing_marks || 0) ? 'Passed' : 'Failed',
      'Submitted At': new Date(attempt.submitted_at!).toLocaleString(),
      Published: attempt.is_evaluated ? 'Yes' : 'No'
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
    if (attempts.length === 0) {
      return { avgScore: 0, passRate: 0, highestScore: 0, lowestScore: 0 }
    }

    const scores = attempts.map(a => a.score || 0)
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const passed = attempts.filter(a => (a.score || 0) >= (quiz?.passing_marks || 0)).length
    const passRate = (passed / attempts.length) * 100

    return {
      avgScore: Math.round(avgScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores)
    }
  }

  const stats = calculateStats()

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
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quizzes
          </Button>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                {quiz?.title}
                {quiz?.show_results_immediately && (
                  <Badge className="bg-green-500 hover:bg-green-600">Published</Badge>
                )}
              </h1>
              <p className="text-muted-foreground">Quiz Results & Rankings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Attempts</p>
                  <p className="text-3xl font-bold text-foreground">{attempts.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                  <p className="text-3xl font-bold text-foreground">{stats.avgScore}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pass Rate</p>
                  <p className="text-3xl font-bold text-foreground">{stats.passRate}%</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Highest Score</p>
                  <p className="text-3xl font-bold text-foreground">{stats.highestScore}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={handleGenerateRanks}
            disabled={generating || attempts.length === 0 || quiz?.show_results_immediately}
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

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Student Rankings</CardTitle>
            <CardDescription>Ordered by score DESC, then submission time ASC</CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No attempts yet</h3>
                <p className="text-muted-foreground">Students haven't attempted this quiz yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Percentage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Submitted</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attempts.map((attempt, index) => {
                      const percentage = quiz ? ((attempt.score || 0) / quiz.total_marks * 100) : 0
                      const passed = (attempt.score || 0) >= (quiz?.passing_marks || 0)

                      return (
                        <tr key={attempt.id} className={index === 0 ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {attempt.rank === 1 && <Trophy className="w-5 h-5 text-yellow-500" />}
                              <span className="font-semibold text-foreground">#{attempt.rank}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-foreground">{attempt.profiles?.full_name}</p>
                              <p className="text-sm text-muted-foreground">{attempt.profiles?.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-foreground">
                              {attempt.score || 0}/{quiz?.total_marks}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-foreground">{percentage.toFixed(1)}%</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={passed ? 'default' : 'destructive'}>
                              {passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-muted-foreground">
                              {new Date(attempt.submitted_at!).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={attempt.is_evaluated ? 'default' : 'secondary'}>
                              {attempt.is_evaluated ? 'Yes' : 'No'}
                            </Badge>
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

        {/* YAHAN LAGA HAI NAYA QUESTION ANALYTICS COMPONENT 👇 */}
        {quizId && attempts.length > 0 && (
          <QuestionAnalytics quizId={quizId} />
        )}

      </main>
    </div>
  )
}
