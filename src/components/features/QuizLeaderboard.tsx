import { useEffect, useState } from 'react'
import {
  Trophy,
  Medal,
  Clock,
  Users,
  Crown,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LeaderboardEntry {
  student_id: string
  score: number
  submitted_at: string
  profiles: {
    full_name: string
  } | null
}

interface QuizLeaderboardProps {
  quizId: string
  totalMarks?: number
}

/* ─── Helpers ─────────────────────────────────────────────── */

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/* ─── Medal configs ───────────────────────────────────────── */

const MEDAL_CONFIG = [
  {
    rank: 1,
    bgGradient: 'from-yellow-50 to-amber-50',
    border: 'border-yellow-300',
    badgeBg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    avatarBg: 'bg-gradient-to-br from-yellow-100 to-amber-100',
    avatarText: 'text-amber-700',
    scoreColor: 'text-amber-600',
    icon: Crown,
    iconColor: 'text-yellow-500',
    label: 'Gold',
    shadow: 'shadow-amber-100',
  },
  {
    rank: 2,
    bgGradient: 'from-slate-50 to-gray-50',
    border: 'border-gray-300',
    badgeBg: 'bg-gradient-to-br from-gray-400 to-slate-500',
    avatarBg: 'bg-gradient-to-br from-gray-100 to-slate-100',
    avatarText: 'text-slate-700',
    scoreColor: 'text-slate-600',
    icon: Medal,
    iconColor: 'text-gray-400',
    label: 'Silver',
    shadow: 'shadow-gray-100',
  },
  {
    rank: 3,
    bgGradient: 'from-orange-50 to-amber-50',
    border: 'border-orange-300',
    badgeBg: 'bg-gradient-to-br from-orange-400 to-amber-600',
    avatarBg: 'bg-gradient-to-br from-orange-100 to-amber-100',
    avatarText: 'text-orange-700',
    scoreColor: 'text-orange-600',
    icon: Medal,
    iconColor: 'text-orange-400',
    label: 'Bronze',
    shadow: 'shadow-orange-100',
  },
]

/* ─── Skeleton ────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-8 h-4 bg-gray-100 rounded" />
      <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
      <div className="w-10 h-4 bg-gray-100 rounded" />
    </div>
  )
}

/* ─── Podium Card (Top 3) ─────────────────────────────────── */

function PodiumCard({
  entry,
  rank,
  totalMarks,
}: {
  entry: LeaderboardEntry
  rank: number
  totalMarks?: number
}) {
  const cfg = MEDAL_CONFIG[rank - 1]
  const Icon = cfg.icon
  const name = entry.profiles?.full_name ?? 'Unknown Student'
  const pct = totalMarks && totalMarks > 0
    ? Math.round((entry.score / totalMarks) * 100)
    : null

  return (
    <div
      className={`
        relative flex flex-col items-center p-4 rounded-2xl border-2 shadow-lg
        bg-gradient-to-br ${cfg.bgGradient} ${cfg.border} ${cfg.shadow}
        ${rank === 1 ? 'scale-[1.04] z-10' : ''}
        transition-transform hover:scale-[1.02]
      `}
    >
      {/* Rank Badge */}
      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full ${cfg.badgeBg} flex items-center justify-center shadow-md`}>
        <span className="text-white text-xs font-black">#{rank}</span>
      </div>

      {/* Medal Icon */}
      <Icon className={`w-5 h-5 ${cfg.iconColor} mb-2 mt-2`} />

      {/* Avatar */}
      <div className={`w-12 h-12 rounded-full ${cfg.avatarBg} flex items-center justify-center mb-2 font-bold text-sm ${cfg.avatarText} ring-2 ring-white shadow-sm`}>
        {getInitials(name)}
      </div>

      {/* Name */}
      <p className="font-bold text-sm text-foreground text-center leading-tight line-clamp-2 max-w-[100px] mb-1">
        {name}
      </p>

      {/* Score */}
      <p className={`text-xl font-black ${cfg.scoreColor}`}>
        {entry.score}
        {totalMarks ? <span className="text-xs font-normal text-muted-foreground">/{totalMarks}</span> : ''}
      </p>

      {/* Percentage */}
      {pct !== null && (
        <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
          {pct}%
        </span>
      )}
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────── */

export default function QuizLeaderboard({ quizId, totalMarks }: QuizLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('student_id, score, submitted_at, profiles!quiz_attempts_student_id_fkey(full_name)')
        .eq('quiz_id', quizId)
        .not('submitted_at', 'is', null)
        .not('score', 'is', null)
        .order('score', { ascending: false })
        .order('submitted_at', { ascending: true })
        .limit(10)

      if (!error && data) {
        setEntries(data as LeaderboardEntry[])
      } else if (error) {
        console.error('Leaderboard fetch error:', error)
      }
      setLoading(false)
    }

    if (quizId) fetchLeaderboard()
  }, [quizId])

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  /* Podium order: 2nd | 1st | 3rd */
  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
    ? [top3[1], top3[0]]
    : top3

  const podiumRanks = top3.length === 3 ? [2, 1, 3] : top3.length === 2 ? [2, 1] : [1]

  return (
    <Card className="border-0 shadow-md ring-1 ring-gray-100 overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b pb-4">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Trophy className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <span className="font-bold text-foreground">Leaderboard</span>
            {!loading && entries.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Top {entries.length}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">

        {/* ── Loading ── */}
        {loading && (
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-foreground text-sm mb-1">No attempts yet</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              The leaderboard will appear once students submit this quiz.
            </p>
          </div>
        )}

        {/* ── Podium (Top 3) ── */}
        {!loading && top3.length > 0 && (
          <div className="px-4 pt-6 pb-4">
            <div
              className={`
                grid gap-3 items-end
                ${top3.length === 1 ? 'grid-cols-1 max-w-[160px] mx-auto' : ''}
                ${top3.length === 2 ? 'grid-cols-2 max-w-xs mx-auto' : ''}
                ${top3.length >= 3 ? 'grid-cols-3' : ''}
              `}
            >
              {podiumOrder.map((entry, i) => (
                <PodiumCard
                  key={entry.student_id}
                  entry={entry}
                  rank={podiumRanks[i]}
                  totalMarks={totalMarks}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Ranks 4–10 ── */}
        {!loading && rest.length > 0 && (
          <div className="border-t">
            {rest.map((entry, i) => {
              const rank = i + 4
              const name = entry.profiles?.full_name ?? 'Unknown Student'
              const pct = totalMarks && totalMarks > 0
                ? Math.round((entry.score / totalMarks) * 100)
                : null

              return (
                <div
                  key={entry.student_id}
                  className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                >
                  {/* Rank number */}
                  <span className="w-7 text-center text-sm font-bold text-muted-foreground shrink-0">
                    {rank}
                  </span>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-primary">
                      {getInitials(name)}
                    </span>
                  </div>

                  {/* Name & date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{formatTime(entry.submitted_at)}</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      {entry.score}
                      {totalMarks ? (
                        <span className="text-xs font-normal text-muted-foreground">/{totalMarks}</span>
                      ) : ''}
                    </p>
                    {pct !== null && (
                      <p className="text-[10px] text-muted-foreground">{pct}%</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Footer note ── */}
        {!loading && entries.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t text-center">
            <p className="text-[11px] text-muted-foreground">
              Ranked by highest score · Ties broken by earliest submission
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
