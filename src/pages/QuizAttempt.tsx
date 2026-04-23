import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Send, BarChart2, ChevronLeft, ChevronRight, Loader2, X, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
      if (!user) { window.location.replace('/login'); return; }

      // 1. Check for existing attempt (Strict Redirect)
      const { data: exAt } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', user.id).maybeSingle()
      
      if (exAt?.submitted_at) {
        window.location.replace(`/quiz/${quizId}/result`)
        return
      }

      // 2. Load Quiz/Questions
      const [qRes, qsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number')
      ])

      setQuiz(qRes.data); setQuestions(qsRes.data || [])

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
    if (submitting) return
    if (!auto && !confirm('Submit Quiz?')) return
    setSubmitting(true)

    let score = 0
    questions.forEach(q => {
      const ua = answers[q.id]?.answer?.trim().toUpperCase(), ca = q.correct_answer?.trim().toUpperCase()
      if (ua === ca) score += q.marks
      else if (ua && q.negative_marks) score -= q.negative_marks
    })

    const { error } = await supabase.from('quiz_attempts').update({ 
      submitted_at: new Date().toISOString(), 
      answers, score, is_evaluated: true 
    }).eq('id', attempt.id)

    if (!error) {
      // 🔥 HARD REDIRECT: location.replace is bulletproof against loop 🔥
      window.location.replace(`/quiz/${quizId}/result`)
    } else {
      toast.error("Failed to submit")
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (loading || !attempt || submitting) return
    const timer = setInterval(() => {
      setTimeLeft(p => { if (p <= 1) { clearInterval(timer); handleSubmit(true); return 0; } return p - 1; })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, loading, attempt])

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse text-indigo-600">PREPARING TEST...</div>
  const q = questions[currentQuestionIndex], ans = answers[q?.id]?.answer

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div><h1 className="font-bold truncate max-w-[120px] text-sm">{quiz?.title}</h1><p className="text-[10px] font-bold text-slate-400">Q{currentQuestionIndex+1}/{questions.length}</p></div>
        <div className={`px-4 py-2 rounded-xl font-mono font-bold text-sm ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
          {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
        </div>
        <Button onClick={()=>handleSubmit()} disabled={submitting} size="sm" className="bg-slate-900 rounded-xl font-bold">
          {submitting ? '...' : 'Submit'}
        </Button>
      </header>

      {/* QUESTION AREA - Increased Bottom Padding for Mobile */}
      <main className="flex-1 p-4 pb-44 lg:max-w-4xl lg:mx-auto w-full overflow-y-auto">
        <Card className="rounded-[2.5rem] overflow-hidden shadow-xl border-none bg-white">
          <div className="p-6 border-b">
            <div className="flex justify-between items-start mb-4">
               <Badge className="bg-indigo-600 italic font-black">Q{currentQuestionIndex+1}</Badge>
               <div className="flex flex-col items-center gap-1">
                  <Switch checked={answers[q?.id]?.marked || false} onCheckedChange={() => setAnswers(prev => ({...prev, [q.id]: {...prev[q.id], marked: !prev[q.id]?.marked}}))} />
                  <span className="text-[9px] font-black uppercase text-slate-400">Review</span>
               </div>
            </div>
            <p className="text-xl font-bold text-slate-800 mb-6 leading-tight">{q?.question_text}</p>
            
            {/* 🔥 IMAGE DISPLAY: Strict Check 🔥 */}
            {q?.image_url && (
              <div className="mt-4 border-2 border-slate-50 rounded-2xl overflow-hidden bg-slate-50 flex justify-center p-2">
                <img src={q.image_url} alt="Visual" className="max-h-[350px] w-auto object-contain rounded-xl" />
              </div>
            )}
          </div>
          
          <div className="p-6 bg-slate-50/50">
            {q?.question_type === 'mcq' ? (
              <div className="space-y-3">
                {Object.entries(q.options || {}).map(([k, v]) => v && (
                  <div key={k} onClick={()=>setAnswers({...answers, [q.id]: {answer: k}})} className={`p-4 border-2 rounded-2xl bg-white flex items-center gap-4 cursor-pointer transition-all ${ans === k ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 ${ans === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'text-slate-300 border-slate-100'}`}>{k}</span>
                    <span className="font-bold text-slate-700">{v as string}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Input type="number" placeholder="Enter numeric value" value={ans || ''} onChange={e => setAnswers({...answers, [q.id]: {answer: e.target.value}})} className="h-16 text-xl font-bold rounded-2xl border-2 border-slate-200 focus:border-indigo-600" />
            )}
          </div>
        </Card>
      </main>

      {/* 🔥 MOBILE UI OVERLAP FIX: Separate Nav & Summary 🔥 */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4 flex justify-between items-center z-40 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
        <Button variant="outline" className="rounded-xl h-12 flex-1 mr-2 font-bold" onClick={()=>setCurrentQuestionIndex(p => Math.max(0, p-1))} disabled={currentQuestionIndex===0}>Previous</Button>
        <Button className="rounded-xl h-12 flex-1 ml-2 bg-slate-900 font-bold" onClick={()=>setCurrentQuestionIndex(p => Math.min(questions.length-1, p+1))} disabled={currentQuestionIndex===questions.length-1}>Next</Button>
      </div>

      {/* Floating Summary Button - Placed well above Nav bar */}
      <button 
        onClick={()=>setStatsOpen(true)} 
        className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl font-black italic uppercase text-[10px] tracking-widest flex items-center gap-2 ring-4 ring-white"
      >
        <BarChart2 size={16}/> Summary Grid
      </button>

      {/* SUMMARY DRAWER */}
      {statsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={()=>setStatsOpen(false)}>
          <div className="bg-white w-full rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300" onClick={e=>e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <div className="grid grid-cols-5 gap-3 mb-8 max-h-[300px] overflow-y-auto">
              {questions.map((item, i) => (
                <button key={item.id} onClick={()=>{setCurrentQuestionIndex(i); setStatsOpen(false)}} className={`h-12 rounded-xl font-black text-xs transition-all ${currentQuestionIndex === i ? 'bg-indigo-600 text-white' : answers[item.id]?.answer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{i+1}</button>
              ))}
            </div>
            <Button onClick={()=>handleSubmit()} className="w-full h-14 bg-slate-900 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-xl">Final Submit</Button>
          </div>
        </div>
      )}
    </div>
  )
}

