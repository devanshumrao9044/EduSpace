import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Calendar, Clock, Users, Edit, Trash2, Eye, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import type { Quiz } from '@/types/database'

export default function QuizList() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadQuizzes()
  }, [])

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      console.log('Quizzes loaded:', data)
      setQuizzes(data || [])
    } catch (error: any) {
      console.error('Error loading quizzes:', error)
      toast.error('Failed to load quizzes')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (quiz: Quiz) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_active: !quiz.is_active })
        .eq('id', quiz.id)

      if (error) throw error

      toast.success(quiz.is_active ? 'Quiz deactivated' : 'Quiz activated')
      loadQuizzes()
    } catch (error: any) {
      console.error('Error toggling quiz:', error)
      toast.error('Failed to update quiz')
    }
  }

  const handleDelete = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz? This will also delete all questions and attempts.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId)

      if (error) throw error

      toast.success('Quiz deleted successfully')
      loadQuizzes()
    } catch (error: any) {
      console.error('Error deleting quiz:', error)
      toast.error('Failed to delete quiz')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getQuizStatus = (quiz: Quiz) => {
    const now = new Date()
    const start = new Date(quiz.start_time)
    const end = new Date(quiz.end_time)

    if (!quiz.is_active) return { label: 'Inactive', color: 'bg-gray-100 text-gray-700' }
    if (now < start) return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700' }
    if (now > end) return { label: 'Ended', color: 'bg-red-100 text-red-700' }
    return { label: 'Active', color: 'bg-green-100 text-green-700' }
  }

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Quizzes</h1>
              <p className="text-muted-foreground mt-1">Manage all quizzes and questions</p>
            </div>
            <Button onClick={() => navigate('/admin/quiz/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Quiz
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {quizzes.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
                <p className="text-muted-foreground mb-6">
                  Get started by creating your first quiz
                </p>
                <Button onClick={() => navigate('/admin/quiz/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Quiz
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {quizzes.map((quiz) => {
              const status = getQuizStatus(quiz)
              
              return (
                <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground truncate">
                            {quiz.title}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {quiz.description}
                        </p>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{quiz.duration_minutes} mins</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(quiz.start_time)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{quiz.total_marks} marks</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xs text-muted-foreground">Active</span>
                          <Switch
                            checked={quiz.is_active}
                            onCheckedChange={() => handleToggleActive(quiz)}
                          />
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/quiz/${quiz.id}/questions`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Manage Questions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/admin/quiz/${quiz.id}/results`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Results
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(quiz.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Quiz
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
