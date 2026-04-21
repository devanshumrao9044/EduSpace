import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Award, Clock, CheckCircle, XCircle, AlertCircle, Trophy, TrendingUp, History } from 'lucide-react'
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
  marked: boolean
}

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<any>(null) // Rank data ke liye 'any' rakha hai
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResult()
  }, [quizId])

  const loadResult = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { navigate('/login'); return; }

      // 1. Fetch Quiz Data
      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
      if (!quizData) throw new Error('Quiz not found')

      // 2. Fetch User Attempt with Ranking (Custom Logic)
      // Note: Yahan hum wahi Ranking System wala view use karenge jo Admin ke liye banaya tha
      const { data: attemptData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()

      // 3. Expected/Official Rank Calculation
      // Ye hum frontend par isliye kar rahe hain taaki bacha LIVE bacchon ke beech apni aukat dekh sake
      const { count: liveCountAbove } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .lte('submitted_at', quizData.end_time) // Sirf live attempts
        .gt('score', attemptData.score)

      const isLive = new Date(attemptData.submitted_at) <= new Date(quizData.end_time)

      // 4. Fetch Questions
      const { data: questionsData } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number')

      setQuiz(quizData)
      setAttempt({ ...attemptData, isLive, calculatedRank: liveCountAbove + 1 })
      setQuestions(questionsData || [])

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Result load hone mein dikkat hai')
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
      else if (uAns.toUpperCase() === q.correct_answer.toUpperCase()) correct++
      else wrong++
    })
    const attempted = questions.length - skipped
    const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0
    return { correct, wrong, skipped, accuracy }
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>

  const stats = calculateStats()
  const passed = attempt?.score >= (quiz?.passing_marks || 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b py-4 px-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/history')}><ArrowLeft/></Button>
        <h1 className="font-bold text-lg">Analysis & Results</h1>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        
        {/* 🔥 PW STYLE RANK CARD 🔥 */}
        <Card className={`overflow-hidden border-none text-white shadow-xl ${attempt.isLive ? 'bg-gradient-to-br from-green-600 to-emerald-800' : 'bg-gradient-to-br from-blue-600 to-indigo-800'}`}>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left space-y-2">
                <Badge className="bg-white/20 text-white border-none mb-2">
                  {attempt.isLive ? 'OFFICIAL RESULT' : 'PRACTICE MODE'}
                </Badge>
                <h2 className="text-4xl font-black">
                  {attempt.isLive ? 'Rank #' : 'Expected Rank #'}{attempt.calculatedRank}
                </h2>
                <p className="opacity-80 text-sm">
                  {attempt.isLive 
                    ? "Your position in the live official leaderboard." 
                    : "Your calculated position among live test takers."}
                </p>
              </div>
              
              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/20 text-center min-w-[180px]">
                <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Score Obtained</p>
                <div className="text-5xl font-black">{attempt.score}</div>
                <p className="text-sm opacity-70 mt-1">out of {quiz?.total_marks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<CheckCircle className="text-green-500"/>} label="Correct" value={stats.correct} bgColor="bg-green-50" />
          <StatCard icon={<XCircle className="text-red-500"/>} label="Wrong" value={stats.wrong} bgColor="bg-red-50" />
          <StatCard icon={<AlertCircle className="text-orange-500"/>} label="Skipped" value={stats.skipped} bgColor="bg-orange-50" />
          <StatCard icon={<TrendingUp className="text-blue-500"/>} label="Accuracy" value={`${stats.accuracy.toFixed(1)}%`} bgColor="bg-blue-50" />
        </div>

        {/* Question Review */}
        <Card>
          <CardHeader><CardTitle>Review Answers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q, i) => {
               const uAns = (attempt.answers as any)[q.id]?.answer;
               const isCorrect = uAns?.toUpperCase() === q.correct_answer.toUpperCase();
               return (
                 <div key={q.id} className={`p-4 border rounded-xl ${!uAns ? 'bg-gray-50' : isCorrect ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
                   <div className="flex justify-between mb-2">
                     <span className="text-xs font-bold uppercase text-gray-400">Question {i+1}</span>
                     <Badge variant="outline">{q.marks} Marks</Badge>
                   </div>
                   <p className="font-medium mb-4">{q.question_text}</p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                     <div className="p-2 rounded bg-white border">
                        <span className="text-gray-500 mr-2">Your Answer:</span>
                        <span className={isCorrect ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{uAns || 'Skipped'}</span>
                     </div>
                     <div className="p-2 rounded bg-white border">
                        <span className="text-gray-500 mr-2">Correct Answer:</span>
                        <span className="text-green-700 font-bold">{q.correct_answer}</span>
                     </div>
                   </div>
                 </div>
               )
            })}
          </CardContent>
        </Card>

        {/* Leaderboard - Isme humne is_live wala logic pehle hi daala hai */}
        <div className="mt-12">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500"/> Official Toppers List
          </h3>
          <QuizLeaderboard quizId={quizId} currentAttemptId={attempt.id} />
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, bgColor }: any) {
  return (
    <Card className={`border-none shadow-sm ${bgColor}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
        <div>
          <p className="text-[10px] uppercase font-bold text-gray-500">{label}</p>
          <p className="text-xl font-black">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
