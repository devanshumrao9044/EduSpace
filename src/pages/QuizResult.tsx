import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Award, Clock, CheckCircle, XCircle, AlertCircle, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import type { Quiz, Question, QuizAttempt } from '@/types/database'

interface Answer {
  questionId: string
  answer: string
  marked: boolean
}

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResult()
  }, [quizId])

  const loadResult = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }

      const [quizRes, questionsRes, attemptRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number'),
        supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', user.id).single()
      ])

      if (quizRes.error) throw quizRes.error
      if (questionsRes.error) throw questionsRes.error
      if (attemptRes.error) throw attemptRes.error

      setQuiz(quizRes.data)
      setQuestions(questionsRes.data || [])
      setAttempt(attemptRes.data)
    } catch (error: any) {
      console.error('Error loading result:', error)
      toast.error('Failed to load result')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
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

  const calculateTimeTaken = () => {
    if (!attempt) return '0 minutes'
    const start = new Date(attempt.started_at).getTime()
    const end = new Date(attempt.submitted_at || Date.now()).getTime()
    const minutes = Math.floor((end - start) / 60000)
    const seconds = Math.floor(((end - start) % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const getAnswerStatus = (question: Question, userAnswer: string) => {
    if (!userAnswer) return { status: 'skipped', color: 'text-gray-500' }

    if (question.question_type === 'paragraph') {
      return { status: 'pending', color: 'text-yellow-600' }
    }

    const correct = question.question_type === 'mcq'
      ? userAnswer.toUpperCase() === question.correct_answer.toUpperCase()
      : userAnswer === question.correct_answer

    return {
      status: correct ? 'correct' : 'wrong',
      color: correct ? 'text-green-600' : 'text-red-600'
    }
  }

  const calculateStats = () => {
    if (!attempt || !questions.length) return { correct: 0, wrong: 0, skipped: 0, attempted: 0, accuracy: 0 }

    const answers = attempt.answers as Record<string, Answer>
    let correct = 0
    let wrong = 0
    let skipped = 0

    questions.forEach(question => {
      const userAnswer = answers[question.id]?.answer
      
      if (!userAnswer) {
        skipped++
        return
      }

      if (question.question_type !== 'paragraph') {
        const isCorrect = question.question_type === 'mcq'
          ? userAnswer.toUpperCase() === question.correct_answer.toUpperCase()
          : userAnswer === question.correct_answer

        if (isCorrect) correct++
        else wrong++
      }
    })

    const attempted = questions.length - skipped
    const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0

    return { correct, wrong, skipped, attempted, accuracy }
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

  if (!quiz || !attempt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Result not found</h3>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </Card>
      </div>
    )
  }

  const stats = calculateStats()
  const passed = attempt.score !== null && attempt.score >= quiz.passing_marks
  
  // FIXED LOGIC: Strict check for Admin settings
  const showDetailedResults = quiz.show_results_immediately === false;

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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Card */}
        <Card className={`${passed ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'} text-white`}>
          <CardContent className="p-8 text-center">
            {showDetailedResults ? (
              <>
                <Trophy className="w-16 h-16 mx-auto mb-4 opacity-90" />
                <h1 className="text-3xl font-bold mb-2">
                  {passed ? 'Congratulations! 🎉' : 'Quiz Completed'}
                </h1>
                <p className="text-lg opacity-90">
                  {passed ? `You've passed the quiz!` : 'Keep practicing to improve'}
                </p>
              </>
            ) : (
              <>
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-90" />
                <h1 className="text-3xl font-bold mb-2">Quiz Submitted Successfully</h1>
                <p className="text-lg opacity-90">Your responses are under evaluation</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quiz Info */}
        <Card>
          <CardHeader>
            <CardTitle>{quiz.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Submitted At:</span>
              <span className="font-medium">{formatDate(attempt.submitted_at!)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Time Taken:</span>
              <span className="font-medium">{calculateTimeTaken()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={attempt.is_evaluated ? 'default' : 'secondary'}>
                {attempt.is_evaluated ? 'Evaluated' : 'Pending Evaluation'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {showDetailedResults && (
          <>
            {/* Score Card */}
            <Card>
              <CardContent className="p-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <Award className="w-12 h-12 text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">Your Score</p>
                    <p className="text-4xl font-bold text-foreground">
                      {attempt.score}/{quiz.total_marks}
                    </p>
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${passed ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${((attempt.score || 0) / quiz.total_marks) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium">Correct</span>
                      </div>
                      <span className="font-bold text-green-600">{stats.correct}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-sm font-medium">Wrong</span>
                      </div>
                      <span className="font-bold text-red-600">{stats.wrong}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium">Skipped</span>
                      </div>
                      <span className="font-bold text-gray-600">{stats.skipped}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium">Accuracy</span>
                      <span className="font-bold text-blue-600">{stats.accuracy.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Question Review */}
            <Card>
              <CardHeader>
                <CardTitle>Answer Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((question, index) => {
                  const answers = attempt.answers as Record<string, Answer>
                  const userAnswer = answers[question.id]?.answer
                  const answerStatus = getAnswerStatus(question, userAnswer)

                  return (
                    <div key={question.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-gray-100 text-sm font-semibold rounded">
                              Q{index + 1}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{question.question_text}</p>
                        </div>
                        <div className={`flex items-center gap-1 ${answerStatus.color}`}>
                          {answerStatus.status === 'correct' && <CheckCircle className="w-5 h-5" />}
                          {answerStatus.status === 'wrong' && <XCircle className="w-5 h-5" />}
                          {answerStatus.status === 'pending' && <AlertCircle className="w-5 h-5" />}
                          <span className="text-sm font-semibold capitalize">{answerStatus.status}</span>
                        </div>
                      </div>

                      {question.question_type !== 'paragraph' && (
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Your Answer:</span>
                            <span className={`font-medium ${answerStatus.color}`}>
                              {userAnswer || 'Not Answered'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Correct Answer:</span>
                            <span className="font-medium text-green-600">{question.correct_answer}</span>
                          </div>
                        </div>
                      )}

                      {question.question_type === 'paragraph' && userAnswer && (
                        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                          <p className="text-muted-foreground mb-1">Your Response:</p>
                          <p className="text-foreground">{userAnswer}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </>
        )}

        {!showDetailedResults && (
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Results Hidden</h3>
              <p className="text-muted-foreground mb-6">
                Your quiz has been submitted successfully. The instructor will publish the results later.
              </p>
              <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
