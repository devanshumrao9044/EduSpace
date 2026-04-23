import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, Award, Clock, CheckCircle, XCircle, 
  AlertCircle, Trophy, Zap, Eye, X, History 
} from 'lucide-react'
import QuizLeaderboard from '@/components/features/QuizLeaderboard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
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

      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle()
      if (!quizData) throw new Error('Quiz not found')

      const { data: attemptData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!attemptData) throw new Error('Attempt not found')

      const submissionTime = new Date(attemptData.submitted_at)
      const deadlineTime = new Date(quizData.end_time)
      const isLate = submissionTime > deadlineTime

      const { count: liveToppersAbove } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .lte('submitted_at', quizData.end_time)
        .gt('score', attemptData.score)

      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_number', { ascending: true })

      setQuiz(quizData)
      setQuestions(qData || [])
      setAttempt({ 
        ...attemptData, 
        isLate, 
        calculatedRank: isLate ? 'N/A' : (liveToppersAbove || 0) + 1 
      })
    } catch (error: any) {
      console.error(error)
      toast.error('Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }

  const stats = (() => {
    if (!attempt || !questions.length) return { correct: 0, wrong: 0, skipped: 0, accuracy: 0 }
    const answers = attempt.answers || {}
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
    <div className="h-screen flex items-center justify-center bg-slate-50 font-black animate-pulse">
      ANALYSING RESULTS...
    </div>
  )

  const resultsPublished = quiz?.show_results_immediately === true;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <header className="bg-white border-b sticky top-0 z-50 px-4 py-4 flex justify-between items-center shadow-sm">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="font-bold">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="font-black text-slate-800 truncate px-4">{quiz?.title}</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
        
        {/* HERO SECTION - ALWAYS INDIGO/BLUE */}
        <div className={`rounded-[2.5rem] p-10 text-white shadow-2xl text-center relative overflow-hidden ${attempt.isLate ? 'bg-slate-800' : 'bg-indigo-600'}`}>
          <div className="relative z-10">
            <Badge className="bg-white/20 mb-4 px-4 py-1 font-black italic border-none tracking-widest uppercase">
              {!resultsPublished ? 'Submission Received' : (attempt.isLate ? 'Practice Mode (Late)' : 'Live Performance')}
            </Badge>
            
            <h2 className="text-8xl font-black mb-2 tracking-tighter italic tabular-nums">
              {!resultsPublished ? 'WAIT' : (attempt.isLate ? '--' : `#${attempt.calculatedRank}`)}
            </h2>
            <p className="opacity-70 font-bold uppercase text-xs tracking-widest">
              {!resultsPublished ? 'Evaluation in progress...' : (attempt.isLate ? 'Not eligible for official ranking' : 'Current Global Rank')}
            </p>

            <div className="flex justify-center gap-8 mt-10">
              <ScoreBox label="Your Score" val={resultsPublished ? attempt.score : '--'} />
              <div className="w-px h-12 bg-white/20" />
              <ScoreBox label="Total Marks" val={quiz?.total_marks} />
            </div>
          </div>
          <Trophy className="absolute -bottom-6 -right-6 w-48 h-48 opacity-10 rotate-12" />
        </div>

        {resultsPublished ? (
          <>
            {/* STATS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatBox color="text-emerald-600" bg="bg-emerald-50" icon={<CheckCircle/>} label="Correct" value={stats.correct} />
              <StatBox color="text-rose-600" bg="bg-rose-50" icon={<XCircle/>} label="Wrong" value={stats.wrong} />
              <StatBox color="text-amber-600" bg="bg-amber-50" icon={<AlertCircle/>} label="Skipped" value={stats.skipped} />
              <StatBox color="text-blue-600" bg="bg-blue-50" icon={<Zap/>} label="Accuracy" value={`${stats.accuracy.toFixed(0)}%`} />
            </div>

            <Button 
              className="w-full h-20 text-xl font-black shadow-xl hover:scale-[1.01] transition-transform rounded-3xl bg-white text-indigo-600 border-2 border-indigo-100 hover:bg-indigo-50 uppercase italic" 
              onClick={() => setIsReviewOpen(true)}
            >
              <Eye className="mr-3 h-6 w-6" /> View Detailed Analysis
            </Button>
          </>
        ) : (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-spin-slow" />
            <p className="text-slate-500 font-bold italic uppercase tracking-tight">
              Result and Answer Key will be visible once published by Admin.
            </p>
          </div>
        )}

        <div className="pt-10 border-t border-slate-200">
           <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-slate-800 italic uppercase">
             <Trophy className="text-yellow-500 w-8 h-8" /> Official Toppers
           </h3>
           <QuizLeaderboard quizId={quizId!} />
        </div>
      </main>

      {/* REVIEW MODAL */}
      {isReviewOpen && resultsPublished && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
          <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b p-5 flex justify-between items-center z-50">
            <Button variant="ghost" size="icon" onClick={() => setIsReviewOpen(false)} className="rounded-full">
              <X className="h-6 w-6 text-slate-500"/>
            </Button>
            <h2 className="font-black text-xl text-slate-800 tracking-tight uppercase italic">Answer Review</h2>
            <div className="flex gap-2">
              <Badge className="bg-emerald-500 font-bold px-3 py-1">{stats.correct} Correct</Badge>
              <Badge className="bg-rose-500 font-bold px-3 py-1">{stats.wrong} Wrong</Badge>
            </div>
          </div>

          <div className="max-w-3xl mx-auto p-6 sm:p-12 space-y-12 pb-32">
            {questions.map((q, idx) => {
              const uAns = attempt.answers?.[q.id]?.answer;
              const isCorrect = uAns?.trim().toUpperCase() === q.correct_answer?.trim().toUpperCase();
              
              return (
                <div key={q.id} className="relative pl-8 border-l-4 border-slate-200 py-2 group hover:border-indigo-400 transition-colors">
                  <div className="absolute -left-[14px] top-0 h-7 w-7 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-black">
                    {idx + 1}
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-xl font-bold text-slate-800 mb-3 leading-tight">{q.question_text}</p>
                    {q.image_url && (
                        <div className="my-4 max-w-full overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                          <img src={q.image_url} alt="Question" className="max-h-[400px] w-auto object-contain mx-auto" />
                        </div>
                    )}
                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Points: {q.marks}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`p-5 rounded-2xl border-2 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                        <p className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">Your Answer</p>
                        <div className="flex justify-between items-center">
                          <p className="font-black text-lg">{uAns || 'Skipped'}</p>
                          {isCorrect ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}
                        </div>
                    </div>
                    
                    <div className="p-5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 text-emerald-900">
                        <p className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">Correct Answer</p>
                        <p className="font-black text-lg">{q.correct_answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreBox({ label, val }: any) {
  return (
    <div className="text-center">
      <p className="text-5xl font-black leading-none mb-2 tabular-nums">{val}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
    </div>
  )
}

function StatBox({ icon, label, value, color, bg }: any) {
  return (
    <div className={`p-5 rounded-[2rem] ${bg} flex items-center gap-4 border border-white shadow-sm transition-all hover:shadow-md`}>
      <div className={`h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-0.5">{label}</p>
        <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
      </div>
    </div>
  )
}
