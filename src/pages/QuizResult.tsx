import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, Award, Clock, CheckCircle, XCircle, 
  AlertCircle, Trophy, TrendingUp, Zap, Target 
} from 'lucide-react'
import QuizLeaderboard from '@/components/features/QuizLeaderboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import type { Quiz, Question, QuizAttempt } from '@/types/database'

interface Answer {
  questionId: string
  answer: string
}

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (quizId) loadResult()
  }, [quizId])

  const loadResult = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return; }

      // 1. Fetch Quiz Info
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()
      
      if (!quizData) throw new Error('Quiz not found')

      // 2. Fetch User's Latest Attempt
      const { data: attemptData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()

      if (!attemptData) throw new Error('Attempt not found')

      // 3. 🔥 PW Logic: Calculate Comparative Rank
      // Hum count karenge kitne log isse zyada score laye hain (Sirf Live bacchon mein)
      const { count: liveToppersAbove } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .lte('submitted_at', quizData.end_time) // Jo time par aaye
        .gt('score', attemptData.score)

      const isLive = new Date(attemptData.submitted_at) <= new Date(quizData.end_time)

      // 4. Fetch Questions for Review
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_number', { ascending: true })

      setQuiz(quizData)
      setQuestions(qData || [])
      setAttempt({
        ...attemptData,
        isLive,
        calculatedRank: (liveToppersAbove || 0) + 1
      })
    } catch (error: any) {
      toast.error('Result load karne mein error aaya')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    if (!attempt || !questions.length) return { correct: 0, wrong: 0, skipped: 0, accuracy: 0 }
    const answers = attempt.answers as Record<string, Answer>
    let correct = 0, wrong = 0, skipped = 0

    questions.forEach(q => {
      const uAns = answers[q.id]?.answer
      if (!uAns) skipped++
      else if (uAns.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()) correct++
      else wrong++
    })

    const attempted = questions.length - skipped
    const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0
    return { correct, wrong, skipped, accuracy }
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
      <p className="text-gray-500 font-medium">Analyzing your performance...</p>
    </div>
  )

  const stats = calculateStats()

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Quiz Report</p>
            <h1 className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-none">{quiz?.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        
        {/* 🔥 PW STYLE HERO SECTION 🔥 */}
        <div className={`relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl transition-all ${
          attempt.isLive 
          ? 'bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500' 
          : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900'
        }`}>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-4 text-center md:text-left">
              <Badge className="bg-white/20 text-white border-none backdrop-blur-md px-4 py-1">
                {attempt.isLive ? 'LIVE ATTEMPT' : 'PRACTICE MODE'}
              </Badge>
              <div>
                <h2 className="text-5xl font-black tracking-tight mb-1">
                  #{attempt.calculatedRank}
                </h2>
                <p className="text-lg font-medium opacity-90">
                  {attempt.isLive ? 'Your Official Live Rank' : 'Expected Rank among Live Students'}
                </p>
              </div>
              {!attempt.isLive && (
                <p className="text-xs bg-black/20 p-2 rounded-lg inline-block border border-white/10">
                  *This rank is calculated for your analysis and won't appear on the public leaderboard.
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl text-center min-w-[140px]">
                <Target className="h-5 w-5 mx-auto mb-2 opacity-70" />
                <p className="text-4xl font-black">{attempt.score}</p>
                <p className="text-xs font-bold opacity-60 uppercase">Your Score</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl text-center min-w-[140px]">
                <Award className="h-5 w-5 mx-auto mb-2 opacity-70" />
                <p className="text-4xl font-black">{quiz?.total_marks}</p>
                <p className="text-xs font-bold opacity-60 uppercase">Max Marks</p>
              </div>
            </div>
          </div>
          {/* Decorative Circles */}
          <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox color="text-emerald-600" bg="bg-emerald-50" icon={<CheckCircle/>} label="Correct" value={stats.correct} />
          <StatBox color="text-rose-600" bg="bg-rose-50" icon={<XCircle/>} label="Incorrect" value={stats.wrong} />
          <StatBox color="text-amber-600" bg="bg-amber-50" icon={<AlertCircle/>} label="Skipped" value={stats.skipped} />
          <StatBox color="text-blue-600" bg="bg-blue-50" icon={<Zap/>} label="Accuracy" value={`${stats.accuracy.toFixed(1)}%`} />
        </div>

        {/* Review Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Question-wise Analysis
            </h3>
            <Badge variant="outline" className="bg-white">{questions.length} Questions</Badge>
          </div>

          <div className="grid gap-4">
            {questions.map((q, idx) => {
              const uAns = (attempt.answers as Record<string, Answer>)[q.id]?.answer;
              const isCorrect = uAns?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase();
              const isSkipped = !uAns;

              return (
                <Card key={q.id} className={`border-none shadow-sm overflow-hidden transition-all hover:ring-2 ${
                  isSkipped ? 'ring-slate-100 bg-white' : isCorrect ? 'ring-emerald-100 bg-emerald-50/30' : 'ring-rose-100 bg-rose-50/30'
                }`}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2 items-center">
                        <span className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-800 text-white text-xs font-bold">
                          {idx + 1}
                        </span>
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {q.question_type}
                        </Badge>
                      </div>
                      <span className="text-xs font-bold text-slate-400">+{q.marks} Marks</span>
                    </div>
                    
                    <p className="text-slate-700 font-medium mb-4 leading-relaxed">{q.question_text}</p>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className={`p-3 rounded-xl border flex flex-col ${isSkipped ? 'bg-slate-50 border-slate-200' : isCorrect ? 'bg-white border-emerald-200' : 'bg-white border-rose-200'}`}>
                        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Your Answer</span>
                        <span className={`text-sm font-bold ${isSkipped ? 'text-slate-400' : isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {uAns || 'Not Attempted'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col">
                        <span className="text-[10px] uppercase font-black text-emerald-400 mb-1">Correct Answer</span>
                        <span className="text-sm font-bold text-emerald-700">{q.correct_answer}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="pt-8 border-t border-slate-200">
           <div className="mb-6 text-center">
              <h3 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" /> OFFICIAL LEADERBOARD
              </h3>
              <p className="text-sm text-slate-500 mt-1">Real-time rankings of students who gave the live test</p>
           </div>
           {/* Humara updated leaderboard component yahan aayega */}
           <QuizLeaderboard quizId={quizId} currentAttemptId={attempt.id} />
        </div>
      </main>
    </div>
  )
}

// Sub-component for Stats
function StatBox({ icon, label, value, color, bg }: any) {
  return (
    <div className={`p-4 rounded-2xl ${bg} flex items-center gap-4 transition-transform hover:scale-105`}>
      <div className={`h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider opacity-60">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
      </div>
    </div>
  )
}
