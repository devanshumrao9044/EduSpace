import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, Clock, Trophy, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'

export default function EditQuiz() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  // Database ke UTC time ko aapke local format mein badalne ke liye
  const formatToLocalDatetime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().slice(0, 16)
  }

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const { data, error } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        if (data) {
          setFormData({
            title: data.title || '',
            description: data.description || '',
            duration_minutes: data.duration_minutes || 30,
            total_marks: data.total_marks || 100,
            passing_marks: data.passing_marks || 40,
            start_time: formatToLocalDatetime(data.start_time),
            end_time: formatToLocalDatetime(data.end_time),
            is_active: data.is_active || false,
            show_results_immediately: data.show_results_immediately || false,
          })
        }
      } catch (error: any) {
        console.error('Error fetching quiz:', error)
        toast.error('Failed to load quiz details')
        navigate('/admin/quizzes')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchQuiz()
  }, [id, navigate])

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
    
    if (!formData.title.trim() || !formData.start_time || !formData.end_time) {
      toast.error('Please fill required fields')
      return
    }
    
    if (new Date(formData.end_time) <= new Date(formData.start_time)) {
      toast.error('End time must be after start time')
      return
    }

    setSaving(true)

    try {
      const formattedData = {
        ...formData,
        // Wapas database mein bhejte time proper ISO format mein set karna
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      }

      const { error } = await supabase
        .from('quizzes')
        .update(formattedData)
        .eq('id', id)

      if (error) throw error

      toast.success('Quiz updated successfully!')
      navigate('/admin/quizzes')
    } catch (error: any) {
      console.error('Error updating quiz:', error)
      toast.error(error.message || 'Failed to update quiz')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quizzes
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Edit Quiz</h1>
          <p className="text-muted-foreground">Update quiz timing and configuration</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Quiz Title *</Label>
                <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4} required />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Quiz Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
                  <Input id="duration_minutes" name="duration_minutes" type="number" min="1" value={formData.duration_minutes} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="total_marks">Total Marks *</Label>
                  <Input id="total_marks" name="total_marks" type="number" min="1" value={formData.total_marks} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="passing_marks">Passing Marks *</Label>
                  <Input id="passing_marks" name="passing_marks" type="number" min="1" value={formData.passing_marks} onChange={handleChange} required />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input id="start_time" name="start_time" type="datetime-local" value={formData.start_time} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input id="end_time" name="end_time" type="datetime-local" value={formData.end_time} onChange={handleChange} required />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5" /> Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Activate Quiz</Label>
                <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => handleSwitchChange('is_active', checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_results_immediately">Show Results Immediately</Label>
                <Switch id="show_results_immediately" checked={formData.show_results_immediately} onCheckedChange={(checked) => handleSwitchChange('show_results_immediately', checked)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/admin/quizzes')}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
