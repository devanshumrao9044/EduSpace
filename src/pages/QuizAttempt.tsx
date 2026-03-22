import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Flag, Send, AlertTriangle, CheckCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import type { Quiz, Question, QuizAttempt } from '@/types/database'

interface Answer {
  questionId: string
  answer: string
  marked: boolean
}

export default function QuizAttempt() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    initializeAttempt()

    // Tab visibility detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1
          if (newCount === 1) {
            toast.warning('Warning: Please stay on this tab during the quiz')
          } else if (newCount === 3) {
            toast.error('Multiple tab switches detected. This may affect your submission.')
          } else if (newCount >= 5) {
            toast.error('Excessive tab switching detected!')
          }
          return newCount
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || !attempt || attempt.submitted_at) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeLeft, attempt])

  // Auto-save with debounce
  useEffect(() => {
    if (!attempt || attempt.submitted_at) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveAnswers()
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [answers])

  const initializeAttempt = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }

      // Load quiz and questions
      const [quizRes, questionsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number')
      ])

      if (quizRes.error) throw quizRes.error
      if (questionsRes.error) throw questionsRes.error

      setQuiz(quizRes.data)
      setQuestions(questionsRes.data || [])

      // Check for existing attempt
      const { data: existingAttempt } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .single()

      if (existingAttempt?.submitted_at) {
        toast.error('You have already submitted this quiz')
        navigate(`/quiz/${quizId}/result`)
        return
      }

      if (existingAttempt) {
        // Resume existing attempt
        setAttempt(existingAttempt)
        const savedAnswers = existingAttempt.answers as Record<string, Answer> || {}
        setAnswers(savedAnswers)
        
        // Calculate remaining time
        const startTime = new Date(existingAttempt.started_at).getTime()
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const remaining = (quizRes.data.duration_minutes * 60) - elapsed
        setTimeLeft(Math.max(0, remaining))
      } else {
        // Create new attempt
        const { data: newAttempt, error: attemptError } = await supabase
          .from('quiz_attempts')
          .insert({
            quiz_id: quizId!,
            student_id: user.id,
            answers: {}
          })
          .select()
          .single()

        if (attemptError) throw attemptError

        setAttempt(newAttempt)
        setTimeLeft(quizRes.data.duration_minutes * 60)
      }
    } catch (error: any) {
      console.error('Error initializing attempt:', error)
      toast.error('Failed to start quiz')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const saveAnswers = async () => {
    if (!attempt || attempt.submitted_at) return

    try {
      const { error } = await supabase
        .from('quiz_attempts')
        .update({ answers })
        .eq('id', attempt.id)

      if (error) throw error
    } catch (error: any) {
      console.error('Error saving answers:', error)
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        answer,
        marked: prev[questionId]?.marked || false
      }
    }))
  }

  const handleToggleMarked = (questionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        answer: prev[questionId]?.answer || '',
        marked: !prev[questionId]?.marked
      }
    }))
  }

  const handleAutoSubmit = async () => {
    toast.info('Time is up! Auto-submitting quiz...')
    await handleSubmit(true)
  }

  const handleSubmit = async (isAuto = false) => {
    if (!attempt || !quiz) return

    if (!isAuto) {
      const confirmed = confirm('Are you sure you want to submit? You cannot change your answers after submission.')
      if (!confirmed) return
    }

    setSubmitting(true)

    try {
      // Calculate score
      let correctCount = 0
      let totalScore = 0

      questions.forEach(question => {
        const userAnswer = answers[question.id]?.answer?.trim()
        const correctAnswer = question.correct_answer.trim()

        if (!userAnswer) return

        let isCorrect = false

        if (question.question_type === 'mcq') {
          isCorrect = userAnswer.toUpperCase() === correctAnswer.toUpperCase()
        } else if (question.question_type === 'integer') {
          isCorrect = userAnswer === correctAnswer
        }
        // Paragraph questions require manual evaluation

        if (isCorrect) {
          correctCount++
          totalScore += question.marks
        }
      })

            // Ensure we have a valid ISO string for the exact current time
      const submitTime = new Date().toISOString()

      // Update attempt and explicitly select the updated row to ensure it saved
      const { data: updatedAttempt, error } = await supabase
        .from('quiz_attempts')
        .update({
          submitted_at: submitTime,
          answers: answers,
          score: totalScore,
          is_evaluated: !questions.some(q => q.question_type === 'paragraph')
        })
        .eq('id', attempt.id)
        .select()
        .single()

      if (error) {
        console.error("Supabase Update Error:", error)
        throw error
      }

      console.log("Successfully submitted attempt:", updatedAttempt)


      toast.success('Quiz submitted successfully!')
      navigate(`/quiz/${quizId}/result`)
    } catch (error: any) {
      console.error('Error submitting quiz:', error)
      toast.error('Failed to submit quiz')
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  const getQuestionStatus = (questionId: string) => {
    const answer = answers[questionId]
    if (answer?.marked) return 'marked'
    if (answer?.answer) return 'answered'
    return 'unanswered'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered': return 'bg-green-500 text-white'
      case 'marked': return 'bg-yellow-500 text-white'
      default: return 'bg-gray-200 text-gray-700'
    }
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

  if (!quiz || !questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Quiz not available</h3>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </Card>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion.id]

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">{quiz.title}</h1>
              <p className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                <Clock className="w-5 h-5" />
                <span className="font-bold text-lg">{formatTime(timeLeft)}</span>
              </div>
              
              <Button
                onClick={() => handleSubmit()}
                disabled={submitting}
                variant="default"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Quiz
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <Card className="p-6">
              {/* Question */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-primary text-white text-sm font-semibold rounded">
                        Q{currentQuestionIndex + 1}
                      </span>
                      <span className="px-3 py-1 bg-gray-100 text-sm font-medium rounded">
                        {currentQuestion.question_type.toUpperCase()}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
                      </span>
                    </div>
                    <p className="text-lg font-medium text-foreground leading-relaxed">
                      {currentQuestion.question_text}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Flag className={`w-5 h-5 ${currentAnswer?.marked ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`} />
                    <Switch
                      checked={currentAnswer?.marked || false}
                      onCheckedChange={() => handleToggleMarked(currentQuestion.id)}
                    />
                  </div>
                </div>
              </div>

              {/* Answer Options */}
              <div className="space-y-4">
                {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
                  <RadioGroup
                    value={currentAnswer?.answer || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    {Object.entries(currentQuestion.options).map(([key, value]) => (
                      value && (
                        <div key={key} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                          <RadioGroupItem value={key} id={`option-${key}`} />
                          <Label htmlFor={`option-${key}`} className="flex-1 cursor-pointer">
                            <span className="font-semibold mr-2">{key}.</span> {value}
                          </Label>
                        </div>
                      )
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion.question_type === 'integer' && (
                  <div>
                    <Label htmlFor="integer-answer">Your Answer</Label>
                    <Input
                      id="integer-answer"
                      type="number"
                      placeholder="Enter your answer..."
                      value={currentAnswer?.answer || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      className="mt-2 text-lg"
                    />
                  </div>
                )}

                {currentQuestion.question_type === 'paragraph' && (
                  <div>
                    <Label htmlFor="paragraph-answer">Your Answer</Label>
                    <Textarea
                      id="paragraph-answer"
                      placeholder="Type your answer here..."
                      value={currentAnswer?.answer || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      rows={8}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </Button>
                
                <div className="text-sm text-muted-foreground">
                  Mark for review to revisit later
                </div>
                
                <Button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                >
                  Next
                </Button>
              </div>
            </Card>
          </div>
        </main>

        {/* Question Navigation Sidebar */}
        <aside className="w-80 bg-white border-l p-6 overflow-y-auto">
          <h3 className="font-semibold mb-4">Question Navigation</h3>
          
          {/* Legend */}
          <div className="mb-6 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span>Marked for Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-200"></div>
              <span>Not Answered</span>
            </div>
          </div>

          {/* Question Grid */}
          <div className="grid grid-cols-5 gap-2">
            {questions.map((question, index) => {
              const status = getQuestionStatus(question.id)
              return (
                <button
                  key={question.id}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`
                    aspect-square rounded-lg font-semibold text-sm
                    transition-all hover:scale-105
                    ${getStatusColor(status)}
                    ${currentQuestionIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''}
                  `}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Questions:</span>
              <span className="font-semibold">{questions.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Answered:</span>
              <span className="font-semibold text-green-600">
                {Object.values(answers).filter(a => a.answer && !a.marked).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Marked:</span>
              <span className="font-semibold text-yellow-600">
                {Object.values(answers).filter(a => a.marked).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Not Answered:</span>
              <span className="font-semibold text-gray-600">
                {questions.length - Object.values(answers).filter(a => a.answer).length}
              </span>
            </div>
          </div>

          {tabSwitchCount > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-900">Tab Switches: {tabSwitchCount}</p>
                  <p className="text-yellow-700 text-xs mt-1">Stay focused on the quiz</p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
