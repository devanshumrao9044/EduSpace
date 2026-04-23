import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Send, BarChart2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export default function QuizAttempt() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [attempt, setAttempt] = useState<any>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const saveTimeoutRef = useRef<any>()

  useEffect(() => { if (quizId) init(); }, [quizId])

  const init = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) return navigate('/login')
      const [qRes, qsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number')
      ])
      setQuiz(qRes.data); setQuestions(qsRes.data || [])
      const { data: exAt } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', user.id).maybeSingle()
      if (exAt?.submitted_at) return navigate(`/quiz/${quizId}/result`)
      if (exAt) {
        setAttempt(exAt); setAnswers(exAt.answers || {})
        const elapsed = Math.floor((Date.now() - new Date(exAt.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, qRes.data.duration_minutes * 60 - elapsed))
      } else {
        const { data: nAt } = await supabase.from('quiz_attempts').insert({ quiz_id: quizId, student_id: user.id, answers: {} }).select().single()
        setAttempt(nAt); setTimeLeft(qRes.data.duration_minutes * 60)
      }
    } catch { toast.error('Error loading quiz'); } finally { setLoading(false); }
  }

  const handleSubmit = async (auto = false) => {
    if (!auto && !confirm('Submit quiz?')) return
    setSubmitting(true)
    let score = 0
    questions.forEach(q => {
      const ua = answers[q.id]?.answer?.trim().toUpperCase(), ca = q.correct_answer?.trim().toUpperCase()
      if (ua === ca) score += q.marks
      else if (ua && q.negative_marks) score -= q.negative_marks
    })
    await supabase.from('quiz_attempts').update({ submitted_at: new Date().toISOString(), answers, score, is_evaluated: true }).eq('id', attempt.id)
    navigate(`/quiz/${quizId}/result`)
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(p => { if (p <= 1) { handleSubmit(true); return 0; } return p - 1; })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  if (loading) return <div className="h-screen flex items-center justify-center font-bold">LOADING...</div>
  const q = questions[currentQuestionIndex], ans = answers[q?.id]?.answer

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24 lg:pb-0">
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div><h1 className="font-bold truncate max-w-[150px]">{quiz?.title}</h1><p className="text-[10px] font-bold text-slate-400">Q{currentQuestionIndex+1}/{questions.length}</p></div>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl font-mono font-bold text-indigo-600">
          {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
        </div>
        <Button onClick={()=>handleSubmit()} disabled={submitting} size="sm" className="bg-slate-900">{submitting ? '...' : 'Submit'}</Button>
      </header>

      <main className="flex-1 p-4 lg:max-w-4xl lg:mx-auto w-full">
        <Card className="rounded-[2rem] overflow-hidden shadow-xl border-none">
          <div className="p-6 border-b bg-white">
            <Badge className="bg-indigo-600 mb-2">QUESTION {currentQuestionIndex+1}</Badge>
            <p className="text-lg font-bold text-slate-800">{q?.question_text}</p>
            {q?.image_url && (
              <div className="mt-4 border rounded-2xl overflow-hidden bg-slate-50">
                <img src={q.image_url} alt="Question" className="max-h-[300px] mx-auto object-contain" />
              </div>
            )}
          </div>
          <div className="p-6 bg-slate-50/50">
            {q?.question_type === 'mcq' ? (
              <RadioGroup value={ans || ''} onValueChange={v => setAnswers({...answers, [q.id]: {answer: v}})} className="space-y-3">
                {Object.entries(q.options || {}).map(([k, v]) => v && (
                  <div key={k} onClick={()=>setAnswers({...answers, [q.id]: {answer: k}})} className={`p-4 border-2 rounded-2xl bg-white flex items-center gap-3 cursor-pointer ${ans === k ? 'border-indigo-600 ring-2 ring-indigo-50' : 'border-slate-100'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 ${ans === k ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{k}</span>
                    <span className="font-medium text-slate-700">{v as string}</span>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Input type="number" placeholder="Your Answer" value={ans || ''} onChange={e => setAnswers({...answers, [q.id]: {answer: e.target.value}})} className="h-14 rounded-xl" />
            )}
          </div>
          <div className="p-4 flex justify-between bg-white border-t">
            <Button variant="outline" onClick={()=>setCurrentQuestionIndex(p => Math.max(0, p-1))} disabled={currentQuestionIndex===0}>Prev</Button>
            <Button onClick={()=>setCurrentQuestionIndex(p => Math.min(questions.length-1, p+1))} disabled={currentQuestionIndex===questions.length-1}>Next</Button>
          </div>
        </Card>
      </main>

      {/* MOBILE OVERLAP FIX */}
      <button onClick={()=>setStatsOpen(true)} className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-indigo-600 text-white px-8 py-3 rounded-full shadow-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 border-4 border-white">
        <BarChart2 size={16}/> Summary
      </button>

      {statsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={()=>setStatsOpen(false)}>
          <div className="bg-white w-full rounded-t-[2rem] p-6 pt-2" onClick={e=>e.stopPropagation()}>
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto my-4" />
            <div className="grid grid-cols-5 gap-2 mb-6">
              {questions.map((item, i) => (
                <button key={item.id} onClick={()=>{setCurrentQuestionIndex(i); setStatsOpen(false)}} className={`h-10 rounded-lg font-bold text-xs ${currentQuestionIndex === i ? 'bg-indigo-600 text-white' : answers[item.id] ? 'bg-emerald-500 text-white' : 'bg-slate-100'}`}>{i+1}</button>
              ))}
            </div>
            <Button onClick={()=>handleSubmit()} className="w-full h-14 bg-slate-900 rounded-2xl font-bold">SUBMIT QUIZ</Button>
          </div>
        </div>
      )}
    </div>
  )
}
