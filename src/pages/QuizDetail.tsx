import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Award, Calendar, PlayCircle, AlertCircle, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import type { Quiz, QuizAttempt } from '@/types/database'

export default function QuizDetail() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeUntilStart, setTimeUntilStart] = useState('')

  useEffect(() => {
    loadQuiz()
  }, [quizId])

  useEffect(() => {
    if (!quiz) return

    const interval = setInterval(() => {
      const now = new Date()
      const start = new Date(quiz.start_time)
      const diff = start.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeUntilStart('Quiz has started!')
        clearInterval(interval)
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        const parts = []
        if (days > 0) parts.push(`${days}d`)
        if (hours > 0) parts.push(`${hours}h`)
        if (minutes > 0) parts.push(`${minutes}m`)
        if (seconds > 0) parts.push(`${seconds}s`)

        setTimeUntilStart(parts.join(' '))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [quiz])

  const loadQuiz = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (quizError) throw quizError
      setQuiz(quizData)

      // Fetch ONLY the first/latest attempt to show status
      const { data: attemptData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: true }) // First attempt for official score
        .limit(1)
        .maybeSingle()

      setAttempt(attemptData)
    } catch (error: any) {
      console.error('Error loading quiz:', error)
      toast.error('Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleStartQuiz = () => {
    if (!quiz) return

    const now = new Date()
    const start = new Date(quiz.start_time)
    const end = new Date(quiz.end_time)

    if (now < start) {
      toast.error('Quiz has not started yet')
      return
    }

    // 🔥 Re-attempt Alert
    if (attempt) {
        const isPractice = now > end;
        const msg = isPractice 
            ? "Live deadline khatam ho chuki hai. Ye attempt sirf 'Practice' ke liye hoga. Shuru karein?"
            : "Aapne ye test pehle diya hai. Re-attempt karne par ye official rank mein nahi aayega. Shuru karein?";
        
        if (!window.confirm(msg)) return;
    }

    navigate(`/quiz/${quizId}/attempt`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const renderActionSection = () => {
    if (!quiz) return null
    const now = new Date()
    const start = new Date(quiz.start_time)
    const end = new Date(quiz.end_time)

    // 1. Upcoming
    if (now < start) {
      return (
        <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl text-center">
          <Clock className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
          <h3 className="font-bold text-indigo-900 text-lg">Quiz Starts In</h3>
          <p className="text-2xl font-black text-indigo-600">{timeUntilStart}</p>
        </div>
      )
    }

    // 2. Live or Ended (Re-attempt allowed)
    const isLive = now >= start && now <= end;

    return (
      <div className="space-y-4">
        <Button size="lg" className={`w-full text-lg h-14 ${!isLive ? 'bg-orange-600 hover:bg-orange-700' : ''}`} onClick={handleStartQuiz}>
          <PlayCircle className="w-5 h-5 mr-2" />
          {!attempt ? (isLive ? 'Start Live Quiz' : 'Start Practice Mode') : 'Re-attempt Quiz'}
        </Button>
        
        {attempt && (
          <Button variant="outline" size="lg" className="w-full h-14" onClick={() => navigate(`/quiz/${quizId}/result`)}>
            View Previous Analysis
          </Button>
        )}

        {!isLive && !attempt && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
                <AlertCircle className="w-4 h-4"/>
                Aapne Live test miss kar diya hai. Ab aap sirf practice kar sakte hain.
            </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="h-screen flex items-center justify-center font-bold">Loading Quiz Details...</div>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}><ArrowLeft /></Button>
        <h1 className="font-bold text-lg">Quiz Overview</h1>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        <Card className="border-none shadow-lg overflow-hidden rounded-3xl">
          <CardHeader className="bg-white border-b p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <CardTitle className="text-3xl font-black text-slate-800">{quiz.title}</CardTitle>
                <p className="text-slate-500 font-medium">{quiz.description}</p>
              </div>
              {attempt && (
                <Badge className="bg-emerald-500 text-white px-4 py-1 text-sm rounded-full">
                  Official Score: {attempt.score}/{quiz.total_marks}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2"/>
                <p className="text-[10px] font-black text-slate-400 uppercase">Duration</p>
                <p className="font-bold text-slate-700">{quiz.duration_minutes} Mins</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <Award className="w-6 h-6 text-purple-500 mx-auto mb-2"/>
                <p className="text-[10px] font-black text-slate-400 uppercase">Max Marks</p>
                <p className="font-bold text-slate-700">{quiz.total_marks}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <Target className="w-6 h-6 text-emerald-500 mx-auto mb-2"/>
                <p className="text-[10px] font-black text-slate-400 uppercase">Passing</p>
                <p className="font-bold text-slate-700">{quiz.passing_marks}</p>
              </div>
            </div>

            {/* Schedule Info */}
            <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 border rounded-2xl flex items-center gap-4">
                    <Calendar className="text-slate-400"/>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Start Date</p>
                        <p className="text-sm font-bold">{formatDate(quiz.start_time)}</p>
                    </div>
                </div>
                <div className="p-4 border rounded-2xl flex items-center gap-4">
                    <Calendar className="text-slate-400"/>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">End Date</p>
                        <p className="text-sm font-bold">{formatDate(quiz.end_time)}</p>
                    </div>
                </div>
            </div>

            {/* Important Notes */}
            <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl space-y-3">
              <h3 className="font-bold text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4"/> Important Instructions
              </h3>
              <ul className="text-sm text-amber-700 space-y-2 font-medium">
                <li>• Aap is quiz ko jitni baar chahein attempt kar sakte hain.</li>
                <li>• Sirf aapka <b>pehla submission</b> hi official rank ke liye mana jayega.</li>
                <li>• Baaki saare attempts 'Practice' category mein aayenge.</li>
              </ul>
            </div>

            {/* 🔥 Action Section 🔥 */}
            <div className="pt-4">
              {renderActionSection()}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function Target(props: any) {
    return (
      <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    )
}
