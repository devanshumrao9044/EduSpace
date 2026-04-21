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
import type { Quiz, Question } from '@/types/database'

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [allAttempts, setAllAttempts] = useState<any[]>([]) // Saare attempts store karne ke liye
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null) // Jo result screen pe dikhega
  const [loading, setLoading] = useState(true)
  const [isReviewOpen, setIsReviewOpen] = useState(false)

  useEffect(() => {
    if (quizId) loadAttempts()
  }, [quizId])

  const loadAttempts = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return }

      // 1. Fetch Quiz Data
      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle()
      if (!quizData) throw new Error('Quiz not found')
      setQuiz(quizData)

      // 2. Fetch Questions
      const { data: qData } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number', { ascending: true })
      setQuestions(qData || [])

      // 3. Fetch All Attempts for this student
      const { data: attempts, error: aErr } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false }) // Latest attempt sabse upar

      if (aErr || !attempts || attempts.length === 0) throw new Error('No attempts found')

      setAllAttempts(attempts)

      // Agar bacha sirf ek baar attempt kiya hai, toh direct wahi select kar lo
      if (attempts.length === 1) {
        processSelectedAttempt(attempts[0], quizData)
      }
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Result load karne mein error aayi')
    } finally {
      setLoading(false)
    }
  }

  const processSelectedAttempt = async (attemptData: any, quizData: any) => {
    // Rank calculate karo (Same score calculation logic)
    const { count: toppers } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .lte('submitted_at', quizData.end_time)
      .gt('score', attemptData.score)

    const isLive = new Date(attemptData.submitted_at) <= new Date(quizData.end_time)
    setSelectedAttempt({ ...attemptData, isLive, calculatedRank: (toppers || 0) + 1 })
  }

  const stats = (() => {
    if (!selectedAttempt || !questions.length) return { correct: 0, wrong: 0, skipped: 0, accuracy: 0 }
    const answers = (selectedAttempt.answers || {}) as Record<string, any>
    let correct = 0, wrong = 0, skipped = 0

    questions.forEach(q => {
      const uAns = answers[q.id]?.answer?.trim().toUpperCase()
      const cAns = q.correct_answer?.trim().toUpperCase()
      if (!uAns) skipped++
      else if (uAns === cAns) correct++
      else wrong++
    })

    const attemptedCount = questions.length - skipped
    const accuracy = attemptedCount > 0 ? (correct / attemptedCount) * 100 : 0
    return { correct, wrong, skipped, accuracy }
  })()

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 font-bold">
      Loading Result Data...
    </div>
  )

  // ─── SELECTION VIEW (Multiple Attempts Found) ─────────────────
  if (!selectedAttempt && allAttempts.length > 1) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <History className="w-12 h-12 mx-auto text-indigo-600 mb-2" />
            <h1 className="text-2xl font-black">Choose Attempt</h1>
            <p className="text-slate-500">Aapne {allAttempts.length} baar ye test diya hai</p>
          </div>

          <div className="grid gap-4">
            {allAttempts.map((att, index) => (
              <Card 
                key={att.id} 
                className="p-5 cursor-pointer hover:border-indigo-500 transition-all border-2 border-transparent shadow-md active:scale-95"
                onClick={() => processSelectedAttempt(att, quiz)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-black text-slate-700">Attempt #{allAttempts.length - index}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(att.submitted_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-black text-indigo-600">{att.score}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Score</p>
                    </div>
                    <ChevronRight className="text-slate-300 h-5 w-5" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Button variant="ghost" className="w-full font-bold" onClick={() => navigate('/dashboard')}>
            Wapas Jao
          </Button>
        </div>
      </div>
    )
  }

  // ─── ANALYSIS VIEW (Final Result) ──────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 px-4 py-4 flex justify-between items-center shadow-sm">
        <Button variant="ghost" onClick={() => allAttempts.length > 1 ? setSelectedAttempt(null) : navigate('/dashboard')} className="font-bold">
          <ArrowLeft className="h-4 w-4 mr-2" /> {allAttempts.length > 1 ? 'Attempts List' : 'Back'}
        </Button>
        <h1 className="font-black text-slate-800 truncate">{quiz?.title}</h1>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        {/* Score Card */}
        <div className={`rounded-3xl p-8 text-white shadow-2xl ${selectedAttempt.isLive ? 'bg-indigo-600' : 'bg-slate-800'}`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <Badge className="bg-white/20 mb-4 px-3 py-1 font-bold italic">
                {selectedAttempt.isLive ? 'OFFICIAL ATTEMPT' : 'PRACTICE / LATE'}
              </Badge>
              <h2 className="text-7xl font-black mb-2">#{selectedAttempt.calculatedRank}</h2>
              <p className="opacity-70 font-medium">Global Rank in this Attempt</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl text-center min-w-[140px] border border-white/10">
                <p className="text-5xl font-black leading-none mb-2">{selectedAttempt.score}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Points</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl text-center min-w-[140px] border border-white/10">
                <p className="text-5xl font-black leading-none mb-2">{quiz?.total_marks}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox color="text-emerald-600" bg="bg-emerald-50" icon={<CheckCircle />} label="Correct" value={stats.correct} />
          <StatBox color="text-rose-600" bg="bg-rose-50" icon={<XCircle />} label="Wrong" value={stats.wrong} />
          <StatBox color="text-amber-600" bg="bg-amber-50" icon={<AlertCircle />} label="Skipped" value={stats.skipped} />
          <StatBox color="text-blue-600" bg="bg-blue-50" icon={<Zap />} label="Accuracy" value={`${stats.accuracy.toFixed(1)}%`} />
        </div>

        <Button className="w-full h-16 text-xl font-black shadow-xl" onClick={() => setIsReviewOpen(true)}>
          <Eye className="mr-3 h-6 w-6" /> DETAILED REVIEW
        </Button>

        {/* Leaderboard */}
        <div className="pt-10 border-t border-slate-200">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-slate-800">
            <Trophy className="text-yellow-500 w-8 h-8" /> OFFICIAL TOPPERS
          </h3>
          <QuizLeaderboard quizId={quizId!} totalMarks={quiz?.total_marks} />
        </div>
      </main>

      {/* Review Overlay (Modal logic same as before) */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300">
           {/* ... (Review UI code same as you have) ... */}
           <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <Button variant="ghost" onClick={() => setIsReviewOpen(false)}><X className="mr-2"/> Close</Button>
              <h2 className="font-bold">Review Mode</h2>
              <div className="w-10"></div>
           </div>
           <div className="max-w-3xl mx-auto p-6 space-y-10">
              {questions.map((q, idx) => {
                 const uAns = selectedAttempt.answers[q.id]?.answer;
                 const isCorrect = uAns?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase();
                 return (
                    <div key={q.id} className="border-l-4 border-slate-200 pl-6 py-2">
                       <p className="font-bold text-lg">{idx+1}. {q.question_text}</p>
                       <div className="mt-2 text-sm">
                          <p className={`p-2 rounded ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                             <b>Your Answer:</b> {uAns || 'Skipped'}
                          </p>
                          <p className="p-2 bg-slate-50 mt-1">
                             <b>Correct Answer:</b> {q.correct_answer}
                          </p>
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

function StatBox({ icon, label, value, color, bg }: { icon: any, label: string, value: any, color: string, bg: string }) {
  return (
    <div className={`p-5 rounded-3xl ${bg} flex items-center gap-4 shadow-sm border border-white/50 transition-all hover:translate-y-[-2px]`}>
      <div className={`h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-0.5">{label}</p>
        <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
      </div>
    </div>
  )
}

