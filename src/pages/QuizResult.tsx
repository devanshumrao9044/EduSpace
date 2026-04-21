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
    if (quizId) loadData()
  }, [quizId])

  const loadData = async () => {
    try {
      setLoading(true)
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return }

      // 1. Fetch Quiz & Questions
      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle()
      const { data: qData } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number')
      
      setQuiz(quizData)
      setQuestions(qData || [])

      // 2. Fetch All Attempts
      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false })

      if (error) throw error
      if (!attempts || attempts.length === 0) {
        toast.error("Koi attempt nahi mila!")
        navigate('/dashboard')
        return
      }

      setAllAttempts(attempts)

      // Auto-select if only one
      if (attempts.length === 1) {
        await handleSelect(attempts[0], quizData)
      }
    } catch (err) {
      console.error(err)
      toast.error("Data load nahi ho pa raha")
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (att: any, qz: any) => {
    const currentQuiz = qz || quiz
    const { count: rank } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .lte('submitted_at', currentQuiz?.end_time)
      .gt('score', att.score)

    const isLive = new Date(att.submitted_at) <= new Date(currentQuiz?.end_time)
    setSelectedAttempt({ ...att, isLive, rank: (rank || 0) + 1 })
  }

  // 🔥 Stats calculation with Safety Check
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

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">PREPARING ANALYSIS...</div>

  // --- SELECTION VIEW ---
  if (!selectedAttempt && allAttempts.length > 1) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <header className="text-center">
            <History className="w-12 h-12 mx-auto text-indigo-600 mb-4" />
            <h1 className="text-3xl font-black text-slate-900">Multiple Attempts</h1>
            <p className="text-slate-500">Aapne ye test {allAttempts.length} baar diya hai. Kaunsa result dekhna hai?</p>
          </header>
          <div className="space-y-3">
            {allAttempts.map((att, i) => (
              <Card key={att.id} className="p-5 cursor-pointer hover:ring-2 ring-indigo-500 transition-all shadow-md active:scale-95" onClick={() => handleSelect(att, quiz)}>
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
          <Button variant="ghost" className="w-full font-bold" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  if (!selectedAttempt) return null;

  // --- RESULT VIEW ---
  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <header className="bg-white border-b sticky top-0 z-50 p-4 flex justify-between items-center shadow-sm">
        <Button variant="ghost" onClick={() => allAttempts.length > 1 ? setSelectedAttempt(null) : navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {allAttempts.length > 1 ? 'Switch Attempt' : 'Back'}
        </Button>
        <span className="font-black text-slate-800 truncate">{quiz?.title}</span>
        <div className="w-10" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
        <div className={`p-10 rounded-3xl text-white shadow-2xl text-center ${selectedAttempt.isLive ? 'bg-indigo-600' : 'bg-slate-800'}`}>
          <Badge className="bg-white/20 mb-4 px-3 py-1 font-bold italic border-none">
            {selectedAttempt.isLive ? 'LIVE RANKING' : 'PRACTICE MODE'}
          </Badge>
          <h2 className="text-8xl font-black mb-4 tracking-tighter">#{selectedAttempt.rank}</h2>
          <div className="flex justify-center gap-10">
            <div><p className="text-3xl font-black">{selectedAttempt.score}</p><p className="text-[10px] font-bold opacity-50 uppercase">Score</p></div>
            <div className="w-px h-10 bg-white/20" />
            <div><p className="text-3xl font-black">{quiz?.total_marks}</p><p className="text-[10px] font-bold opacity-50 uppercase">Total</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox icon={<CheckCircle/>} label="Sahi" val={stats.correct} color="text-emerald-600" bg="bg-emerald-50" />
          <StatBox icon={<XCircle/>} label="Galat" val={stats.wrong} color="text-rose-600" bg="bg-rose-50" />
          <StatBox icon={<AlertCircle/>} label="Skipped" val={stats.skipped} color="text-amber-600" bg="bg-amber-50" />
          <StatBox icon={<Zap/>} label="Accuracy" val={`${stats.accuracy.toFixed(0)}%`} color="text-blue-600" bg="bg-blue-50" />
        </div>

        <Button className="w-full h-20 text-xl font-black shadow-xl" onClick={() => setIsReviewOpen(true)}>
          <Eye className="mr-3" /> REVIEW YOUR ANSWERS
        </Button>

        <div className="pt-10 border-t">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3"><Trophy className="text-yellow-500 w-8 h-8" /> TOPPERS LIST</h3>
          <QuizLeaderboard quizId={quizId!} />
        </div>
      </main>

      {/* Review Modal */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300">
           <div className="p-5 border-b sticky top-0 bg-white flex justify-between items-center z-50">
              <Button variant="ghost" onClick={() => setIsReviewOpen(false)} className="rounded-full"><X/></Button>
              <h2 className="font-black text-xl">Answer Review</h2>
              <div className="flex gap-2"><Badge className="bg-emerald-500">{stats.correct}</Badge><Badge className="bg-rose-500">{stats.wrong}</Badge></div>
           </div>
           <div className="max-w-2xl mx-auto p-6 space-y-12">
              {questions.map((q, idx) => {
                 const uAns = selectedAttempt.answers[q.id]?.answer;
                 const isCorrect = uAns?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase();
                 return (
                    <div key={q.id} className="border-l-4 border-slate-200 pl-6 py-2">
                       <p className="font-bold text-lg mb-4">{idx + 1}. {q.question_text}</p>
                       <div className="grid gap-3">
                          <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                             <p className="text-[10px] font-black uppercase opacity-50 mb-1">Aapka Jawab</p>
                             <p className="font-bold text-lg">{uAns || 'Nahi Diya'}</p>
                          </div>
                          <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-800">
                             <p className="text-[10px] font-black uppercase opacity-50 mb-1">Sahi Jawab</p>
                             <p className="font-bold text-lg">{q.correct_answer}</p>
                          </div>
                       </div>
                    </div>
                 )
              })}
           </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon, label, val, color, bg }: any) {
  return (
    <div className={`p-5 rounded-3xl ${bg} flex items-center gap-4 border border-white/50 shadow-sm`}>
      <div className={`h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase opacity-40">{label}</p>
        <p className={`text-2xl font-black ${color}`}>{val}</p>
      </div>
    </div>
  )
}
