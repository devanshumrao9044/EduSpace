import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Calendar, Award, PlayCircle, CheckCircle, AlertCircle, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { authService, type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import type { Quiz, QuizAttempt } from '@/types/database'

interface QuizWithAllAttempts extends Quiz {
  all_attempts: QuizAttempt[];
  is_missed?: boolean;
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizWithAllAttempts[]>([])
  const [upcomingQuizzes, setUpcomingQuizzes] = useState<QuizWithAllAttempts[]>([])
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<QuizWithAllAttempts[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      if (currentUser) await loadQuizzes(currentUser.id)
    }
    init()
  }, [])

  const loadQuizzes = async (userId: string) => {
    try {
      // 1. Saare active quizzes mangwao
      const { data: quizzes, error: qErr } = await supabase
        .from('quizzes')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: true })

      if (qErr) throw qErr

      // 2. User ke saare attempts mangwao (In any mode)
      const { data: attempts, error: aErr } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('student_id', userId)
        .order('submitted_at', { ascending: true })

      if (aErr) throw aErr

      const now = new Date()
      const available: QuizWithAllAttempts[] = []
      const upcoming: QuizWithAllAttempts[] = []
      const completed: QuizWithAllAttempts[] = []

      quizzes?.forEach(quiz => {
        const start = new Date(quiz.start_time)
        const end = new Date(quiz.end_time)
        
        // Is specific quiz ke saare attempts filter karo
        const userAttempts = attempts?.filter(a => a.quiz_id === quiz.id) || []
        const quizData: QuizWithAllAttempts = { ...quiz, all_attempts: userAttempts }

        if (userAttempts.length > 0) {
          // Attempt kar liya hai toh 'Attempted' tab mein (Duplicate nahi dikhayega)
          completed.push(quizData)
        } else if (now < start) {
          // Abhi shuru nahi hua
          upcoming.push(quizData)
        } else if (now >= start && now <= end) {
          // Live chal raha hai
          available.push(quizData)
        } else if (now > end) {
          // Time nikal gaya par diya nahi -> 'Available' mein 'Missed' tag ke saath
          available.push({ ...quizData, is_missed: true })
        }
      })

      setAvailableQuizzes(available)
      setUpcomingQuizzes(upcoming)
      setAttemptedQuizzes(completed)
    } catch (error: any) {
      toast.error('Failed to load quizzes')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const QuizCard = ({ quiz, type }: { quiz: QuizWithAllAttempts; type: 'available' | 'upcoming' | 'attempted' }) => {
    const firstAttempt = quiz.all_attempts[0]; // Ranking ke liye pehla attempt
    
    return (
      <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-800">{quiz.title}</h3>
              {quiz.is_missed && (
                <Badge variant="destructive" className="mt-1 animate-pulse">MISSED (Live Ended)</Badge>
              )}
            </div>
            {quiz.all_attempts.length > 0 && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                {quiz.all_attempts.length} Attempt(s)
              </Badge>
            )}
          </div>

          {/* Statistics / History Section */}
          <div className="space-y-3 mb-6">
            {type === 'attempted' ? (
              <div className="bg-slate-50 p-3 rounded-lg border border-dashed border-slate-300">
                <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-2">
                  <History className="w-3 h-3"/> Attempt History
                </p>
                {quiz.all_attempts.map((att, idx) => (
                  <div key={att.id} className="flex justify-between text-sm py-1 border-b last:border-0 border-slate-200">
                    <span className={idx === 0 ? "font-bold text-primary" : "text-slate-500"}>
                      {idx === 0 ? "1st (Official)" : `${idx + 1}th (Practice)`}
                    </span>
                    <span className="font-mono">{att.score}/{quiz.total_marks}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1"><Clock className="w-3 h-3"/> {quiz.duration_minutes}m</div>
                <div className="flex items-center gap-1"><Award className="w-3 h-3"/> {quiz.total_marks} Marks</div>
                <div className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Ends {formatDate(quiz.end_time)}</div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {type === 'available' && (
              <Button className="w-full" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                <PlayCircle className="w-4 h-4 mr-2" />
                {quiz.is_missed ? 'Start Practice' : 'Start Live Quiz'}
              </Button>
            )}

            {type === 'upcoming' && (
              <Button variant="outline" className="w-full" disabled>
                Starts at {formatDate(quiz.start_time)}
              </Button>
            )}

            {type === 'attempted' && (
              <>
                <Button variant="outline" className="flex-1" onClick={() => navigate(`/quiz/result/${quiz.id}`)}>
                  Analysis
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                  Re-attempt
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16 md:mt-0">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">
              Hello, {user?.full_name?.split(' ')[0]}! 👋
            </h2>
            <p className="text-slate-500">Jitni baar chahein practice karein, mehnat kabhi waste nahi jati.</p>
          </div>

          <Tabs defaultValue="available" className="space-y-6">
            <TabsList className="bg-white border p-1 shadow-sm h-12">
              <TabsTrigger value="available" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">Available</TabsTrigger>
              <TabsTrigger value="upcoming" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">Upcoming</TabsTrigger>
              <TabsTrigger value="attempted" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">Attempted</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableQuizzes.map(q => <QuizCard key={q.id} quiz={q} type="available" />)}
              {availableQuizzes.length === 0 && <div className="col-span-full py-20 text-center text-slate-400">Abhi koi test available nahi hai.</div>}
            </TabsContent>

            <TabsContent value="upcoming" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingQuizzes.map(q => <QuizCard key={q.id} quiz={q} type="upcoming" />)}
              {upcomingQuizzes.length === 0 && <div className="col-span-full py-20 text-center text-slate-400">Koi naya test schedule nahi hai.</div>}
            </TabsContent>

            <TabsContent value="attempted" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attemptedQuizzes.map(q => <QuizCard key={q.id} quiz={q} type="attempted" />)}
              {attemptedQuizzes.length === 0 && <div className="col-span-full py-20 text-center text-slate-400">Aapne abhi tak koi test nahi diya hai.</div>}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{quiz.duration_minutes} mins</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(quiz.start_time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4" />
            <span>{quiz.total_marks} marks</span>
          </div>
        </div>

        {type === 'attempted' && quiz.attempt?.is_evaluated && quiz.attempt.score !== null && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Score</span>
              <span className="text-lg font-bold text-primary">
                {quiz.attempt.score}/{quiz.total_marks}
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  quiz.attempt.score >= quiz.passing_marks ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${(quiz.attempt.score / quiz.total_marks) * 100}%` }}
              />
            </div>
          </div>
        )}

        {type === 'available' && (
          <Button
            className="w-full"
            onClick={() => navigate(`/quiz/${quiz.id}`)}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Start Quiz
          </Button>
        )}

        {type === 'upcoming' && (
          <Button variant="outline" className="w-full" disabled>
            <Clock className="w-4 h-4 mr-2" />
            Starts {formatDate(quiz.start_time)}
          </Button>
        )}

        {type === 'attempted' && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/quiz/${quiz.id}/review`)}
          >
            View Details
          </Button>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading quizzes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-0 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16 md:mt-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {user?.full_name?.split(' ')[0]}! 👋
            </h2>
            <p className="text-muted-foreground">
              View and attempt your quizzes
            </p>
          </div>

          <Tabs defaultValue="available" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="available" className="gap-2">
                <PlayCircle className="w-4 h-4" />
                Available
                {availableQuizzes.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{availableQuizzes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-2">
                <Clock className="w-4 h-4" />
                Upcoming
                {upcomingQuizzes.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{upcomingQuizzes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="attempted" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Attempted
                {attemptedQuizzes.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{attemptedQuizzes.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-4">
              {availableQuizzes.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No quizzes available</h3>
                    <p className="text-muted-foreground">
                      Check back later for new quizzes
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {availableQuizzes.map(quiz => (
                    <QuizCard key={quiz.id} quiz={quiz} type="available" />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-4">
              {upcomingQuizzes.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No upcoming quizzes</h3>
                    <p className="text-muted-foreground">
                      All quizzes are either available or completed
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {upcomingQuizzes.map(quiz => (
                    <QuizCard key={quiz.id} quiz={quiz} type="upcoming" />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="attempted" className="space-y-4">
              {attemptedQuizzes.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No attempted quizzes</h3>
                    <p className="text-muted-foreground">
                      Start attempting quizzes to see them here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {attemptedQuizzes.map(quiz => (
                    <QuizCard key={quiz.id} quiz={quiz} type="attempted" />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
