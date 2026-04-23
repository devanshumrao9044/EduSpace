import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, Clock, Trophy, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { authService } from '@/lib/auth'

export default function CreateQuiz() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    total_marks: 100,
    passing_marks: 40,
    start_time: '',
    end_time: '',
    is_active: false,
    show_results_immediately: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 🔥 STEP 3: PREVENT DOUBLE SUBMISSION
    if (loading) return 

    // Validation & Sanitization
    const cleanTitle = formData.title.trim()
    const cleanDescription = formData.description.trim()

    if (!cleanTitle) {
      toast.error('Please enter quiz title')
      return
    }
    
    if (!cleanDescription) {
      toast.error('Please enter quiz description')
      return
    }
    
    if (!formData.start_time || !formData.end_time) {
      toast.error('Please select start and end time')
      return
    }
    
    if (new Date(formData.end_time) <= new Date(formData.start_time)) {
      toast.error('End time must be after start time')
      return
    }
    
    if (formData.passing_marks > formData.total_marks) {
      toast.error('Passing marks cannot exceed total marks')
      return
    }

    setLoading(true)

    try {
      const user = await authService.getCurrentUser()
      
      if (!user) {
        toast.error('You must be logged in')
        navigate('/login')
        return
      }

      const formattedData = {
        ...formData,
        title: cleanTitle,
        description: cleanDescription,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        created_by: user.id
      }

      const { data, error } = await supabase
        .from('quizzes')
        .insert(formattedData)
        .select()
        .single()

      if (error) throw error

      toast.success('Quiz created successfully!')
      navigate(`/admin/quiz/${data.id}/questions`)
    } catch (error: any) {
      console.error('Error creating quiz:', error)
      toast.error(error.message || 'Failed to create quiz')
      
      // 🔥 STEP 3: COOLDOWN (Don't allow instant retry on error)
      setTimeout(() => setLoading(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/quizzes')}
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quizzes
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create New Quiz</h1>
          <p className="text-muted-foreground">Set up quiz configuration and details</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Quiz title and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Quiz Title *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Mathematics Final Exam"
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Provide detailed information about this quiz..."
                  rows={4}
                  required
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Quiz Configuration
              </CardTitle>
              <CardDescription>Duration and scoring settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
                  <Input
                    id="duration_minutes"
                    name="duration_minutes"
                    type="number"
                    min="1"
                    value={formData.duration_minutes}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="total_marks">Total Marks *</Label>
                  <Input
                    id="total_marks"
                    name="total_marks"
                    type="number"
                    min="1"
                    value={formData.total_marks}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="passing_marks">Passing Marks *</Label>
                  <Input
                    id="passing_marks"
                    name="passing_marks"
                    type="number"
                    min="1"
                    value={formData.passing_marks}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Schedule
              </CardTitle>
              <CardDescription>Set quiz availability window</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    name="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input
                    id="end_time"
                    name="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Settings
              </CardTitle>
              <CardDescription>Quiz behavior and visibility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Activate Quiz</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can see and attempt this quiz
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleSwitchChange('is_active', checked)}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show_results_immediately">Show Results Immediately</Label>
                  <p className="text-sm text-muted-foreground">
                    Display results right after submission
                  </p>
                </div>
                <Switch
                  id="show_results_immediately"
                  checked={formData.show_results_immediately}
                  onCheckedChange={(checked) => handleSwitchChange('show_results_immediately', checked)}
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/quizzes')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Creating...' : 'Create Quiz'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
