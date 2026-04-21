import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Clock, Flag, Send, AlertTriangle, CheckCircle, X,
  BarChart2, ChevronLeft, ChevronRight,
} from 'lucide-react'
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
  const [attempt, setAttempt] = useState<any>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [warningCount, setWarningCount] = useState(0)
  const [statsOpen, setStatsOpen] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  /* ─── Data & Initialization ─────────────────────────────── */

  const initializeAttempt = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return }

      const [quizRes, questionsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number'),
      ])
      
      if (quizRes.error) throw quizRes.error
      if (questionsRes.error) throw questionsRes.error

      setQuiz(quizRes.data)
      setQuestions(questionsRes.data || [])

      // 🔥 LOCK REMOVED: Yahan hum ab redirect nahi karenge agar purana attempt mile.
      // Hum humesha naya attempt create karenge.
      
      const { data: newAttempt, error } = await supabase
        .from('quiz_attempts')
        .insert({ 
          quiz_id: quizId!, 
          student_id: user.id, 
          answers: {},
          started_at: new Date().toISOString(),
          is_evaluated: false // Initially false
        })
        .select().single()
      
      if (error) throw error
      
      setAttempt(newAttempt)
      setTimeLeft(quizRes.data.duration_minutes * 60)

    } catch (error: any) {
      console.error('Error initializing attempt:', error)
      toast.error('Failed to start quiz')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Answer ko temporary save karne ke liye (Draft)
  const saveAnswersDraft = async () => {
    if (!attempt || submitting) return
    await supabase
      .from('quiz_attempts')
      .update({ answers })
      .eq('id', attempt.id)
  }

  /* ─── Handlers ───────────────────────────────────────────── */

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, answer, marked: prev[questionId]?.marked || false },
    }))
  }

  const handleToggleMarked = (questionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        answer: prev[questionId]?.answer || '',
        marked: !prev[questionId]?.marked,
      },
    }))
  }

  const handleSubmit = async (isAuto = false) => {
    if (!attempt || !quiz) return

    if (!isAuto) {
      const confirmed = window.confirm('Are you sure you want to submit?')
      if (!confirmed) return
    }
    
    setSubmitting(true)

    // Calculate score locally
    let totalScore = 0
    questions.forEach(q => {
      const ua = answers[q.id]?.answer?.trim()
      if (!ua) return
      
      const correctAns = q.correct_answer?.trim() || ''
      const correct = q.question_type === 'mcq'
        ? ua.toUpperCase() === correctAns.toUpperCase()
        : ua === correctAns
      
      if (correct) totalScore += q.marks
    })

    // 🔥 FIX: Ab hum final data update kar rahe hain usi specific attempt ID par
    const { error } = await supabase
      .from('quiz_attempts')
      .update({
        submitted_at: new Date().toISOString(),
        answers,
        score: totalScore,
        is_evaluated: true, // Mark it evaluated for non-paragraph quizzes
      })
      .eq('id', attempt.id)

    if (error) {
      toast.error('Submission failed')
      setSubmitting(false)
      return
    }

    toast.success('Submitted!')
    navigate(`/quiz/${quizId}/result`)
  }

  const handleAutoSubmit = async () => {
    if (!submitting) await handleSubmit(true)
  }

  /* ─── Anti-Cheat ───────────────────────────────────── */

  useEffect(() => {
    initializeAttempt()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !submitting) {
        setWarningCount(prev => prev + 1)
        toast.warning('Warning: Don\'t switch tabs!')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (warningCount >= 3 && !submitting) {
      handleSubmit(true)
    }
  }, [warningCount])

  /* ─── Timer & AutoSave ──────────────────────────────────────── */

  useEffect(() => {
    if (timeLeft <= 0 || !attempt) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleAutoSubmit(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft, attempt])

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(saveAnswersDraft, 2000)
    return () => clearTimeout(saveTimeoutRef.current)
  }, [answers])

  /* ─── Helpers ────────────────────────────────────────────── */

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const getQuestionStatus = (id: string) => {
    const a = answers[id]
    if (a?.marked) return 'marked'
    if (a?.answer) return 'answered'
    return 'unanswered'
  }

  const getStatusStyle = (status: string, isCurrent: boolean) => {
    const ring = isCurrent ? 'ring-2 ring-primary scale-110' : ''
    if (status === 'answered') return `bg-emerald-500 text-white ${ring}`
    if (status === 'marked') return `bg-amber-400 text-white ${ring}`
    return `bg-gray-100 text-gray-600 ${ring}`
  }

  if (loading) return <div className="h-screen flex items-center justify-center font-bold">Starting Quiz...</div>

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion.id]

  /* ─── UI Components ────────────────────────────────── */

  const StatsPanelContent = () => (
    <div className="flex flex-col h-full space-y-6">
      <div className={`p-6 rounded-2xl text-center text-white ${timeLeft < 60 ? 'bg-red-500 animate-pulse' : 'bg-primary'}`}>
        <p className="text-[10px] uppercase font-bold opacity-70">Time Remaining</p>
        <p className="text-4xl font-black">{formatTime(timeLeft)}</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuestionIndex(i)}
            className={`aspect-square rounded-lg font-bold text-xs transition-all ${getStatusStyle(getQuestionStatus(q.id), i === currentQuestionIndex)}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Attempted:</span>
          <span className="font-bold text-emerald-600">{Object.values(answers).filter(a => a.answer).length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Marked for Review:</span>
          <span className="font-bold text-amber-500">{Object.values(answers).filter(a => a.marked).length}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="font-bold text-slate-800">{quiz?.title}</h1>
          <p className="text-xs text-slate-400">Question {currentQuestionIndex + 1} of {questions.length}</p>
        </div>
        <Button onClick={() => handleSubmit()} disabled={submitting} className="bg-primary hover:bg-primary/90">
          {submitting ? 'Submitting...' : 'Finish Quiz'}
        </Button>
      </header>

      <div className="flex-1 flex max-w-screen-xl mx-auto w-full overflow-hidden">
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
              <Badge className="bg-slate-800">Question {currentQuestionIndex + 1}</Badge>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Mark for Review</span>
                <Switch 
                  checked={currentAnswer?.marked || false} 
                  onCheckedChange={() => handleToggleMarked(currentQuestion.id)} 
                />
              </div>
            </div>

            <div className="p-6 lg:p-10 space-y-8">
              <p className="text-xl font-medium text-slate-800 leading-relaxed">
                {currentQuestion.question_text}
              </p>

              {currentQuestion.question_type === 'mcq' && (
                <RadioGroup value={currentAnswer?.answer || ''} onValueChange={(val) => handleAnswerChange(currentQuestion.id, val)} className="grid gap-3">
                  {Object.entries(currentQuestion.options as any).map(([key, value]) => (
                    <div 
                      key={key} 
                      onClick={() => handleAnswerChange(currentQuestion.id, key)}
                      className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${currentAnswer?.answer === key ? 'border-primary bg-primary/5' : 'hover:bg-slate-50 border-slate-100'}`}
                    >
                      <RadioGroupItem value={key} id={key} />
                      <Label htmlFor={key} className="flex-1 font-medium cursor-pointer">{key}. {value as string}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.question_type === 'integer' && (
                <Input 
                  type="number" 
                  placeholder="Enter your numeric answer..." 
                  className="h-14 text-lg"
                  value={currentAnswer?.answer || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                />
              )}

              {currentQuestion.question_type === 'paragraph' && (
                <Textarea 
                  placeholder="Type your detailed answer here..." 
                  className="min-h-[200px] text-lg"
                  value={currentAnswer?.answer || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                />
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t flex justify-between">
              <Button 
                variant="outline" 
                disabled={currentQuestionIndex === 0} 
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button 
                disabled={currentQuestionIndex === questions.length - 1} 
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              >
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </main>

        <aside className="hidden lg:flex w-80 bg-white border-l p-6 flex-col">
          <StatsPanelContent />
        </aside>
      </div>
    </div>
  )
}

  /* ─── Handlers ───────────────────────────────────────────── */

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, answer, marked: prev[questionId]?.marked || false },
    }))
  }

  const handleToggleMarked = (questionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        answer: prev[questionId]?.answer || '',
        marked: !prev[questionId]?.marked,
      },
    }))
  }

  const handleSubmit = async (isAuto = false) => {
    if (!attempt || !quiz) return

    if (!isAuto) {
      const confirmed = confirm('Are you sure you want to submit? You cannot change answers after submission.')
      if (!confirmed) return
    }
    setSubmitting(true)

    let totalScore = 0
    questions.forEach(q => {
      const ua = answers[q.id]?.answer?.trim()
      if (!ua || q.question_type === 'paragraph') return
      const correctAns = q.correct_answer || ''
      const correct = q.question_type === 'mcq'
        ? ua.toUpperCase() === correctAns.toUpperCase()
        : ua === correctAns
      if (correct) totalScore += q.marks
    })

    const { error } = await supabase
      .from('quiz_attempts')
      .update({
        submitted_at: new Date().toISOString(),
        answers,
        score: totalScore,
        is_evaluated: !questions.some(q => q.question_type === 'paragraph'),
      })
      .eq('id', attempt.id)

    if (error) {
      console.error('Submit error:', error)
      toast.error('Failed to submit quiz')
      setSubmitting(false)
      return
    }

    toast.success(isAuto ? 'Quiz auto-submitted successfully!' : 'Quiz submitted successfully!')
    window.location.href = `/quiz/${quizId}/result`
  }

  const handleAutoSubmit = async () => {
    toast.info('Time is up! Auto-submitting...')
    await handleSubmit(true)
  }

  /* ─── Anti-Cheat Logic ───────────────────────────────────── */

  useEffect(() => {
    initializeAttempt()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setWarningCount(prev => {
          const newCount = prev + 1
          if (newCount === 1) toast.warning('Warning 1/3: Do not switch tabs.', { duration: 5000 })
          if (newCount === 2) toast.warning('Warning 2/3: Next switch will auto-submit!', { duration: 5000 })
          if (newCount === 3) toast.error('Cheating Detected! Auto-submitting...')
          return newCount
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (!attempt || submitting) return
    if (warningCount > 0) {
      supabase.from('quiz_attempts').update({ warning_count: warningCount }).eq('id', attempt.id).then()
    }
    if (warningCount >= 3) {
      handleSubmit(true)
    }
  }, [warningCount])

  /* ─── Other Effects ──────────────────────────────────────── */

  useEffect(() => {
    if (timeLeft <= 0 || !attempt || attempt.submitted_at) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleAutoSubmit(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft, attempt])

  useEffect(() => {
    if (!attempt || attempt.submitted_at) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(saveAnswers, 500)
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [answers])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setStatsOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* ─── Helpers ────────────────────────────────────────────── */

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const getQuestionStatus = (id: string) => {
    const a = answers[id]
    if (a?.marked) return 'marked'
    if (a?.answer) return 'answered'
    return 'unanswered'
  }

  const getStatusStyle = (status: string, isCurrent: boolean) => {
    const ring = isCurrent ? 'ring-2 ring-offset-1 ring-primary scale-110' : ''
    if (status === 'answered') return `bg-emerald-500 text-white ${ring}`
    if (status === 'marked') return `bg-amber-400 text-white ${ring}`
    return `bg-gray-100 text-gray-600 hover:bg-gray-200 ${ring}`
  }

  /* ─── Derived stats ──────────────────────────────────────── */

  const attempted = Object.values(answers).filter(a => a.answer).length
  const markedCount = Object.values(answers).filter(a => a.marked).length
  const unattempted = questions.length - attempted
  const totalPossible = questions.reduce((sum, q) => sum + q.marks, 0)

  const urgentTime = timeLeft < 300
  const criticalTime = timeLeft < 60

  /* ─── Loading ────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (!quiz || !questions.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm w-full">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Quiz not available</h3>
          <p className="text-muted-foreground text-sm mb-6">
            This quiz has no questions or is unavailable.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="w-full">
            Go to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion.id]

  /* ─── Stats Panel Content ────────────────────────────────── */

  const StatsPanelContent = () => (
    <div className="flex flex-col h-full">
      {/* Timer */}
      <div className={`rounded-2xl p-5 mb-5 text-center transition-colors duration-500 ${
        criticalTime ? 'bg-red-600 text-white' : urgentTime ? 'bg-amber-500 text-white' : 'bg-primary text-white'
      }`}>
        <Clock className="w-6 h-6 mx-auto mb-1 opacity-80" />
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Time Left</p>
        <p className={`font-mono font-bold leading-none ${criticalTime ? 'text-4xl animate-pulse' : 'text-4xl'}`}>
          {formatTime(timeLeft)}
        </p>
        {urgentTime && (
          <p className="text-xs mt-2 opacity-90 font-medium">
            {criticalTime ? 'Last minute!' : 'Running low on time!'}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
          <span>Progress</span>
          <span>{Math.round((attempted / questions.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(attempted / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{attempted}</p>
          <p className="text-xs text-emerald-700 font-medium mt-0.5">Attempted</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-500">{unattempted}</p>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Unattempted</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{markedCount}</p>
          <p className="text-xs text-amber-700 font-medium mt-0.5">Marked</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalPossible}</p>
          <p className="text-xs text-blue-700 font-medium mt-0.5">Total Marks</p>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legend</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-md bg-emerald-500 flex-shrink-0" />
            <span className="text-gray-600">Answered</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-md bg-amber-400 flex-shrink-0" />
            <span className="text-gray-600">Marked for review</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-md bg-gray-100 border border-gray-300 flex-shrink-0" />
            <span className="text-gray-600">Not answered</span>
          </div>
        </div>
      </div>

      {/* Question Grid */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Questions</p>
      <div className="grid grid-cols-5 gap-1.5 flex-1 content-start">
        {questions.map((q, i) => {
          const status = getQuestionStatus(q.id)
          return (
            <button
              key={q.id}
              onClick={() => { setCurrentQuestionIndex(i); setStatsOpen(false) }}
              className={`
                aspect-square rounded-lg text-xs font-bold transition-all duration-150
                flex items-center justify-center
                ${getStatusStyle(status, i === currentQuestionIndex)}
              `}
              aria-label={`Go to question ${i + 1}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {/* Tab switch warning */}
      {warningCount > 0 && (
        <div className={`mt-4 p-3 rounded-xl border ${
          warningCount >= 2 ? 'bg-red-100 border-red-300' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
              warningCount >= 2 ? 'text-red-600' : 'text-amber-500'
            }`} />
            <div className="text-xs">
              <p className={`font-bold ${warningCount >= 2 ? 'text-red-800' : 'text-amber-800'}`}>
                Strike {warningCount}/3 — Anti-Cheat Active
              </p>
              <p className={`mt-0.5 ${warningCount >= 2 ? 'text-red-700' : 'text-amber-700'}`}>
                {warningCount >= 2
                  ? 'Next tab switch will auto-submit!'
                  : 'Do not switch tabs during the quiz.'}
              </p>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3].map(i => (
                  <span
                    key={i}
                    className={`w-5 h-2 rounded-full ${i <= warningCount ? 'bg-red-500' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  /* ─── Render ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Top Header ── */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{quiz.title}</h1>
            <p className="text-xs text-muted-foreground">
              Q{currentQuestionIndex + 1} / {questions.length}
            </p>
          </div>

          {/* Desktop timer */}
          <div className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg transition-colors duration-300 ${
            criticalTime ? 'bg-red-100 text-red-700 animate-pulse' : urgentTime ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
          }`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>

          {/* Mobile timer */}
          <div className={`flex lg:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-sm transition-colors duration-300 ${
            criticalTime ? 'bg-red-100 text-red-700 animate-pulse' : urgentTime ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            {formatTime(timeLeft)}
          </div>

          <Button
            onClick={() => handleSubmit()}
            disabled={submitting}
            size="sm"
            className="gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{submitting ? 'Submitting...' : 'Submit'}</span>
            <span className="sm:hidden">Submit</span>
          </Button>
        </div>
      </header>

      {/* ── Main Body ── */}
      <div className="flex-1 flex max-w-screen-xl mx-auto w-full">

        {/* ── Left: Question Area (75%) ── */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-y-auto">
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">

            {/* Question header */}
            <div className="p-5 lg:p-6 border-b bg-gradient-to-r from-slate-50 to-white rounded-t-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                      Q{currentQuestionIndex + 1}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full uppercase tracking-wide">
                      {currentQuestion.question_type}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
                    </span>
                  </div>
                  <p className="text-base lg:text-lg font-medium text-foreground leading-relaxed">
                    {currentQuestion.question_text}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <Switch
                    checked={currentAnswer?.marked || false}
                    onCheckedChange={() => handleToggleMarked(currentQuestion.id)}
                  />
                  <div className="flex items-center gap-1">
                    <Flag className={`w-3.5 h-3.5 ${currentAnswer?.marked ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    <span className="text-[10px] text-muted-foreground font-medium">Review</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Answer area */}
            <div className="p-5 lg:p-6">
              {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
                <RadioGroup
                  value={currentAnswer?.answer || ''}
                  onValueChange={val => handleAnswerChange(currentQuestion.id, val)}
                  className="space-y-3"
                >
                  {Object.entries(currentQuestion.options).map(([key, value]) =>
                    value ? (
                      <div
                        key={key}
                        className={`flex items-center gap-4 p-4 lg:p-5 border-2 rounded-xl cursor-pointer transition-all duration-150 group ${
                          currentAnswer?.answer === key
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => handleAnswerChange(currentQuestion.id, key)}
                      >
                        <RadioGroupItem value={key} id={`opt-${key}`} className="shrink-0" />
                        <Label
                          htmlFor={`opt-${key}`}
                          className="flex-1 cursor-pointer text-sm lg:text-base leading-relaxed min-h-[44px] flex items-center"
                        >
                          <span className={`font-bold mr-3 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs border ${
                            currentAnswer?.answer === key
                              ? 'bg-primary text-white border-primary'
                              : 'border-gray-300 text-gray-500 group-hover:border-gray-400'
                          }`}>
                            {key}
                          </span>
                          {value}
                        </Label>
                      </div>
                    ) : null
                  )}
                </RadioGroup>
              )}

              {currentQuestion.question_type === 'integer' && (
                <div>
                  <Label htmlFor="int-ans" className="text-sm font-semibold mb-2 block">Enter your answer</Label>
                  <Input
                    id="int-ans"
                    type="number"
                    placeholder="Type a number..."
                    value={currentAnswer?.answer || ''}
                    onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="text-lg h-14 max-w-xs"
                  />
                </div>
              )}

              {currentQuestion.question_type === 'paragraph' && (
                <div>
                  <Label htmlFor="para-ans" className="text-sm font-semibold mb-2 block">Your answer</Label>
                  <Textarea
                    id="para-ans"
                    placeholder="Write your answer here..."
                    value={currentAnswer?.answer || ''}
                    onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                    rows={8}
                    className="resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Navigation footer */}
            <div className="px-5 lg:px-6 pb-5 lg:pb-6 flex items-center justify-between gap-3 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="hidden sm:flex items-center gap-1 overflow-hidden max-w-[200px]">
                {questions.slice(
                  Math.max(0, currentQuestionIndex - 3),
                  Math.min(questions.length, currentQuestionIndex + 4)
                ).map((q, i) => {
                  const actualIndex = Math.max(0, currentQuestionIndex - 3) + i
                  const status = getQuestionStatus(q.id)
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(actualIndex)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        actualIndex === currentQuestionIndex
                          ? 'w-4 bg-primary'
                          : status === 'answered'
                          ? 'bg-emerald-400'
                          : status === 'marked'
                          ? 'bg-amber-400'
                          : 'bg-gray-300'
                      }`}
                    />
                  )
                })}
              </div>

              <Button
                size="sm"
                onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={currentQuestionIndex === questions.length - 1}
                className="gap-1.5"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          
        </main>

        {/* ── Right: Stats Sidebar (desktop only, 25%) ── */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 border-l bg-white p-5 overflow-y-auto shrink-0">
          <StatsPanelContent />
        </aside>
      </div>

      {/* ── Mobile: Floating "View Stats" button ── */}
      <button
        onClick={() => setStatsOpen(true)}
        className="
          lg:hidden fixed bottom-6 right-4 z-40
          flex items-center gap-2
          bg-primary text-white
          px-4 py-3 rounded-full shadow-lg
          font-semibold text-sm
          active:scale-95 transition-transform
          ring-4 ring-primary/20
        "
        aria-label="View quiz statistics"
      >
        <BarChart2 className="w-4 h-4" />
        View Stats
        {unattempted > 0 && (
          <span className="bg-white text-primary text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
            {unattempted}
          </span>
        )}
      </button>

      {/* ── Mobile Off-Canvas Stats Drawer ── */}
      <div
        className={`
          fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden
          ${statsOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setStatsOpen(false)}
        aria-hidden="true"
      />

      <div
        className={`
          fixed top-0 right-0 h-full z-50 w-[85vw] max-w-sm
          bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out lg:hidden
          ${statsOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Quiz statistics"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-foreground">Quiz Stats</h2>
          </div>
          <button
            onClick={() => setStatsOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close stats panel"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <StatsPanelContent />
        </div>

        <div className="p-4 border-t shrink-0">
          <Button
            onClick={() => { setStatsOpen(false); handleSubmit() }}
            disabled={submitting}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </Button>
        </div>
      </div>
    </div>
  )
}
