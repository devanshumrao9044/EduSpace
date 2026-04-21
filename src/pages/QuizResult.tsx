import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, Award, Clock, CheckCircle, XCircle, 
  AlertCircle, Trophy, TrendingUp, Zap, Target, Eye, X, History
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
  const [isReviewOpen, setIsReviewOpen] = useState(false) // Review Modal Toggle

  useEffect(() => {
    if (quizId) loadResult()
  }, [quizId])

  const loadResult = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return; }

      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
      if (!quizData) throw new Error('Quiz not found')

      const { data: attemptData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()

      if (!attemptData) throw new Error('Attempt not found')

      const { count: liveToppersAbove } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .lte('submitted_at', quizData.end_time)
        .gt('score', attemptData.score)

      const isLive = new Date(attemptData.submitted_at) <= new Date(quizData.end_time)

      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_number', { ascending: true })

      setQuiz(quizData)
      setQuestions(qData || [])
      setAttempt({ ...attemptData, isLive, calculatedRank: (liveToppersAbove || 0) + 1 })
    } catch (error: any) {
      toast.error('Failed to load result')
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
    const attemptedCount = questions.length - skipped
    const accuracy = attemptedCount > 0 ? (correct / attemptedCount) * 100 : 0
    return { correct, wrong, skipped, accuracy }
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  const stats = calculateStats()

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 px-4 py-4 flex justify-between items-center">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
        <h1 className="font-bold text-slate-800">{quiz?.title}</h1>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        {/* HERO SECTION */}
        <div className={`rounded-3xl p-8 text-white shadow-xl ${attempt.isLive ? 'bg-indigo-600' : 'bg-slate-800'}`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <Badge className="bg-white/20 mb-4">{attempt.isLive ? 'LIVE RANK' : 'EXPECTED RANK'}</Badge>
              <h2 className="text-6xl font-black mb-2">#{attempt.calculatedRank}</h2>
              <p className="opacity-80">Rank among all live participants</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 p-6 rounded-2xl text-center min-w-[140px]">
                <p className="text-4xl font-black">{attempt.score}</p>
                <p className="text-[10px] font-bold uppercase opacity-60">Your Score</p>
              </div>
              <div className="bg-white/10 p-6 rounded-2xl text-center min-w-[140px]">
                <p className="text-4xl font-black">{quiz?.total_marks}</p>
                <p className="text-[10px] font-bold uppercase opacity-60">Total Marks</p>
              </div>
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox color="text-emerald-600" bg="bg-emerald-50" icon={<CheckCircle/>} label="Correct" value={stats.correct} />
          <StatBox color="text-rose-600" bg="bg-rose-50" icon={<XCircle/>} label="Wrong" value={stats.wrong} />
          <StatBox color="text-amber-600" bg="bg-amber-50" icon={<AlertCircle/>} label="Skipped" value={stats.skipped} />
          <StatBox color="text-blue-600" bg="bg-blue-50" icon={<Zap/>} label="Accuracy" value={`${stats.accuracy.toFixed(1)}%`} />
        </div>

        {/* 🔥 REVIEW BUTTON 🔥 */}
        <Button 
          className="w-full h-16 text-xl font-black shadow-lg hover:scale-[1.01] transition-transform" 
          onClick={() => setIsReviewOpen(true)}
        >
          <Eye className="mr-3 h-6 w-6" /> VIEW DETAILED ANSWER REVIEW
        </Button>

        {/* LEADERBOARD */}
        <div className="pt-8 border-t border-slate-200">
           <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Trophy className="text-yellow-500" /> TOPPERS LIST</h3>
           <QuizLeaderboard quizId={quizId} currentAttemptId={attempt.id} />
        </div>
      </main>

      {/* 🔥 FULL SCREEN REVIEW OVERLAY 🔥 */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-bottom duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-50">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setIsReviewOpen(false)}><X className="h-5 w-5"/></Button>
              <h2 className="font-bold text-xl">Answer Review</h2>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-emerald-500">{stats.correct} Sahi</Badge>
              <Badge className="bg-rose-500">{stats.wrong} Galat</Badge>
            </div>
          </div>

          <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-10">
            {questions.map((q, idx) => {
              const uAns = (attempt.answers as any)[q.id]?.answer;
              const isCorrect = uAns?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase();
              const isSkipped = !uAns;

              return (
                <div key={q.id} className="relative pl-6 border-l-4 border-slate-100 transition-colors hover:border-primary">
                  <div className="absolute -left-[14px] top-0 h-6 w-6 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-lg font-bold text-slate-800 mb-2 leading-relaxed">{q.question_text}</p>
                    <Badge variant="outline" className="text-[10px] text-slate-400 font-bold uppercase">Weightage: {q.marks} Marks</Badge>
                  </div>

                  <div className="grid gap-3">
                    {['A', 'B', 'C', 'D'].map((optKey) => {
                      const optText = (q.options as any)?.[optKey];
                      if (!optText) return null;

                      const isRightOption = q.correct_answer.toUpperCase() === optKey;
                      const isUserChoice = uAns?.toUpperCase() === optKey;

                      // 🔥 COLOR LOGIC 🔥
                      let cardStyle = "border-slate-200 bg-white opacity-70";
                      let icon = null;

                      if (isRightOption) {
                        cardStyle = "border-emerald-500 bg-emerald-50 opacity-100 ring-1 ring-emerald-500";
                        icon = <CheckCircle className="h-5 w-5 text-emerald-600" />;
                      } else if (isUserChoice && !isCorrect) {
                        cardStyle = "border-rose-500 bg-rose-50 opacity-100 ring-1 ring-rose-500";
                        icon = <XCircle className="h-5 w-5 text-rose-600" />;
                      }

                      return (
                        <div key={optKey} className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${cardStyle}`}>
                          <span className={`h-8 w-8 flex items-center justify-center rounded-lg font-bold border ${isRightOption ? 'bg-emerald-500 text-white border-none' : 'bg-slate-100 text-slate-600'}`}>
                            {optKey}
                          </span>
                          <span className="flex-1 font-medium">{optText}</span>
                          {icon}
                        </div>
                      );
                    })}
                  </div>

                  {/* Integer/Paragraph Type Handling */}
                  {q.question_type !== 'mcq' && (
                    <div className="mt-4 grid sm:grid-cols-2 gap-4">
                       <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Your Answer</p>
                          <p className="font-bold">{uAns || 'Not Answered'}</p>
                       </div>
                       <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50">
                          <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">Correct Answer</p>
                          <p className="font-bold text-emerald-800">{q.correct_answer}</p>
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="py-10">
              <Button className="w-full" size="lg" onClick={() => setIsReviewOpen(false)}>Done Reviewing</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon, label, value, color, bg }: any) {
  return (
    <div className={`p-4 rounded-2xl ${bg} flex items-center gap-4 transition-transform hover:scale-105 shadow-sm`}>
      <div className={`h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider opacity-60">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
      </div>
    </div>
  )
}
