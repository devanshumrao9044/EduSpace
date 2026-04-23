import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Send, BarChart2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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

  useEffect(() => { if (quizId) init(); }, [quizId])

  const init = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) return navigate('/login')
      
      const [qRes, qsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number')
      ])
      
      setQuiz(qRes.data); 
      setQuestions(qsRes.data || [])

      // Check if attempt already exists
      const { data: exAt } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', user.id).maybeSingle()
      
      // AGAR SUBMIT HO CHUKA HAI TO SEEDHA RESULT PE BHEJO
      if (exAt?.submitted_at) {
        navigate(`/quiz/${quizId}/result`, { replace: true })
        return
      }

      if (exAt) {
        setAttempt(exAt); 
        setAnswers(exAt.answers || {})
        const elapsed = Math.floor((Date.now() - new Date(exAt.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, qRes.data.duration_minutes * 60 - elapsed))
      } else {
        const { data: nAt } = await supabase.from('quiz_attempts').insert({ quiz_id: quizId, student_id: user.id, answers: {} }).select().single()
        setAttempt(nAt); 
        setTimeLeft(qRes.data.duration_minutes * 60)
      }
    } catch { 
      toast.error('Error loading quiz'); 
    } finally { 
      setLoading(false); 
    }
  }

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    if (!auto && !confirm('Are you sure you want to submit the quiz?')) return
    
    setSubmitting(true)
    try {
      let score = 0
      questions.forEach(q => {
        const ua = answers[q.id]?.answer?.trim().toUpperCase()
        const ca = q.correct_answer?.trim().toUpperCase()
        if (ua === ca) score += q.marks
        else if (ua && q.negative_marks) score -= q.negative_marks
      })

      const { error } = await supabase.from('quiz_attempts').update({ 
        submitted_at: new Date().toISOString(), 
        answers, 
        score, 
        is_evaluated: true 
      }).eq('id', attempt.id)

      if (error) throw error;

      toast.success('Quiz Submitted!')
      // RESULT PAGE PE BHEJO AUR BACK BUTTON DISABLE KARDO
      navigate(`/quiz/${quizId}/result`, { replace: true })
      
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit')
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (timeLeft <= 0 && !loading && attempt && !attempt.submitted_at) return;
    const timer = setInterval(() => {
      setTimeLeft(p => { 
        if (p <= 1) { 
          clearInterval(timer);
          handleSubmit(true); 
          return 0; 
        } 
        return p - 1; 
      });
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, loading])

  if (loading) return <div className="h-screen flex items-center justify-center font-bold italic text-indigo-600 animate-pulse">PREPARING TEST...</div>

  const q = questions[currentQuestionIndex]
  const ans = answers[q?.id]?.answer

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div>
          <h1 className="font-bold truncate max-w-[120px] text-sm">{quiz?.title}</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Q{currentQuestionIndex+1}/{questions.length}</p>
        </div>
        <div className={`px-4 py-1.5 rounded-xl font-mono font-black text-sm ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
          {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
        </div>
        <Button onClick={()=>handleSubmit()} disabled={submitting} size="sm" className="bg-slate-900 rounded-lg h-9">
          {submitting ? <Loader2 className="animate-spin h-4 w-4"/> : 'Submit'}
        </Button>
      </header>

      <main className="flex-1 p-4 lg:max-w-4xl lg:mx-auto w-full pb-32">
        <Card className="rounded-[2.5rem] overflow-hidden shadow-xl border-none bg-white">
          <div className="p-6 lg:p-10 border-b">
            <Badge className="bg-indigo-600 mb-4 px-3 py-0.5 italic">QUESTION {currentQuestionIndex+1}</Badge>
            <p className="text-xl font-bold text-slate-800 leading-tight mb-6">{q?.question_text}</p>
            {q?.image_url && (
              <div className="rounded-2xl border-2 border-slate-50 overflow-hidden bg-white flex justify-center p-2 shadow-sm">
                <img src={q.image_url} alt="Question" className="max-h-[350px] w-auto object-contain cursor-zoom-in" onClick={() => window.open(q.image_url, '_blank')} />
              </div>
            )}
          </div>

          <div className="p-6 lg:p-10 bg-slate-50/30">
            {q?.question_type === 'mcq' ? (
              <RadioGroup value={ans || ''} onValueChange={v => setAnswers({...answers, [q.id]: {answer: v}})} className="space-y-4">
                {Object.entries(q.options || {}).map(([k, v]) => v && (
                  <div key={k} onClick={()=>setAnswers({...answers, [q.id]: {answer: k}})} className={`p-5 border-2 rounded-2xl bg-white flex items-center gap-4 cursor-pointer transition-all ${ans === k ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100' : 'border-slate-100'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 ${ans === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'text-slate-300 border-slate-100'}`}>{k}</span>
                    <span className="font-bold text-slate-700">{v as string}</span>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Input type="number" placeholder="Enter numeric answer" value={ans || ''} onChange={e => setAnswers({...answers, [q.id]: {answer: e.target.value}})} className="h-16 text-xl font-bold rounded-2xl border-2 border-slate-100 focus:border-indigo-600" />
            )}
          </div>

          <div className="p-6 flex justify-between bg-white border-t">
            <Button variant="outline" className="rounded-xl h-12 px-6 font-bold" onClick={()=>setCurrentQuestionIndex(p => Math.max(0, p-1))} disabled={currentQuestionIndex===0}>Previous</Button>
            <Button className="rounded-xl h-12 px-8 font-bold bg-slate-900" onClick={()=>setCurrentQuestionIndex(p => Math.min(questions.length-1, p+1))} disabled={currentQuestionIndex===questions.length-1}>Next Question</Button>
          </div>
        </Card>
      </main>

      {/* MOBILE SUMMARY BUTTON */}
      <button onClick={()=>setStatsOpen(true)} className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-indigo-600 text-white px-8 py-3 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border-4 border-white active:scale-95 transition-transform">
        <BarChart2 size={16}/> Summary ({(Object.keys(answers).length)}/{questions.length})
      </button>

      {statsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={()=>setStatsOpen(false)}>
          <div className="bg-white w-full rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300" onClick={e=>e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
            <div className="grid grid-cols-5 gap-3 mb-8 max-h-60 overflow-y-auto p-1">
              {questions.map((item, i) => (
                <button key={item.id} onClick={()=>{setCurrentQuestionIndex(i); setStatsOpen(false)}} className={`h-12 rounded-xl font-black text-xs transition-all ${currentQuestionIndex === i ? 'ring-4 ring-indigo-100 bg-indigo-600 text-white' : answers[item.id]?.answer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{i+1}</button>
              ))}
            </div>
            <Button onClick={()=>handleSubmit()} disabled={submitting} className="w-full h-16 bg-slate-900 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-xl shadow-slate-200">
              {submitting ? 'SUBMITTING...' : 'FINISH & SUBMIT TEST'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

