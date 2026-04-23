import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Flag, Send, AlertTriangle, CheckCircle, X, BarChart2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
import type { Quiz, Question, QuizAttempt as AttemptType } from '@/types/database'

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
  const [attempt, setAttempt] = useState<AttemptType | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [warningCount, setWarningCount] = useState(0)
  const [statsOpen, setStatsOpen] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  /* ─── Data Initialization ─────────────────── */

  useEffect(() => {
    if (quizId) initializeAttempt()
  }, [quizId])

  const initializeAttempt = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return }

      const [quizRes, questionsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number'),
      ])
      if (quizRes.error) throw quizRes.error
      setQuiz(quizRes.data)
      setQuestions(questionsRes.data || [])

      const { data: existingAttempt } = await supabase
        .from('quiz_attempts').select('*')
        .eq('quiz_id', quizId).eq('student_id', user.id).maybeSingle()

      if (existingAttempt?.submitted_at) {
        navigate(`/quiz/${quizId}/result`)
        return
      }

      if (existingAttempt) {
        setAttempt(existingAttempt)
        setAnswers((existingAttempt.answers as Record<string, Answer>) || {})
        const elapsed = Math.floor((Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, quizRes.data.duration_minutes * 60 - elapsed))
        setWarningCount(existingAttempt.warning_count || 0)
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
      toast.error('Failed to start quiz')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const saveAnswers = async () => {
    if (!attempt || attempt.submitted_at) return
    await supabase.from('quiz_attempts').update({ answers, warning_count: warningCount }).eq('id', attempt.id)
  }

  /* ─── Handlers ────────────────────────────── */

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, answer, marked: prev[questionId]?.marked || false },
    }))
  }

  const handleToggleMarked = (questionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, answer: prev[questionId]?.answer || '', marked: !prev[questionId]?.marked },
    }))
  }

  const handleSubmit = async (isAuto = false) => {
    if (!attempt || !quiz || submitting) return
    if (!isAuto && !confirm('Submit test?')) return
    
    setSubmitting(true)
    let totalScore = 0
    questions.forEach(q => {
      const ua = answers[q.id]?.answer?.trim().toUpperCase()
      const ca = q.correct_answer?.trim().toUpperCase()
      if (!ua) return
      if (ua === ca) totalScore += q.marks
      else if (q.negative_marks) totalScore -= q.negative_marks
    })

    const { error } = await supabase.from('quiz_attempts').update({
      submitted_at: new Date().toISOString(),
      answers,
      score: totalScore,
      is_evaluated: true
    }).eq('id', attempt.id)

    if (error) {
      toast.error('Submission failed')
      setSubmitting(false)
    } else {
      navigate(`/quiz/${quizId}/result`)
    }
  }

  /* ─── Effects ─────────────────────────────── */

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(true); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft])

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(saveAnswers, 1000)
  }, [answers, warningCount])

  /* ─── UI Helpers ──────────────────────────── */

  const formatTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  const attempted = Object.values(answers).filter(a => a.answer).length
  const unattempted = questions.length - attempted

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-black italic animate-pulse text-indigo-600">PREPARING QUIZ...</div>

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion?.id]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* HEADER */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-800 truncate text-sm sm:text-base">{quiz?.title}</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Q{currentQuestionIndex + 1} / {questions.length}</p>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-black text-sm ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
          <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
        </div>

        <Button onClick={() => handleSubmit()} disabled={submitting} size="sm" className="ml-3 bg-slate-900 rounded-xl font-bold">
          {submitting ? <Loader2 className="animate-spin w-4 h-4"/> : 'Submit'}
        </Button>
      </header>

      {/* MAIN BODY */}
      <div className="flex-1 flex max-w-screen-xl mx-auto w-full pb-28 lg:pb-0">
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            
            <div className="p-6 lg:p-8 border-b">
               <div className="flex justify-between items-start gap-4 mb-6">
                 <div>
                    <Badge className="bg-indigo-600 mb-2 italic px-3 py-0.5 font-black">QUESTION {currentQuestionIndex+1}</Badge>
                    <p className="text-lg lg:text-xl font-bold text-slate-800 leading-tight">{currentQuestion.question_text}</p>
                 </div>
                 <div className="flex flex-col items-center">
                    <Switch checked={currentAnswer?.marked || false} onCheckedChange={() => handleToggleMarked(currentQuestion.id)} />
                    <span className="text-[10px] font-black text-slate-400 mt-1 uppercase">Review</span>
                 </div>
               </div>

               {/* 🔥 IMAGE FIX: Only show if URL exists 🔥 */}
               {currentQuestion.image_url && (
                 <div className="mb-6 rounded-2xl border-2 border-slate-50 overflow-hidden bg-white flex justify-center p-2 shadow-sm">
                   <img src={currentQuestion.image_url} alt="Question content" className="max-h-[350px] w-auto object-contain cursor-zoom-in rounded-xl" onClick={() => window.open(currentQuestion.image_url, '_blank')} />
                 </div>
               )}
            </div>

            <div className="p-6 lg:p-8 bg-slate-50/30">
               {currentQuestion.question_type === 'mcq' && (
                 <RadioGroup value={currentAnswer?.answer || ''} onValueChange={val => handleAnswerChange(currentQuestion.id, val)} className="space-y-3">
                   {Object.entries(currentQuestion.options || {}).map(([key, val]) => val && (
                     <div key={key} onClick={() => handleAnswerChange(currentQuestion.id, key)} className={`flex items-center gap-4 p-4 border-2 rounded-2xl cursor-pointer bg-white transition-all ${currentAnswer?.answer === key ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-slate-100'}`}>
                        <RadioGroupItem value={key} id={key} className="sr-only" />
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 ${currentAnswer?.answer === key ? 'bg-indigo-600 border-indigo-600 text-white' : 'text-slate-400 border-slate-100'}`}>{key}</span>
                        <Label className="font-bold text-slate-700 flex-1 cursor-pointer">{val as string}</Label>
                     </div>
                   ))}
                 </RadioGroup>
               )}

               {currentQuestion.question_type === 'integer' && (
                 <Input type="number" placeholder="Enter numeric answer" value={currentAnswer?.answer || ''} onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)} className="h-16 text-xl font-bold rounded-2xl border-2 border-slate-100 focus:border-indigo-600" />
               )}
            </div>

            {/* NAV BUTTONS */}
            <div className="p-6 flex justify-between bg-white border-t">
               <Button variant="outline" className="rounded-xl font-bold px-6" onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev-1))} disabled={currentQuestionIndex === 0}><ChevronLeft className="mr-2 h-4 w-4"/> Prev</Button>
               <Button className="rounded-xl font-bold px-8 bg-slate-900" onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length-1, prev+1))} disabled={currentQuestionIndex === questions.length-1}>Next <ChevronRight className="ml-2 h-4 w-4"/></Button>
            </div>
          </Card>
        </main>

        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-80 border-l bg-white p-6 overflow-y-auto">
          <p className="font-black text-slate-800 mb-4 italic uppercase tracking-widest text-xs">Navigator</p>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => setCurrentQuestionIndex(i)} className={`h-10 rounded-lg text-xs font-black transition-all ${currentQuestionIndex === i ? 'ring-4 ring-indigo-100 bg-indigo-600 text-white' : answers[q.id]?.marked ? 'bg-amber-400 text-white' : answers[q.id]?.answer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{i+1}</button>
            ))}
          </div>
        </aside>
      </div>

      {/* MOBILE STATS BUTTON (FIXED OVERLAP) */}
      <button onClick={() => setStatsOpen(true)} className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl font-black italic uppercase text-[10px] tracking-widest flex items-center gap-2 ring-4 ring-white">
        <BarChart2 className="w-4 h-4"/> Summary ({attempted}/{questions.length})
      </button>

      {/* STATS DRAWER (Mobile Only) */}
      {statsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex items-end justify-center" onClick={() => setStatsOpen(false)}>
           <div className="bg-white w-full rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              <div className="grid grid-cols-5 gap-3 mb-8">
                {questions.map((q, i) => (
                  <button key={q.id} onClick={() => { setCurrentQuestionIndex(i); setStatsOpen(false); }} className={`h-12 rounded-xl text-xs font-black ${currentQuestionIndex === i ? 'bg-indigo-600 text-white' : answers[q.id]?.answer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{i+1}</button>
                ))}
              </div>
              <Button onClick={() => handleSubmit()} className="w-full h-14 bg-slate-900 rounded-2xl font-black italic uppercase tracking-widest text-sm">Finish & Submit</Button>
           </div>
        </div>
      )}
    </div>
  )
}

