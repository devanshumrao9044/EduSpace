import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, BarChart2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'

interface Answer {
  answer: string
  marked: boolean
}

export default function QuizAttempt() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [attempt, setAttempt] = useState<any>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  const saveTimeoutRef = useRef<any>()
  const submittingRef = useRef(false)

  useEffect(() => {
    if (quizId) init()
  }, [quizId])

  const init = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { window.location.replace('/login'); return }

      // ── Strict: redirect if already submitted ──
      const { data: exAt } = await supabase
        .from('quiz_attempts').select('*')
        .eq('quiz_id', quizId).eq('student_id', user.id).maybeSingle()

      if (exAt?.submitted_at) {
        window.location.replace(`/quiz/${quizId}/result`)
        return
      }

      const [qRes, qsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number'),
      ])

      setQuiz(qRes.data)
      setQuestions(qsRes.data || [])

      if (exAt) {
        setAttempt(exAt)
        setAnswers((exAt.answers as Record<string, Answer>) || {})
        const elapsed = Math.floor((Date.now() - new Date(exAt.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, qRes.data.duration_minutes * 60 - elapsed))
      } else {
        const { data: nAt, error } = await supabase
          .from('quiz_attempts')
          .insert({ quiz_id: quizId, student_id: user.id, answers: {} })
          .select().single()
        if (error) throw error
        setAttempt(nAt)
        setTimeLeft(qRes.data.duration_minutes * 60)
      }
    } catch {
      toast.error('Error loading quiz')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  // ── Auto-save answers every 2s ──
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      if (attempt && !attempt.submitted_at) {
        await supabase.from('quiz_attempts').update({ answers }).eq('id', attempt.id)
      }
    }, 2000)
  }, [answers, attempt])

  // ── Submission: await DB update, then hard-redirect with delay ──
  const handleSubmit = useCallback(async (auto = false) => {
    if (submittingRef.current) return
    if (!auto && !confirm('Are you sure you want to submit the test?')) return

    submittingRef.current = true
    setSubmitting(true)

    let score = 0
    questions.forEach(q => {
      const ua = answers[q.id]?.answer?.trim().toUpperCase()
      const ca = q.correct_answer?.trim().toUpperCase()
      if (!ua) return
      if (ua === ca) score += q.marks
      else if (q.negative_marks) score -= Number(q.negative_marks)
    })

    try {
      const { error } = await supabase.from('quiz_attempts').update({
        submitted_at: new Date().toISOString(),
        answers,
        score,
        is_evaluated: true,
      }).eq('id', attempt.id)

      if (error) throw error

      // ── Compute and persist ranks for all submitted attempts ──
      const { data: allAttempts } = await supabase
        .from('quiz_attempts')
        .select('id, score')
        .eq('quiz_id', quizId)
        .not('submitted_at', 'is', null)
        .order('score', { ascending: false })

      if (allAttempts && allAttempts.length > 0) {
        let currentRank = 1
        const rankUpdates = allAttempts.map((a, i) => {
          if (i > 0 && (a.score ?? 0) !== (allAttempts[i - 1].score ?? 0)) {
            currentRank = i + 1
          }
          return { id: a.id, rank: currentRank }
        })
        await Promise.all(
          rankUpdates.map(u =>
            supabase.from('quiz_attempts').update({ rank: u.rank }).eq('id', u.id)
          )
        )
      }

      // Small delay to ensure DB writes propagate before redirect
      await new Promise(res => setTimeout(res, 500))
      window.location.replace(`/quiz/${quizId}/result`)
    } catch {
      toast.error('Submission failed. Please try again.')
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [questions, answers, attempt, quizId])

  // ── Countdown timer ──
  useEffect(() => {
    if (loading || !attempt || submitting) return
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [loading, attempt, submitting, handleSubmit])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const attempted = Object.values(answers).filter(a => a?.answer).length

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <p className="font-black italic animate-pulse text-indigo-600 tracking-widest uppercase text-lg">Preparing Test...</p>
      </div>
    )
  }

  const q = questions[currentQuestionIndex]
  const ans = answers[q?.id]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── HEADER ── */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-800 truncate text-sm sm:text-base">{quiz?.title}</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
            Q{currentQuestionIndex + 1} / {questions.length}
          </p>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-black text-sm mx-3 ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
          <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
        </div>

        <Button
          onClick={() => handleSubmit()}
          disabled={submitting}
          size="sm"
          className="bg-slate-900 rounded-xl font-bold"
        >
          {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : 'Submit'}
        </Button>
      </header>

      {/* ── MAIN ── */}
      <div className="flex-1 flex max-w-screen-xl mx-auto w-full">
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto pb-40 lg:pb-8">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">

            {/* Question Header */}
            <div className="p-6 lg:p-8 border-b">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex-1">
                  <Badge className="bg-indigo-600 mb-3 italic px-3 py-0.5 font-black">
                    QUESTION {currentQuestionIndex + 1}
                  </Badge>
                  <p className="text-lg lg:text-xl font-bold text-slate-800 leading-snug">{q?.question_text}</p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <Switch
                    checked={ans?.marked || false}
                    onCheckedChange={() =>
                      setAnswers(prev => ({
                        ...prev,
                        [q.id]: { answer: prev[q.id]?.answer || '', marked: !prev[q.id]?.marked },
                      }))
                    }
                  />
                  <span className="text-[10px] font-black text-slate-400 mt-1 uppercase">Review</span>
                </div>
              </div>

              {/* ── IMAGE: only render when image_url is a non-empty string ── */}
              {q?.image_url && typeof q.image_url === 'string' && q.image_url.trim() !== '' && (
                <div className="mt-4 rounded-2xl border-2 border-slate-100 overflow-hidden bg-slate-50 flex justify-center p-3">
                  <img
                    src={q.image_url}
                    alt="Question visual"
                    className="max-h-[320px] w-auto object-contain rounded-xl cursor-zoom-in"
                    onClick={() => window.open(q.image_url, '_blank')}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
            </div>

            {/* Answer Area */}
            <div className="p-6 lg:p-8 bg-slate-50/30">
              {q?.question_type === 'mcq' ? (
                <div className="space-y-3">
                  {Object.entries(q.options || {}).map(([key, val]) =>
                    val ? (
                      <div
                        key={key}
                        onClick={() =>
                          setAnswers(prev => ({
                            ...prev,
                            [q.id]: { answer: key, marked: prev[q.id]?.marked || false },
                          }))
                        }
                        className={`flex items-center gap-4 p-4 border-2 rounded-2xl cursor-pointer bg-white transition-all select-none ${
                          ans?.answer === key
                            ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-sm'
                            : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 shrink-0 ${
                          ans?.answer === key ? 'bg-indigo-600 border-indigo-600 text-white' : 'text-slate-400 border-slate-100'
                        }`}>{key}</span>
                        <Label className="font-bold text-slate-700 flex-1 cursor-pointer">{val as string}</Label>
                      </div>
                    ) : null
                  )}
                </div>
              ) : (
                <Input
                  type="number"
                  placeholder="Enter numeric answer"
                  value={ans?.answer || ''}
                  onChange={e =>
                    setAnswers(prev => ({
                      ...prev,
                      [q.id]: { answer: e.target.value, marked: prev[q.id]?.marked || false },
                    }))
                  }
                  className="h-16 text-xl font-bold rounded-2xl border-2 border-slate-200 focus:border-indigo-600"
                />
              )}
            </div>

            {/* Desktop Nav inside card */}
            <div className="hidden lg:flex p-6 bg-white border-t justify-between items-center">
              <Button
                variant="outline"
                className="rounded-xl font-bold px-6"
                onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Prev
              </Button>
              <span className="text-sm font-bold text-slate-400">{attempted}/{questions.length} answered</span>
              <Button
                className="rounded-xl font-bold px-8 bg-slate-900"
                onClick={() => setCurrentQuestionIndex(p => Math.min(questions.length - 1, p + 1))}
                disabled={currentQuestionIndex === questions.length - 1}
              >
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </main>

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden lg:flex flex-col w-72 border-l bg-white p-6 overflow-y-auto shrink-0">
          <p className="font-black text-slate-800 mb-4 italic uppercase tracking-widest text-xs">Navigator</p>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {questions.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setCurrentQuestionIndex(i)}
                className={`h-10 rounded-lg text-xs font-black transition-all ${
                  currentQuestionIndex === i
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                    : answers[item.id]?.marked
                    ? 'bg-amber-400 text-white'
                    : answers[item.id]?.answer
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-auto space-y-2 text-xs font-bold text-slate-500">
            <div className="flex gap-2 items-center"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Answered</div>
            <div className="flex gap-2 items-center"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Marked for review</div>
            <div className="flex gap-2 items-center"><span className="w-3 h-3 rounded bg-slate-100 inline-block border" /> Not answered</div>
          </div>
        </aside>
      </div>

      {/* ── MOBILE: Fixed bottom nav ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t px-4 py-3 flex gap-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <Button
          variant="outline"
          className="flex-1 rounded-xl h-12 font-bold"
          onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Prev
        </Button>
        <Button
          className="flex-1 rounded-xl h-12 bg-slate-900 font-bold"
          onClick={() => setCurrentQuestionIndex(p => Math.min(questions.length - 1, p + 1))}
          disabled={currentQuestionIndex === questions.length - 1}
        >
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* ── MOBILE: Summary pill — sits above nav bar with enough clearance ── */}
      <button
        onClick={() => setStatsOpen(true)}
        className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-indigo-600 text-white px-5 py-2.5 rounded-full shadow-2xl font-black italic uppercase text-[10px] tracking-widest flex items-center gap-2 ring-4 ring-white"
      >
        <BarChart2 className="w-4 h-4" /> Summary ({attempted}/{questions.length})
      </button>

      {/* ── MOBILE: Stats Drawer ── */}
      {statsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex items-end justify-center"
          onClick={() => setStatsOpen(false)}
        >
          <div
            className="bg-white w-full rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <p className="font-black text-slate-700 uppercase tracking-widest text-xs mb-4 text-center italic">
              Question Navigator
            </p>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {questions.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => { setCurrentQuestionIndex(i); setStatsOpen(false) }}
                  className={`h-12 rounded-xl font-black text-xs transition-all ${
                    currentQuestionIndex === i
                      ? 'bg-indigo-600 text-white'
                      : answers[item.id]?.marked
                      ? 'bg-amber-400 text-white'
                      : answers[item.id]?.answer
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="flex gap-4 text-[10px] font-bold text-slate-500 mb-6 justify-center">
              <span><span className="inline-block w-2 h-2 rounded bg-emerald-500 mr-1" />Answered</span>
              <span><span className="inline-block w-2 h-2 rounded bg-amber-400 mr-1" />Review</span>
              <span><span className="inline-block w-2 h-2 rounded bg-slate-200 mr-1" />Skipped</span>
            </div>
            <Button
              onClick={() => handleSubmit()}
              disabled={submitting}
              className="w-full h-14 bg-slate-900 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-xl"
            >
              {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : 'Final Submit'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
