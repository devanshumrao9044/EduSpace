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

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const MEDAL_CONFIG = [
  { rank: 1, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Crown },
  { rank: 2, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', icon: Medal },
  { rank: 3, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', icon: Medal },
]

export default function QuizLeaderboard({ quizId, totalMarks }: QuizLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = async () => {
    try {
      // 1. Pehle Quiz ki End Time nikaalo
      const { data: quizData, error: quizErr } = await supabase
        .from('quizzes')
        .select('end_time')
        .eq('id', quizId)
        .single()

      if (quizErr || !quizData) throw new Error("Quiz metadata not found")

      // 2. Official attempts fetch karo (Deadline se pehle wale)
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('student_id, score, submitted_at, profiles(full_name)')
        .eq('quiz_id', quizId)
        .lte('submitted_at', quizData.end_time) // 🔥 SIRF OFFICIAL ATTEMPTS
        .not('submitted_at', 'is', null)
        .order('score', { ascending: false }) 
        .order('submitted_at', { ascending: true }) // Same marks par faster winner

      if (error) throw error

      // 3. Unique Students Filter (Ek student ka sirf pehla official attempt)
      const uniqueToppers: LeaderboardEntry[] = []
      const seenStudents = new Set()

      data?.forEach((attempt: any) => {
        if (!seenStudents.has(attempt.student_id)) {
          seenStudents.add(attempt.student_id)
          uniqueToppers.push(attempt)
        }
      })

      setEntries(uniqueToppers.slice(0, 10)) // Top 10 only
    } catch (err) {
      console.error('Leaderboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (quizId) {
      fetchLeaderboard()

      // Realtime update jab koi naya bacha submit kare
      const channel = supabase
        .channel(`leaderboard-${quizId}`)
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'quiz_attempts', filter: `quiz_id=eq.${quizId}` },
          () => fetchLeaderboard()
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
  }, [quizId])

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
  
  if (entries.length === 0) return (
    <div className="text-center p-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
      <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500 font-medium italic">Official Topper List is empty. <br/>Only live attempts are shown here.</p>
    </div>
  )

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className="space-y-8 mt-10">
      {/* ── Podium View ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto px-2">
        {top3[1] && <PodiumCard entry={top3[1]} rank={2} totalMarks={totalMarks} />}
        {top3[0] && <PodiumCard entry={top3[0]} rank={1} totalMarks={totalMarks} isMain />}
        {top3[2] && <PodiumCard entry={top3[2]} rank={3} totalMarks={totalMarks} />}
      </div>

      {/* ── List View (Rank 4-10) ── */}
      {rest.length > 0 && (
        <Card className="overflow-hidden border-none shadow-2xl rounded-3xl bg-white ring-1 ring-slate-100">
          <CardContent className="p-0">
            {rest.map((entry, index) => {
              const rank = index + 4
              return (
                <div key={entry.student_id} className="flex items-center justify-between p-5 border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="w-8 text-center font-black text-slate-300 italic text-lg">#{rank}</span>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 tracking-tight">{entry.profiles?.full_name || 'Student'}</p>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(entry.submitted_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-indigo-600 leading-none">{entry.score}<span className="text-xs font-normal text-slate-300">/{totalMarks}</span></p>
                    <p className="text-[9px] font-black text-slate-300 uppercase mt-1">Final Score</p>
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

function PodiumCard({ entry, rank, totalMarks, isMain }: any) {
  const cfg = MEDAL_CONFIG[rank - 1]
  const Icon = cfg.icon
  return (
    <div className={`flex flex-col items-center p-4 rounded-3xl border-2 transition-all ${cfg.bg} ${cfg.border} ${isMain ? 'pb-10 shadow-2xl -mt-6 z-10 scale-105' : 'shadow-lg opacity-90'}`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-white shadow-sm mb-3`}>
        <Icon className={`w-6 h-6 ${cfg.color}`} />
      </div>
      <p className="font-black text-[10px] sm:text-xs text-center line-clamp-1 mb-1 text-slate-700 uppercase tracking-tight">
        {entry.profiles?.full_name?.split(' ')[0] || 'Student'}
      </p>
      <p className={`font-black tracking-tighter ${isMain ? 'text-3xl sm:text-4xl text-indigo-600' : 'text-2xl text-slate-800'}`}>
        {entry.score}
      </p>
      <div className={`mt-4 px-3 py-1 rounded-xl bg-white shadow-sm text-[10px] font-black ${cfg.color} border ${cfg.border}`}>
        RANK #{rank}
      </div>
    </div>
  )
}
