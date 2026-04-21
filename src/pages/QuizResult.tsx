import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, CheckCircle, XCircle,
  AlertCircle, Trophy, Zap, Eye, X, History, ChevronRight
} from 'lucide-react'
import QuizLeaderboard from '@/components/features/QuizLeaderboard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [allAttempts, setAllAttempts] = useState<any[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isReviewOpen, setIsReviewOpen] = useState(false)

  useEffect(() => {
    if (quizId) loadInitialData()
    else navigate('/dashboard')
  }, [quizId])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return }

      // 1. Fetch Quiz & Questions (Using maybeSingle to prevent crash)
      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle()
      if (!quizData) {
        toast.error("Quiz nahi mila!")
        navigate('/dashboard')
        return
      }
      setQuiz(quizData)

      const { data: qData } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number')
      setQuestions(qData || [])

      // 2. Fetch Attempts
      const { data: attempts, error: attError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false })

      if (attError) throw attError
      
      if (!attempts || attempts.length === 0) {
        toast.error("Aapka koi attempt record nahi mila!")
        navigate('/dashboard')
        return
      }

      setAllAttempts(attempts)

      // Auto-load if only one, else stay on selection screen
      if (attempts.length === 1) {
        await handleAttemptSelect(attempts[0], quizData)
      }
    } catch (err: any) {
      console.error("Critical Load Error:", err)
      toast.error("Data load karne mein panga ho gaya!")
    } finally {
      setLoading(false)
    }
  }

  const handleAttemptSelect = async (attempt: any, quizData?: any) => {
    const activeQuiz = quizData || quiz
    try {
      const { count: rank } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .lte('submitted_at', activeQuiz?.end_time)
        .gt('score', attempt.score)

      const isLive = new Date(attempt.submitted_at) <= new Date(activeQuiz?.end_time)
      setSelectedAttempt({ ...attempt, isLive, rank: (rank || 0) + 1 })
    } catch (err) {
      toast.error("Rank calculate nahi ho payi")
      setSelectedAttempt({ ...attempt, rank: 'N/A' })
    }
  }

  // Statistics Calculation
  const stats = (() => {
    if (!selectedAttempt || !questions.length) return { correct: 0, wrong: 0, skipped: 0, accuracy: 0 }
    const answers = selectedAttempt.answers || {}
    let correct = 0, wrong = 0, skipped = 0

    questions.forEach(q => {
      const uAns = answers[q.id]?.answer?.trim().toUpperCase()
      const cAns = q.correct_answer?.trim().toUpperCase()
      if (!uAns) skipped++
      else if (uAns === cAns) correct++
      else wrong++
    })

    const attemptedCount = questions.length - skipped
    return { correct, wrong, skipped, accuracy: attemptedCount > 0 ? (correct / attemptedCount) * 100 : 0 }
  })()

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center font-black animate-pulse text-indigo-600">LOADING ANALYSIS...</div>
    </div>
  )

  // SELECTION VIEW
  if (!selectedAttempt && allAttempts.length > 1) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <header className="text-center">
            <History className="w-12 h-12 mx-auto text-indigo-600 mb-4" />
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kounsa Attempt?</h1>
            <p className="text-slate-500">Aapne ye test {allAttempts.length} baar diya hai.</p>
          </header>
          <div className="space-y-3">
            {allAttempts.map((att, i) => (
              <Card key={att.id} className="p-5 cursor-pointer hover:ring-2 ring-indigo-500 transition-all shadow-md active:scale-95" onClick={() => handleAttemptSelect(att)}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800 text-lg">Attempt #{allAttempts.length - i}</p>
                    <p className="text-xs text-slate-400">{new Date(att.submitted_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-indigo-600">{att.score}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Score</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Button variant="ghost" className="w-full font-bold" onClick={() => navigate('/dashboard')}>Wapas Dashboard</Button>
        </div>
      </div>
    )
  }

  if (!selectedAttempt) return null

  // ANALYSIS VIEW
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-50 p-4 flex justify-between items-center shadow-sm">
        <Button variant="ghost" onClick={() => allAttempts.length > 1 ? setSelectedAttempt(null) : navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {allAttempts.length > 1 ? 'Attempts List' : 'Back'}
        </Button>
        <span className="font-black text-slate-800 truncate px-4">{quiz?.title}</span>
        <div className="w-10" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
        <div className={`p-10 rounded-[2.5rem] text-white shadow-2xl text-center ${selectedAttempt.isLive ? 'bg-indigo-600' : 'bg-slate-800'}`}>
          <Badge className="bg-white/20 mb-4 px-4 py-1 font-black italic tracking-widest border-none">
            {selectedAttempt.isLive ? 'LIVE PERFORMANCE' : 'PRACTICE MODE'}
          </Badge>
          <h2 className="text-8xl font-black mb-4 tracking-tighter italic">#{selectedAttempt.rank}</h2>
          <div className="flex justify-center gap-12 mt-6">
            <div><p className="text-4xl font-black">{selectedAttempt.score}</p><p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Score</p></div>
            <div className="w-px h-12 bg-white/20" />
            <div><p className="text-4xl font-black">{quiz?.total_marks}</p><p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Out of</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox icon={<CheckCircle />} label="Sahi" val={stats.correct} color="text-emerald-600" bg="bg-emerald-50" />
          <StatBox icon={<XCircle />} label="Galat" val={stats.wrong} color="text-rose-600" bg="bg-rose-50" />
          <StatBox icon={<AlertCircle />} label="Skipped" val={stats.skipped} color="text-amber-600" bg="bg-amber-50" />
          <StatBox icon={<Zap />} label="Accuracy" val={`${stats.accuracy.toFixed(0)}%`} color="text-blue-600" bg="bg-blue-50" />
        </div>

        <Button className="w-full h-20 text-xl font-black shadow-xl hover:scale-[1.01] transition-transform rounded-3xl" onClick={() => setIsReviewOpen(true)}>
          <Eye className="mr-3 h-6 w-6" /> VIEW ANSWER ANALYSIS
        </Button>

        <div className="pt-10 border-t border-slate-200">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-slate-800 italic">
            <Trophy className="text-yellow-500 w-8 h-8" /> TOPPERS LIST
          </h3>
          <QuizLeaderboard quizId={quizId!} />
        </div>
      </main>

      {/* Answer Review Overlay */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300">
           <div className="p-5 border-b sticky top-0 bg-white flex justify-between items-center z-50">
              <Button variant="ghost" onClick={() => setIsReviewOpen(false)} className="rounded-full hover:bg-slate-100"><X /></Button>
              <h2 className="font-black text-xl text-slate-800">Review Mode</h2>
              <div className="flex gap-2"><Badge className="bg-emerald-500">{stats.correct}</Badge><Badge className="bg-rose-500">{stats.wrong}</Badge></div>
           </div>
           
           <div className="max-w-3xl mx-auto p-6 sm:p-12 space-y-12">
              {questions.map((q, idx) => {
                 const uAns = selectedAttempt.answers?.[q.id]?.answer;
                 const isCorrect = uAns?.trim().toUpperCase() === q.correct_answer?.trim().toUpperCase();
                 
                 return (
                    <div key={q.id} className="relative pl-8 border-l-4 border-slate-200 py-2">
                       <div className="absolute -left-[14px] top-0 h-7 w-7 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-black">{idx + 1}</div>
                       <div className="mb-6">
                          <p className="text-xl font-bold text-slate-800 mb-3">{q.question_text}</p>
                          <Badge variant="secondary" className="text-[10px] font-black uppercase text-slate-400">Points: {q.marks}</Badge>
                       </div>
                       <div className="grid gap-3">
                          <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                             <p className="text-[10px] font-black uppercase opacity-50 mb-1">Your Choice</p>
                             <p className="font-bold text-lg">{uAns || 'Nahi Diya'}</p>
                          </div>
                          <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-800">
                             <p className="text-[10px] font-black uppercase opacity-50 mb-1">Correct Answer</p>
                             <p className="font-black text-lg">{q.correct_answer}</p>
                          </div>
                       </div>
                    </div>
                 )
              })}
              <div className="py-20 text-center">
                <Button size="lg" className="px-16 font-black rounded-3xl" onClick={() => setIsReviewOpen(false)}>Close Analysis</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon, label, val, color, bg }: any) {
  return (
    <div className={`p-5 rounded-[2rem] ${bg} flex items-center gap-4 border border-white/50 shadow-sm transition-transform hover:scale-105`}>
      <div className={`h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-0.5">{label}</p>
        <p className={`text-2xl font-black leading-none ${color}`}>{val}</p>
      </div>
    </div>
  )
}
