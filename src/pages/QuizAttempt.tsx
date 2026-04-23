import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Clock,
  Flag,
  Send,
  AlertTriangle,
  CheckCircle,
  X,
  BarChart2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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

      const { data: existingAttempt } = await supabase
        .from('quiz_attempts').select('*')
        .eq('quiz_id', quizId).eq('student_id', user.id).single()

      if (existingAttempt?.submitted_at) {
        toast.error('You have already submitted this quiz')
        navigate(`/quiz/${quizId}/result`)
        return
      }

      if (existingAttempt) {
        setAttempt(existingAttempt)
        setAnswers((existingAttempt.answers as Record<string, Answer>) || {})
        const elapsed = Math.floor((Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, quizRes.data.duration_minutes * 60 - elapsed))
        if (existingAttempt.warning_count) {
          setWarningCount(existingAttempt.warning_count)
        }
      } else {
        const { data: newAttempt, error } = await supabase
          .from('quiz_attempts')
          .insert({ quiz_id: quizId!, student_id: user.id, answers: {} })
          .select().single()
        if (error) throw error
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
    const { error } = await supabase
      .from('quiz_attempts').update({ answers }).eq('id', attempt.id)
    if (error) console.error('Save error:', error)
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

      {/* Legend & Grid Section */}
      <div className="grid grid-cols-2 gap-3 mb-5 text-center">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <p className="text-2xl font-bold text-emerald-600">{attempted}</p>
          <p className="text-[10px] text-emerald-700 font-black uppercase">Attempted</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="text-2xl font-bold text-gray-500">{unattempted}</p>
          <p className="text-[10px] text-gray-500 font-black uppercase">Skipped</p>
        </div>
      </div>

      {/* Question Grid */}
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Question Navigator</p>
      <div className="grid grid-cols-5 gap-1.5 mb-6">
        {questions.map((q, i) => {
          const status = getQuestionStatus(q.id)
          return (
            <button
              key={q.id}
              onClick={() => { setCurrentQuestionIndex(i); setStatsOpen(false) }}
              className={`aspect-square rounded-lg text-xs font-black transition-all ${getStatusStyle(status, i === currentQuestionIndex)}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {/* Tab switch warning */}
      {warningCount > 0 && (
        <div className={`mt-auto p-4 rounded-2xl border-2 ${warningCount >= 2 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex gap-3">
            <AlertTriangle className={warningCount >= 2 ? 'text-red-600' : 'text-amber-500'} />
            <div>
              <p className="text-xs font-black uppercase text-slate-800">Strike {warningCount}/3</p>
              <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">Switching tabs will auto-submit your quiz.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  /* ─── Render ─────────────────────────────────────────────── */

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion.id]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ── Top Header ── */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800 truncate">{quiz?.title}</h1>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-sm transition-colors ${
            criticalTime ? 'bg-red-100 text-red-700 animate-pulse' : urgentTime ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            {formatTime(timeLeft)}
          </div>

          <Button onClick={() => handleSubmit()} disabled={submitting} size="sm" className="bg-slate-900 font-bold px-4 rounded-xl">
            {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : 'Submit'}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex max-w-screen-xl mx-auto w-full pb-24 lg:pb-0">
        {/* ── Left: Question Area ── */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-y-auto">
          <Card className="shadow-sm border-0 ring-1 ring-gray-200 rounded-[2rem] overflow-hidden">
            {/* Question Header */}
            <div className="p-6 lg:p-8 border-b bg-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Badge className="bg-indigo-600 font-black italic px-3 py-0.5">Q{currentQuestionIndex + 1}</Badge>
                    <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-400">{currentQuestion.marks} Marks</Badge>
                  </div>

                  {/* 🔥 IMAGE DISPLAY FIX 🔥 */}
                  {currentQuestion.image_url && (
                    <div className="mb-6 rounded-2xl overflow-hidden border-2 border-slate-100 bg-white flex justify-center p-2 shadow-sm">
                      <img 
                        src={currentQuestion.image_url} 
                        alt="Question Visual" 
                        className="max-h-[350px] w-auto object-contain rounded-xl cursor-zoom-in"
                        onClick={() => window.open(currentQuestion.image_url, '_blank')}
                      />
                    </div>
                  )}

                  <p className="text-lg lg:text-xl font-bold text-slate-800 leading-tight">
                    {currentQuestion.question_text}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <Switch checked={currentAnswer?.marked || false} onCheckedChange={() => handleToggleMarked(currentQuestion.id)} />
                  <span className="text-[10px] font-black uppercase text-slate-400">Review</span>
                </div>
              </div>
            </div>

            {/* Answer Options */}
            <div className="p-6 lg:p-8 bg-slate-50/50">
              {currentQuestion.question_type === 'mcq' && (
                <RadioGroup value={currentAnswer?.answer || ''} onValueChange={val => handleAnswerChange(currentQuestion.id, val)} className="space-y-3">
                  {Object.entries(currentQuestion.options || {}).map(([key, value]) => (
                    value && (
                      <div key={key} onClick={() => handleAnswerChange(currentQuestion.id, key)} 
                        className={`flex items-center gap-4 p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                          currentAnswer?.answer === key ? 'border-indigo-600 bg-indigo-50/50' : 'border-white bg-white hover:border-slate-200'
                        }`}
                      >
                        <RadioGroupItem value={key} id={key} />
                        <Label htmlFor={key} className="flex-1 font-bold text-slate-700 cursor-pointer flex items-center">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xs font-black border-2 ${
                            currentAnswer?.answer === key ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-400 border-slate-100'
                          }`}>{key}</span>
                          {value as string}
                        </Label>
                      </div>
                    )
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.question_type === 'integer' && (
                <div className="max-w-xs">
                  <Input type="number" placeholder="Enter number..." value={currentAnswer?.answer || ''} 
                    onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="h-14 text-xl font-bold rounded-2xl border-2 border-slate-200 focus:border-indigo-600"
                  />
                </div>
              )}

              {currentQuestion.question_type === 'paragraph' && (
                <Textarea placeholder="Write your answer..." value={currentAnswer?.answer || ''} 
                  onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                  className="rounded-2xl p-4 min-h-[150px] border-2 border-slate-200"
                />
              )}
            </div>

            {/* Navigation Footer */}
            <div className="px-6 py-6 border-t bg-white flex justify-between">
              <Button variant="outline" onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0} className="rounded-xl font-bold">
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))} disabled={currentQuestionIndex === questions.length - 1} className="rounded-xl font-bold bg-slate-900">
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </main>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-80 border-l bg-white p-6 overflow-y-auto">
          <StatsPanelContent />
        </aside>
      </div>

      {/* 🔥 MOBILE FLOATING BUTTON FIX (Overlap prevention) 🔥 */}
      <button
        onClick={() => setStatsOpen(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl font-black italic uppercase text-xs tracking-widest ring-4 ring-indigo-200"
      >
        <BarChart2 className="w-4 h-4" />
        Summary ({unattempted})
      </button>

      {/* Stats Drawer (Mobile) */}
      <div className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity ${statsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setStatsOpen(false)} />
      <div className={`fixed right-0 top-0 h-full w-[85vw] max-w-sm bg-white z-50 transition-transform duration-300 ${statsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="font-black italic text-slate-800">QUIZ PROGRESS</h2>
          <Button variant="ghost" size="icon" onClick={() => setStatsOpen(false)}><X /></Button>
        </div>
        <div className="p-5 h-full overflow-y-auto">
          <StatsPanelContent />
        </div>
      </div>
    </div>
  )
}
