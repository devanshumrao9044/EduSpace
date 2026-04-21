import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, Award, Clock, CheckCircle, XCircle, 
  AlertCircle, Trophy, Zap, Eye, X
} from 'lucide-react'
import QuizLeaderboard from '@/components/features/QuizLeaderboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import type { Quiz, Question } from '@/types/database'

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
  const [isReviewOpen, setIsReviewOpen] = useState(false)

  useEffect(() => {
    if (quizId) loadResult()
  }, [quizId])

  const loadResult = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return; }

      // 1. Fetch Quiz - maybeSingle use kiya taaki crash na ho
      const { data: quizData, error: qErr } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .maybeSingle()

      if (qErr || !quizData) throw new Error('Quiz not found')

      // 2. Fetch Latest Attempt - .limit(1) aur order zaroori hai re-attempt ke liye
      const { data: attemptData, error: aErr } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false }) 
        .limit(1)
        .maybeSingle()

      if (aErr || !attemptData) throw new Error('Attempt not found')

      // 3. Rank calculation (Sirf unka jo deadline se pehle submit hue)
      const { count: liveToppersAbove } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .lte('submitted_at', quizData.end_time)
        .gt('score', attemptData.score)

      const isLive = new Date(attemptData.submitted_at) <= new Date(quizData.end_time)

      // 4. Questions fetch
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_number', { ascending: true })

      setQuiz(quizData)
      setQuestions(qData || [])
      setAttempt({ ...attemptData, isLive, calculatedRank: (liveToppersAbove || 0) + 1 })
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Result load karne mein panga hua hai')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    if (!attempt || !questions.length) return { correct: 0, wrong: 0, skipped: 0, accuracy: 0 }
    const answers = (attempt.answers || {}) as Record<string, Answer>
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
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  if (!attempt) return <div className="p-20 text-center font-bold">Result not found.</div>

  const stats = calculateStats()

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 px-4 py-4 flex justify-between items-center shadow-sm">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="font-bold">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <h1 className="font-black text-slate-800 truncate max-w-[200px] sm:max-w-none">{quiz?.title}</h1>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        {/* HERO SECTION */}
        <div className={`rounded-3xl p-8 text-white shadow-2xl ${attempt.isLive ? 'bg-indigo-600' : 'bg-slate-800'}`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <Badge className="bg-white/20 mb-4 px-3 py-1 font-bold">
                {attempt.isLive ? 'LIVE PERFORMANCE' : 'PRACTICE MODE'}
              </Badge>
              <h2 className="text-7xl font-black mb-2">#{attempt.calculatedRank}</h2>
              <p className="opacity-70 font-medium">Rank among official participants</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl text-center min-w-[140px] border border-white/10">
                <p className="text-5xl font-black leading-none mb-2">{attempt.score}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Your Points</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl text-center min-w-[140px] border border-white/10">
                <p className="text-5xl font-black leading-none mb-2">{quiz?.total_marks}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Out of</p>
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

        <Button 
          className="w-full h-20 text-xl font-black shadow-xl hover:scale-[1.01] transition-all bg-white text-indigo-600 border-2 border-indigo-100 hover:bg-indigo-50" 
          onClick={() => setIsReviewOpen(true)}
        >
          <Eye className="mr-3 h-6 w-6" /> VIEW ANSWER ANALYSIS
        </Button>

        {/* LEADERBOARD */}
        <div className="pt-10 border-t border-slate-200">
           <h3 className="text-2xl font-black mb-8 flex items-center gap-3 italic text-slate-800">
             <Trophy className="text-yellow-500 w-8 h-8" /> OFFICIAL TOPPERS
           </h3>
           <QuizLeaderboard quizId={quizId!} totalMarks={quiz?.total_marks} />
        </div>
      </main>

      {/* REVIEW MODAL */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300">
          <div className="sticky top-0 bg-white border-b p-5 flex justify-between items-center z-50 shadow-sm">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setIsReviewOpen(false)} className="rounded-full">
                <X className="h-6 w-6 text-slate-500"/>
              </Button>
              <h2 className="font-black text-xl text-slate-800">Reviewing Answers</h2>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-emerald-500 font-bold px-3 py-1">{stats.correct} Correct</Badge>
              <Badge className="bg-rose-500 font-bold px-3 py-1">{stats.wrong} Incorrect</Badge>
            </div>
          </div>

          <div className="max-w-3xl mx-auto p-6 sm:p-12 space-y-12">
            {questions.map((q, idx) => {
              const uAns = (attempt.answers as any)[q.id]?.answer;
              const isCorrect = uAns?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase();
              
              return (
                <div key={q.id} className="relative pl-8 border-l-4 border-slate-200 py-2">
                  <div className="absolute -left-[14px] top-0 h-7 w-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-black">
                    {idx + 1}
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-xl font-bold text-slate-800 mb-3 leading-tight">{q.question_text}</p>
                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Value: {q.marks} Marks
                    </Badge>
                  </div>

                  <div className="grid gap-4">
                    {['A', 'B', 'C', 'D'].map((optKey) => {
                      const optText = (q.options as any)?.[optKey];
                      if (!optText) return null;

                      const isRightOption = q.correct_answer.toUpperCase() === optKey;
                      const isUserChoice = uAns?.toUpperCase() === optKey;

                      let style = "border-slate-100 bg-slate-50/50 text-slate-400";
                      if (isRightOption) style = "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500 shadow-sm";
                      if (isUserChoice && !isCorrect) style = "border-rose-500 bg-rose-50 text-rose-900 ring-1 ring-rose-500 shadow-sm";

                      return (
                        <div key={optKey} className={`p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${style}`}>
                          <span className={`h-8 w-8 flex items-center justify-center rounded-xl font-black border-2 ${isRightOption ? 'bg-emerald-500 text-white border-none' : 'bg-white text-slate-400'}`}>
                            {optKey}
                          </span>
                          <span className="flex-1 font-bold text-base">{optText}</span>
                          {isRightOption && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                          {isUserChoice && !isCorrect && <XCircle className="h-6 w-6 text-rose-500" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="py-20 text-center">
              <Button size="lg" className="px-12 font-black rounded-2xl" onClick={() => setIsReviewOpen(false)}>Close Analysis</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon, label, value, color, bg }: any) {
  return (
    <div className={`p-5 rounded-3xl ${bg} flex items-center gap-4 shadow-sm border border-white/50 transition-all hover:translate-y-[-2px]`}>
      <div className={`h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-0.5">{label}</p>
        <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
      </div>
    </div>
  )
}
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
