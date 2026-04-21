import { useEffect, useState } from 'react'
import { Trophy, Medal, Crown, Clock, User, Loader2 } from 'lucide-react'
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

/* ─── Rank 4-10 ke liye Time format ─── */
function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/* ─── Podium Card (Top 3 Styles) ─── */
const MEDAL_CONFIG = [
  { rank: 1, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Crown },
  { rank: 2, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', icon: Medal },
  { rank: 3, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', icon: Medal },
]

export default function QuizLeaderboard({ quizId, totalMarks }: QuizLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('student_id, score, submitted_at, profiles(full_name)')
      .eq('quiz_id', quizId)
      .not('submitted_at', 'is', null)
      .not('score', 'is', null)
      .order('score', { ascending: false }) // Sabse zyada marks pehle
      .order('submitted_at', { ascending: true }) // Same marks hone par jisne pehle kiya wo upar
      .limit(10) // Sirf top 10

    if (!error && data) {
      setEntries(data as any)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (quizId) {
      fetchLeaderboard()

      /* ─── LIVE REALTIME UPDATES ─── */
      const channel = supabase
        .channel('leaderboard-live')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'quiz_attempts', filter: `quiz_id=eq.${quizId}` },
          () => fetchLeaderboard()
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
  }, [quizId])

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
  if (entries.length === 0) return null

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className="space-y-6 mt-8">
      {/* ── Top 3 Podium View ── */}
      <div className="grid grid-cols-3 gap-3 items-end max-w-2xl mx-auto px-2">
        {/* Rank 2 (Left) */}
        {top3[1] && <PodiumCard entry={top3[1]} rank={2} totalMarks={totalMarks} />}
        {/* Rank 1 (Center - Thoda Bada) */}
        {top3[0] && <PodiumCard entry={top3[0]} rank={1} totalMarks={totalMarks} isMain />}
        {/* Rank 3 (Right) */}
        {top3[2] && <PodiumCard entry={top3[2]} rank={3} totalMarks={totalMarks} />}
      </div>

      {/* ── Rank 4-10 List View ── */}
      {rest.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-black/5">
          <CardHeader className="bg-gray-50/50 border-b py-3">
            <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Top 4 - 10 Rankings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rest.map((entry, index) => {
              const rank = index + 4
              return (
                <div key={entry.student_id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="w-6 text-center font-bold text-gray-400">#{rank}</span>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{entry.profiles?.full_name || 'Student'}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Submitted at {formatTime(entry.submitted_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">{entry.score}<span className="text-xs font-normal text-gray-400">/{totalMarks}</span></p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Score</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ── Podium Helper Card ── */
function PodiumCard({ entry, rank, totalMarks, isMain }: any) {
  const cfg = MEDAL_CONFIG[rank - 1]
  const Icon = cfg.icon
  return (
    <div className={`flex flex-col items-center p-4 rounded-2xl border-2 ${cfg.bg} ${cfg.border} ${isMain ? 'pb-8 shadow-xl -mt-4' : 'shadow-md shadow-black/5'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm mb-2`}>
        <Icon className={`w-5 h-5 ${cfg.color}`} />
      </div>
      <p className="font-bold text-xs text-center line-clamp-1 mb-1">{entry.profiles?.full_name || 'Student'}</p>
      <p className={`text-2xl font-black ${isMain ? 'text-3xl' : ''} text-gray-800`}>{entry.score}</p>
      <p className="text-[10px] font-bold text-gray-400 uppercase">Points</p>
      <div className={`mt-3 px-2 py-0.5 rounded-full bg-white/80 text-[10px] font-black ${cfg.color} border ${cfg.border}`}>
        RANK #{rank}
      </div>
    </div>
  )
}
