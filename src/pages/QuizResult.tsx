import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckCircle, Trophy, Clock, X, ChevronLeft, ChevronRight, Loader2, Home, Medal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'

interface AttemptAnswer {
  answer: string
  marked: boolean
}

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [attempt, setAttempt] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Answer review modal state
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)

  useEffect(() => {
    if (quizId) loadResult()
  }, [quizId])

  const loadResult = async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) { window.location.replace('/login'); return }

      const [quizRes, questionsRes, attemptRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).single(),
        supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number'),
        supabase
          .from('quiz_attempts').select('*')
          .eq('quiz_id', quizId).eq('student_id', user.id)
          .maybeSingle(),
      ])

      if (quizRes.error) throw quizRes.error

      // If no submitted attempt, redirect back to attempt page
      if (!attemptRes.data?.submitted_at) {
        window.location.replace(`/quiz/${quizId}`)
        return
      }

      setQuiz(quizRes.data)
      setQuestions(questionsRes.data || [])
      setAttempt(attemptRes.data)

      // Fetch top-10 leaderboard for this quiz
      const { data: lb } = await supabase
        .from('quiz_attempts')
        .select('student_id, score, profiles!quiz_attempts_student_id_fkey(full_name)')
        .eq('quiz_id', quizId)
        .not('submitted_at', 'is', null)
        .order('score', { ascending: false })
        .limit(10)
      setLeaderboard(lb || [])
    } catch {
      toast.error('Failed to load result')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-indigo-400 w-8 h-8" />
      </div>
    )
  }

  // ── GATE: show_results_immediately = false → Evaluation Pending screen ──
  if (!quiz?.show_results_immediately) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          {/* Success indicator */}
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          </div>

          <h1 className="text-3xl font-black text-white mb-2 italic uppercase tracking-tight">
            Test Submitted!
          </h1>
          <p className="text-slate-400 font-bold mb-8 text-sm">
            Your responses have been recorded successfully.
          </p>

          {/* Pending card */}
          <div className="bg-slate-800 border border-slate-700 rounded-[2rem] p-8 mb-8 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center mx-auto mb-5">
              <Clock className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Evaluation Pending</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Your answers are being reviewed by the administrator. Results, scores, and rankings will be published shortly.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-700/50 rounded-2xl p-3">
                <p className="text-2xl font-black text-slate-200">{questions.length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Questions</p>
              </div>
              <div className="bg-slate-700/50 rounded-2xl p-3">
                <p className="text-2xl font-black text-slate-200">
                  {Object.values((attempt?.answers || {}) as Record<string, AttemptAnswer>).filter(a => a?.answer).length}
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attempted</p>
              </div>
              <div className="bg-slate-700/50 rounded-2xl p-3">
                <p className="text-2xl font-black text-slate-200">{quiz?.duration_minutes}m</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duration</p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full h-13 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-xl"
          >
            <Home className="mr-2 w-4 h-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // ── FULL RESULTS: show_results_immediately = true ──
  const answers = (attempt?.answers || {}) as Record<string, AttemptAnswer>
  const score = attempt?.score ?? 0
  const totalMarks = quiz?.total_marks ?? 0
  const passingMarks = quiz?.passing_marks ?? 0
  const passed = score >= passingMarks
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0

  const correct = questions.filter(q => {
    const ua = answers[q.id]?.answer?.trim().toUpperCase()
    return ua && ua === q.correct_answer?.trim().toUpperCase()
  }).length
  const wrong = questions.filter(q => {
    const ua = answers[q.id]?.answer?.trim().toUpperCase()
    return ua && ua !== q.correct_answer?.trim().toUpperCase()
  }).length
  const skipped = questions.length - correct - wrong

  const reviewQuestion = questions[reviewIndex]
  const reviewAnswer = answers[reviewQuestion?.id]
  const isCorrect =
    reviewAnswer?.answer?.trim().toUpperCase() === reviewQuestion?.correct_answer?.trim().toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 pb-12">

      {/* ── Score Hero ── */}
      <div className={`${passed ? 'bg-gradient-to-br from-indigo-600 to-violet-700' : 'bg-gradient-to-br from-slate-700 to-slate-900'} text-white pt-16 pb-20 px-6 text-center`}>
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center mx-auto mb-5">
            {passed
              ? <Trophy className="w-10 h-10 text-yellow-300" />
              : <CheckCircle className="w-10 h-10 text-white/80" />}
          </div>
          <p className="font-black italic uppercase tracking-widest text-white/60 text-xs mb-2">{quiz?.title}</p>
          <h1 className="text-6xl font-black mb-1">{score}</h1>
          <p className="text-white/70 font-bold text-sm mb-4">out of {totalMarks} marks · {percentage}%</p>
          <Badge className={`${passed ? 'bg-emerald-400 text-emerald-900' : 'bg-red-400 text-red-900'} font-black italic uppercase px-4 py-1 text-xs`}>
            {passed ? '✓ Passed' : '✗ Failed'}
          </Badge>
          {attempt?.rank && (
            <p className="mt-4 text-white/80 font-bold text-sm">
              🏅 Rank #{attempt.rank}
            </p>
          )}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="max-w-xl mx-auto px-4 -mt-10">
        <Card className="rounded-[2rem] shadow-2xl border-none p-6 bg-white mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-black text-emerald-600">{correct}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-1">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-black text-red-500">{wrong}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-1">Wrong</p>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-400">{skipped}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-1">Skipped</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${passed ? 'bg-indigo-600' : 'bg-red-400'}`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1.5">
            <span>0</span>
            <span>Passing: {passingMarks}</span>
            <span>{totalMarks}</span>
          </div>
        </Card>

        {/* ── Leaderboard ── */}
        {leaderboard.length > 0 && (
          <Card className="rounded-[2rem] shadow-xl border-none bg-white mb-4 overflow-hidden">
            <div className="px-6 pt-6 pb-3 flex items-center gap-3 border-b border-slate-50">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-sm">Leaderboard</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top {leaderboard.length} Students</p>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {leaderboard.map((entry, i) => {
                const isMe = entry.student_id === attempt?.student_id
                const rankNum = i + 1
                const medalColor =
                  rankNum === 1 ? 'text-amber-400' :
                  rankNum === 2 ? 'text-slate-400' :
                  rankNum === 3 ? 'text-orange-400' : 'text-slate-300'
                const rowBg = isMe ? 'bg-indigo-50' : 'bg-white'

                return (
                  <div key={entry.student_id} className={`flex items-center gap-4 px-6 py-3.5 ${rowBg} transition-colors`}>
                    {/* Rank badge */}
                    <div className="w-8 shrink-0 text-center">
                      {rankNum <= 3
                        ? <Medal className={`w-5 h-5 mx-auto ${medalColor}`} />
                        : <span className="text-xs font-black text-slate-400">#{rankNum}</span>
                      }
                    </div>

                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                        isMe ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {(entry.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold text-sm truncate ${isMe ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {entry.profiles?.full_name || 'Unknown'}
                          {isMe && <span className="ml-2 text-[9px] font-black bg-indigo-200 text-indigo-700 rounded-full px-2 py-0.5 uppercase tracking-wider">You</span>}
                        </p>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right shrink-0">
                      <p className={`font-black text-base ${isMe ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {entry.score ?? '—'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">/ {quiz?.total_marks}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* ── Action Buttons ── */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="rounded-2xl h-12 font-bold border-2"
            onClick={() => navigate('/dashboard')}
          >
            <Home className="mr-2 w-4 h-4" /> Dashboard
          </Button>
          <Button
            className="rounded-2xl h-12 bg-indigo-600 font-bold"
            onClick={() => { setReviewIndex(0); setReviewOpen(true) }}
          >
            Review Answers
          </Button>
        </div>
      </div>

      {/* ── Answer Review Modal ── */}
      {reviewOpen && reviewQuestion && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-6">
          <div className="bg-white w-full lg:max-w-2xl rounded-t-[2.5rem] lg:rounded-[2rem] max-h-[90vh] overflow-y-auto shadow-2xl">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-[2.5rem] lg:rounded-t-[2rem] z-10">
              <div>
                <p className="font-black text-slate-800 text-sm">Answer Review</p>
                <p className="text-[10px] text-slate-400 font-bold">Q{reviewIndex + 1} of {questions.length}</p>
              </div>
              <button onClick={() => setReviewOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {/* Correct/Wrong badge */}
              <Badge className={`mb-4 font-black italic ${isCorrect ? 'bg-emerald-100 text-emerald-700' : reviewAnswer?.answer ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                {isCorrect ? '✓ Correct' : reviewAnswer?.answer ? '✗ Wrong' : '— Skipped'}
              </Badge>

              <p className="text-base font-bold text-slate-800 leading-snug mb-4">{reviewQuestion.question_text}</p>

              {/* Question image */}
              {reviewQuestion.image_url && typeof reviewQuestion.image_url === 'string' && reviewQuestion.image_url.trim() !== '' && (
                <div className="mb-4 rounded-2xl border overflow-hidden bg-slate-50 flex justify-center p-2">
                  <img
                    src={reviewQuestion.image_url}
                    alt="Question visual"
                    className="max-h-[200px] w-auto object-contain rounded-xl"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}

              {/* Options */}
              {reviewQuestion.question_type === 'mcq' && (
                <div className="space-y-2 mb-4">
                  {Object.entries(reviewQuestion.options || {}).map(([key, val]) => {
                    const isCorrectOpt = key === reviewQuestion.correct_answer?.trim().toUpperCase()
                    const isSelected = reviewAnswer?.answer?.trim().toUpperCase() === key
                    return val ? (
                      <div
                        key={key}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${
                          isCorrectOpt
                            ? 'border-emerald-400 bg-emerald-50'
                            : isSelected
                            ? 'border-red-400 bg-red-50'
                            : 'border-slate-100 bg-white'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border-2 shrink-0 ${
                          isCorrectOpt ? 'bg-emerald-500 border-emerald-500 text-white' : isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-slate-200 text-slate-400'
                        }`}>{key}</span>
                        <span className="font-bold text-slate-700 text-sm">{val as string}</span>
                        {isCorrectOpt && <span className="ml-auto text-[10px] font-black text-emerald-600 uppercase">Correct</span>}
                        {isSelected && !isCorrectOpt && <span className="ml-auto text-[10px] font-black text-red-600 uppercase">Your Answer</span>}
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {/* Integer answer */}
              {reviewQuestion.question_type === 'integer' && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-2xl p-4 text-center">
                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Your Answer</p>
                    <p className={`text-xl font-black ${isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
                      {reviewAnswer?.answer || '—'}
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Correct Answer</p>
                    <p className="text-xl font-black text-emerald-600">{reviewQuestion.correct_answer}</p>
                  </div>
                </div>
              )}

              {/* Marks info */}
              <div className="flex gap-3 text-[11px] font-bold text-slate-400">
                <span>+{reviewQuestion.marks} marks</span>
                {reviewQuestion.negative_marks > 0 && <span className="text-red-400">−{reviewQuestion.negative_marks} negative</span>}
              </div>
            </div>

            {/* Modal Nav */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl font-bold"
                onClick={() => setReviewIndex(p => Math.max(0, p - 1))}
                disabled={reviewIndex === 0}
              >
                <ChevronLeft className="mr-1 w-4 h-4" /> Prev
              </Button>
              <Button
                className="flex-1 rounded-xl bg-slate-900 font-bold"
                onClick={() => setReviewIndex(p => Math.min(questions.length - 1, p + 1))}
                disabled={reviewIndex === questions.length - 1}
              >
                Next <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
