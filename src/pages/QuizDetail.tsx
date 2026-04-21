import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Award, Calendar, PlayCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import type { Quiz, QuizAttempt } from '@/types/database'

export default function QuizDetail() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeUntilStart, setTimeUntilStart] = useState('')

  useEffect(() => {
    loadQuiz()
  }, [quizId])

  useEffect(() => {
    if (!quiz) return

    const interval = setInterval(() => {
      const now = new Date()
      const start = new Date(quiz.start_time)
      const diff = start.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeUntilStart('Quiz has started!')
        clearInterval(interval)
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        const parts = []
        if (days > 0) parts.push(`${days}d`)
        if (hours > 0) parts.push(`${hours}h`)
        if (minutes > 0) parts.push(`${minutes}m`)
        if (seconds > 0) parts.push(`${seconds}s`)

        setTimeUntilStart(parts.join(' '))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [quiz])

  // 👇 YAHAN LAGA HAI ASLI LOCK 👇
  const loadQuiz = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (quizError) throw quizError
      setQuiz(quizData)

      // Bulletproof check: Ek hi baar attempt uthayega aur crash bhi nahi hoga
      const { data: attemptData, error: attemptError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .limit(1)
        .maybeSingle()

      if (attemptError) {
         console.warn("Attempt fetch error:", attemptError.message)
      }

      setAttempt(attemptData)
    } catch (error: any) {
      console.error('Error loading quiz:', error)
      toast.error('Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }
  // 👆 LOCK KHATAM 👆

  const handleStartQuiz = async () => {
    if (!quiz) return

    const now = new Date()
    const start = new Date(quiz.start_time)
    const end = new Date(quiz.end_time)

    if (now < start) {
      toast.error('Quiz has not started yet')
      return
    }

    if (now > end) {
      toast.error('Quiz has ended')
      return
    }

    if (attempt) {
      toast.error('You have already attempted this quiz')
      return
    }

    navigate(`/quiz/${quizId}/attempt`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isQuizAvailable = () => {
    if (!quiz) return false
    const now = new Date()
    const start = new Date(quiz.start_time)
    const end = new Date(quiz.end_time)
    return now >= start && now <= end && !attempt
  }

  const isQuizUpcoming = () => {
    if (!quiz) return false
    const now = new Date()
    const start = new Date(quiz.start_time)
    return now < start
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Quiz not found</h3>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl mb-2">{quiz.title}</CardTitle>
                <p className="text-muted-foreground">{quiz.description}</p>
              </div>
              {attempt && (
                <div className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                  Completed
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quiz Stats */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-semibold">{quiz.duration_minutes} minutes</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Marks</p>
                    <p className="font-semibold">{quiz.total_marks}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Passing Marks</p>
                    <p className="font-semibold">{quiz.passing_marks}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="p-4 border rounded-lg space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Schedule
              </h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Start Time</p>
                  <p className="font-medium">{formatDate(quiz.start_time)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">End Time</p>
                  <p className="font-medium">{formatDate(quiz.end_time)}</p>
                </div>
              </div>
            </div>

            {/* Countdown Timer for Upcoming Quizzes */}
            {isQuizUpcoming() && (
              <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-center">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-90" />
                <h3 className="font-bold text-xl mb-2">Quiz Starts In</h3>
                <p className="text-3xl font-bold">{timeUntilStart}</p>
              </div>
            )}

            {/* Rules */}
            <div className="p-4 border rounded-lg space-y-3">
              <h3 className="font-semibold">Quiz Rules</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>You have {quiz.duration_minutes} minutes to complete this quiz</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>You can attempt this quiz only once</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Quiz must be submitted before the end time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    Results will be {quiz.show_results_immediately ? 'shown immediately after submission' : 'published later by the instructor'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Passing marks: {quiz.passing_marks}/{quiz.total_marks}</span>
                </li>
              </ul>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              {isQuizAvailable() ? (
                <Button
                  size="lg"
                  className="w-full text-lg"
                  onClick={handleStartQuiz}
                >
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Start Quiz Now
                </Button>
              ) : isQuizUpcoming() ? (
                <Button size="lg" className="w-full" disabled>
                  <Clock className="w-5 h-5 mr-2" />
                  Quiz Not Started Yet
                </Button>
              ) : attempt ? (
                <Button
                  size="lg"
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate(`/quiz/${quizId}/review`)}
                >
                  View Your Submission
                </Button>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  Quiz Has Ended
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

