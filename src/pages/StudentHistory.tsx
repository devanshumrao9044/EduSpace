import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trophy,
  BookOpen,
  CalendarDays,
  Eye,
  History,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Sidebar from '@/components/layout/Sidebar'

interface AttemptWithQuiz {
  id: string
  quiz_id: string
  student_id: string
  started_at: string
  submitted_at: string | null
  score: number | null
  is_evaluated: boolean
  warning_count: number | null
  quizzes: {
    title: string
    total_marks: number
    passing_marks: number
  } | null
}

function SkeletonCard() {
  return (
    <Card className="border-0 ring-1 ring-gray-100 shadow-sm animate-pulse">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-gray-200 rounded-md w-3/4" />
            <div className="h-3.5 bg-gray-100 rounded w-1/2" />
            <div className="h-3.5 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="w-16 h-16 rounded-full bg-gray-100 shrink-0" />
        </div>
        <div className="mt-4 h-2 bg-gray-100 rounded-full" />
      </CardContent>
    </Card>
  )
}

function ScoreRing({
  score,
  total,
  passing,
}: {
  score: number | null
  total: number
  passing: number
}) {
  if (score === null) {
    return (
      <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex flex-col items-center justify-center shrink-0">
        <Clock className="w-5 h-5 text-amber-500" />
        <span className="text-[9px] text-amber-600 font-semibold mt-0.5">Pending</span>
      </div>
    )
  }

  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const passed = score >= passing
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (pct / 100) * circumference

  const ringColor = passed ? '#10b981' : '#ef4444'
  const bgColor = passed ? '#f0fdf4' : '#fef2f2'
  const borderColor = passed ? '#bbf7d0' : '#fecaca'

  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 relative"
      style={{ background: bgColor, border: `2px solid ${borderColor}` }}
    >
      <svg
        className="absolute inset-0 w-full h-full -rotate-90"
        viewBox="0 0 64 64"
      >
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="relative text-[11px] font-bold" style={{ color: ringColor }}>
        {pct}%
      </span>
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(start: string, end: string | null) {
  if (!end) return null
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}m ${s}s`
}

export default function StudentHistory() {
  const [attempts, setAttempts] = useState<AttemptWithQuiz[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchHistory = async () => {
      const currentUser = await authService.getCurrentUser()
      if (!currentUser) { navigate('/login'); return }
      setUser(currentUser)

      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('id, quiz_id, student_id, started_at, submitted_at, score, is_evaluated, warning_count, quizzes(title, total_marks, passing_marks)')
        .eq('student_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setAttempts(data as AttemptWithQuiz[])
      }
      setLoading(false)
    }

    fetchHistory()
  }, [navigate])

  const submitted = attempts.filter(a => a.submitted_at)
  const inProgress = attempts.filter(a => !a.submitted_at)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-72 p-6 lg:p-8 pt-16 md:pt-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Quiz History</h1>
              <p className="text-sm text-muted-foreground">All your quiz attempts in one place</p>
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        {!loading && submitted.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-foreground">{submitted.length}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Completed</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-emerald-600">
                {submitted.filter(a => a.score !== null && a.quizzes && a.score >= a.quizzes.passing_marks).length}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Passed</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-red-500">
                {submitted.filter(a => a.score !== null && a.quizzes && a.score < a.quizzes.passing_marks).length}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Failed</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-amber-500">
                {submitted.filter(a => (a.warning_count ?? 0) > 0).length}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">With Warnings</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty State */}
        {!loading && attempts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5">
              <BookOpen className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No quizzes attempted yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Head to your dashboard to find available quizzes and start your first attempt.
            </p>
            <Button onClick={() => navigate('/dashboard')} className="gap-2">
              <BookOpen className="w-4 h-4" />
              Browse Quizzes
            </Button>
          </div>
        )}

        {/* In-Progress Attempts */}
        {!loading && inProgress.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
              In Progress ({inProgress.length})
            </h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {inProgress.map(attempt => (
                <Card key={attempt.id} className="border-0 ring-1 ring-amber-200 bg-amber-50/40 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-base leading-snug truncate mb-1">
                          {attempt.quizzes?.title ?? 'Untitled Quiz'}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Started {formatDate(attempt.started_at)} at {formatTime(attempt.started_at)}</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                          <Clock className="w-3 h-3" />
                          In Progress
                        </span>
                      </div>
                      <div className="w-16 h-16 rounded-full bg-amber-100 border-2 border-amber-200 flex flex-col items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-amber-500" />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-amber-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                        onClick={() => navigate(`/quiz/${attempt.quiz_id}/attempt`)}
                      >
                        Continue Quiz
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Completed Attempts */}
        {!loading && submitted.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Completed ({submitted.length})
            </h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {submitted.map(attempt => {
                const quiz = attempt.quizzes
                const score = attempt.score
                const total = quiz?.total_marks ?? 0
                const passing = quiz?.passing_marks ?? 0
                const passed = score !== null && score >= passing
                const duration = formatDuration(attempt.started_at, attempt.submitted_at)
                const warnings = attempt.warning_count ?? 0
                const pendingEval = !attempt.is_evaluated

                return (
                  <Card
                    key={attempt.id}
                    className={`border-0 shadow-sm ring-1 transition-shadow hover:shadow-md ${
                      pendingEval
                        ? 'ring-gray-100'
                        : passed
                        ? 'ring-emerald-100'
                        : 'ring-red-100'
                    }`}
                  >
                    <CardContent className="p-5">
                      {/* Top Row */}
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-base leading-snug mb-1 line-clamp-2">
                            {quiz?.title ?? 'Untitled Quiz'}
                          </h3>

                          {/* Date */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatDate(attempt.submitted_at!)} at {formatTime(attempt.submitted_at!)}</span>
                          </div>

                          {/* Duration */}
                          {duration && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Duration: {duration}</span>
                            </div>
                          )}

                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Status Badge */}
                            {pendingEval ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                                <Clock className="w-3 h-3" />
                                Pending Evaluation
                              </span>
                            ) : passed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Passed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-600 rounded-full text-xs font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                Failed
                              </span>
                            )}

                            {/* Warning Badge */}
                            {warnings > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-500 border border-red-200 rounded-full text-xs font-semibold">
                                <ShieldAlert className="w-3 h-3" />
                                {warnings} {warnings === 1 ? 'Warning' : 'Warnings'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Score Ring */}
                        <ScoreRing score={score} total={total} passing={passing} />
                      </div>

                      {/* Score Bar */}
                      {score !== null && total > 0 && (
                        <div className="mt-4">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground font-medium">Score</span>
                            <span className={`font-bold ${passed ? 'text-emerald-600' : 'text-red-500'}`}>
                              {score} / {total}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-700 ${passed ? 'bg-emerald-500' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(100, (score / total) * 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>0</span>
                            <span className="flex items-center gap-1">
                              <Trophy className="w-2.5 h-2.5" />
                              Pass: {passing}
                            </span>
                            <span>{total}</span>
                          </div>
                        </div>
                      )}

                      {/* Pending eval no bar */}
                      {pendingEval && (
                        <p className="mt-3 text-xs text-muted-foreground italic">
                          This quiz contains descriptive answers and is awaiting manual evaluation.
                        </p>
                      )}

                      {/* Actions */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 text-primary border-primary/30 hover:bg-primary/5"
                          onClick={() => navigate(`/quiz/${attempt.quiz_id}/result`)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Result
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
