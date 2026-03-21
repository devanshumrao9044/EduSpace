import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, Calendar, Award, PlayCircle, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { authService, type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import type { Quiz, QuizAttempt } from '@/types/database'

interface QuizWithAttempt extends Quiz {
  attempt?: QuizAttempt
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizWithAttempt[]>([])
  const [upcomingQuizzes, setUpcomingQuizzes] = useState<QuizWithAttempt[]>([])
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<QuizWithAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
    loadQuizzes()
  }, [])

  const loadUser = async () => {
    const currentUser = await authService.getCurrentUser()
    setUser(currentUser)
  }

  const loadQuizzes = async () => {
    try {
      const currentUser = await authService.getCurrentUser()
      if (!currentUser) return

      const { data: quizzes, error: quizzesError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: true })

      if (quizzesError) throw quizzesError

      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('student_id', currentUser.id)

      if (attemptsError) throw attemptsError

      const now = new Date()
      const available: QuizWithAttempt[] = []
      const upcoming: QuizWithAttempt[] = []
      const attempted: QuizWithAttempt[] = []

      quizzes?.forEach(quiz => {
        const start = new Date(quiz.start_time)
        const end = new Date(quiz.end_time)
        const attempt = attempts?.find(a => a.quiz_id === quiz.id)
        const quizWithAttempt = { ...quiz, attempt }

        if (attempt) {
          attempted.push(quizWithAttempt)
        } else if (now < start) {
          upcoming.push(quizWithAttempt)
        } else if (now >= start && now <= end) {
          available.push(quizWithAttempt)
        }
      })

      setAvailableQuizzes(available)
      setUpcomingQuizzes(upcoming)
      setAttemptedQuizzes(attempted)
    } catch (error: any) {
      console.error('Error loading quizzes:', error)
      toast.error('Failed to load quizzes')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const QuizCard = ({ quiz, type }: { quiz: QuizWithAttempt; type: 'available' | 'upcoming' | 'attempted' }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{quiz.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
          </div>
          {type === 'attempted' && quiz.attempt && (
            <Badge variant={quiz.attempt.is_evaluated ? 'default' : 'secondary'}>
              {quiz.attempt.is_evaluated ? 'Published' : 'Pending'}
            </Badge>
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
