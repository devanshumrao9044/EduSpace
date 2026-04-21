import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Clock, Flag, Send, AlertTriangle, X, BarChart2,
  ChevronLeft, ChevronRight, CheckCircle
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
import type { Quiz, Question } from '@/types/database'

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

      // Fetch Quiz and Questions
      const [quizRes, questionsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number', { ascending: true }),
      ])

      if (quizRes.error) throw quizRes.error
      if (questionsRes.error) throw questionsRes.error

      setQuiz(quizRes.data)
      setQuestions(questionsRes.data || [])

      // Create a fresh attempt record for re-attempts
      const { data: newAttempts, error: insertError } = await supabase
        .from('quiz_attempts')
        .insert([
          {
            quiz_id: quizId!,
            student_id: user.id,
            answers: {},
            started_at: new Date().toISOString(),
            is_evaluated: false,
            warning_count: 0
          }
        ])
        .select()

      if (insertError) throw insertError
      if (!newAttempts || newAttempts.length === 0) throw new Error("Attempt creation failed")

      setAttempt(newAttempts[0])
      setTimeLeft(quizRes.data.duration_minutes * 60)

      const now = new Date()
      const endTime = new Date(quizRes.data.end_time)
      if (now > endTime) {
        toast.info("Practice Mode: Test deadline ke baad diya ja raha hai.")
      }

    } catch (error: any) {
      console.error('Initialization Failed:', error)
      toast.error('Failed to start quiz!')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

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
    if (!attempt || !quiz || submitting) return

    if (!isAuto) {
      const confirmed = window.confirm('Bhai, pakka submit karna hai?')
      if (!confirmed) return
    }
    
    setSubmitting(true)

    // Calculate score locally
    let totalScore = 0
    questions.forEach(q => {
      const ua = answers[q.id]?.answer?.trim()
      if (!ua || q.question_type === 'paragraph') return
      
      const correctAns = q.correct_answer?.trim() || ''
      const isCorrect = ua.toUpperCase() === correctAns.toUpperCase()
      if (isCorrect) totalScore += q.marks
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
      toast.error('Submission failed!')
      setSubmitting(false)
      return
    }

    toast.success(isAuto ? 'Auto-submitted!' : 'Success!')
    
    // ✅ FINAL FIX: Navigate with correct order (ID then result)
    navigate(`/quiz/${quizId}/result`)
  }

  const handleAutoSubmit = async () => {
    if (!submitting) await handleSubmit(true)
  }

  /* ─── Anti-Cheat & Effects ───────────────────────────────── */

  useEffect(() => {
    initializeAttempt()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !submitting) {
        setWarningCount(prev => {
          const newCount = prev + 1
          if (newCount === 1) toast.warning('Warning 1/3: Tab switch mat karo!')
          if (newCount === 2) toast.error('Warning 2/3: Agli baar auto-submit ho jayega!')
          return newCount
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (warningCount >= 3 && !submitting) handleSubmit(true)
  }, [warningCount])

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

  const getStatusStyle = (id: string, isCurrent: boolean) => {
    const a = answers[id]
    const ring = isCurrent ? 'ring-2 ring-primary scale-110' : ''
    if (a?.marked) return `bg-amber-400 text-white ${ring}`
    if (a?.answer) return `bg-emerald-500 text-white ${ring}`
    return `bg-gray-100 text-gray-600 ${ring}`
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center animate-pulse">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-bold text-slate-600 tracking-widest uppercase">Preparing Quiz...</p>
      </div>
    </div>
  )

  if (!quiz || !questions.length) return null

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion.id]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex-1 truncate">
          <h1 className="font-bold text-slate-800 text-lg truncate">{quiz.title}</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Question {currentQuestionIndex + 1} / {questions.length}</p>
        </div>
        <div className="flex items-center gap-4">
           <div className={`hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold border ${timeLeft < 60 ? 'border-red-500 text-red-600 animate-pulse' : 'border-slate-200 text-slate-600'}`}>
             <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
           </div>
           <Button onClick={() => handleSubmit()} disabled={submitting} className="font-bold shadow-md px-6">
             {submitting ? 'FINISHING...' : 'FINISH'}
           </Button>
        </div>
      </header>

      <div className="flex-1 flex max-w-screen-xl mx-auto w-full">
        <main className="flex-1 p-4 lg:p-10 overflow-y-auto">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <div className="p-6 bg-slate-50/80 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-black text-sm">{currentQuestionIndex + 1}</span>
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">{currentQuestion.question_type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Review Later</span>
                <Switch checked={currentAnswer?.marked || false} onCheckedChange={() => handleToggleMarked(currentQuestion.id)} />
              </div>
            </div>

            <div className="p-8 lg:p-12 min-h-[300px]">
              <p className="text-xl lg:text-2xl font-bold text-slate-800 leading-snug mb-10">{currentQuestion.question_text}</p>

              {currentQuestion.question_type === 'mcq' && (
                <RadioGroup value={currentAnswer?.answer || ''} onValueChange={(val) => handleAnswerChange(currentQuestion.id, val)} className="grid gap-4">
                  {Object.entries(currentQuestion.options as any).map(([key, value]) => (
                    <div 
                      key={key} 
                      onClick={() => handleAnswerChange(currentQuestion.id, key)}
                      className={`flex items-center gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all ${currentAnswer?.answer === key ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <RadioGroupItem value={key} id={key} />
                      <Label htmlFor={key} className="flex-1 font-semibold text-base cursor-pointer">
                        <span className="mr-3 text-slate-400">{key}.</span> {value as string}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.question_type === 'integer' && (
                <div className="max-w-md mx-auto">
                  <Input 
                    type="number" 
                    placeholder="Type number answer..." 
                    className="h-16 text-2xl font-bold text-center border-2 border-slate-100 focus:border-primary rounded-2xl"
                    value={currentAnswer?.answer || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  />
                </div>
              )}

              {currentQuestion.question_type === 'paragraph' && (
                <Textarea 
                  placeholder="Type your detailed answer..." 
                  className="min-h-[250px] text-lg p-6 border-2 border-slate-100 focus:border-primary rounded-2xl resize-none"
                  value={currentAnswer?.answer || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                />
              )}
            </div>

            <div className="p-6 bg-slate-50/50 border-t flex justify-between">
              <Button variant="ghost" className="font-bold" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(prev => prev - 1)}>
                <ChevronLeft className="mr-2 h-5 w-5" /> Previous
              </Button>
              <Button variant="secondary" className="font-bold px-8" disabled={currentQuestionIndex === questions.length - 1} onClick={() => setCurrentQuestionIndex(prev => prev + 1)}>
                Next <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </Card>
        </main>

        <aside className="hidden lg:flex w-80 xl:w-96 bg-white border-l p-8 flex-col shadow-inner">
          <div className="space-y-6">
            <div className={`p-6 rounded-2xl text-center text-white shadow-lg ${timeLeft < 60 ? 'bg-red-500 animate-pulse' : 'bg-primary'}`}>
              <Clock className="w-6 h-6 mx-auto mb-1 opacity-70" />
              <p className="text-[10px] font-bold opacity-70 uppercase">Time Left</p>
              <p className="text-4xl font-black">{formatTime(timeLeft)}</p>
            </div>
            <div className="grid grid-cols-5 gap-2 overflow-y-auto max-h-[400px] p-1">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(i)}
                  className={`aspect-square rounded-lg font-bold text-xs transition-all ${getStatusStyle(q.id, i === currentQuestionIndex)}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <button onClick={() => setStatsOpen(true)} className="lg:hidden fixed bottom-6 right-6 z-40 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-2 font-bold transition-transform active:scale-95">
        <BarChart2 className="w-5 h-5" /> STATS
      </button>

      {statsOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setStatsOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[80%] bg-white p-6 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center mb-8 font-black text-xl">Status <Button variant="ghost" size="icon" onClick={() => setStatsOpen(false)}><X/></Button></div>
            <div className="grid grid-cols-4 gap-2 overflow-y-auto">
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => { setCurrentQuestionIndex(i); setStatsOpen(false) }} className={`aspect-square rounded-lg font-bold text-xs ${getStatusStyle(q.id, i === currentQuestionIndex)}`}>{i + 1}</button>
              ))}
            </div>
            <Button onClick={() => handleSubmit()} className="w-full mt-auto h-14 font-black">SUBMIT QUIZ</Button>
          </div>
        </div>
      )}
    </div>
  )
}
