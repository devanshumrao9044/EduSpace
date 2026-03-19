import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import type { Quiz, Question, QuestionInsert } from '@/types/database'
import Papa from 'papaparse'

export default function ManageQuestions() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [questionType, setQuestionType] = useState<'mcq' | 'integer' | 'paragraph'>('mcq')
  const [formData, setFormData] = useState({
    question_text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correct_answer: '',
    marks: 1
  })

  useEffect(() => {
    if (quizId) {
      loadQuiz()
      loadQuestions()
    }
  }, [quizId])

  const loadQuiz = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (error) throw error
      setQuiz(data)
    } catch (error: any) {
      console.error('Error loading quiz:', error)
      toast.error('Failed to load quiz')
    }
  }

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_number', { ascending: true })

      if (error) throw error
      setQuestions(data || [])
    } catch (error: any) {
      console.error('Error loading questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.question_text.trim()) {
      toast.error('Please enter question text')
      return
    }

    if (!formData.correct_answer.trim()) {
      toast.error('Please enter correct answer')
      return
    }

    if (questionType === 'mcq' && (!formData.optionA || !formData.optionB)) {
      toast.error('Please provide at least 2 options for MCQ')
      return
    }

    try {
      const newQuestion: QuestionInsert = {
        quiz_id: quizId!,
        question_text: formData.question_text,
        question_type: questionType,
        correct_answer: formData.correct_answer,
        marks: formData.marks,
        order_number: questions.length + 1,
        options: questionType === 'mcq' ? {
          A: formData.optionA,
          B: formData.optionB,
          C: formData.optionC,
          D: formData.optionD
        } : null
      }

      const { error } = await supabase
        .from('questions')
        .insert(newQuestion)

      if (error) throw error

      toast.success('Question added successfully')
      setFormData({
        question_text: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correct_answer: '',
        marks: 1
      })
      loadQuestions()
    } catch (error: any) {
      console.error('Error adding question:', error)
      toast.error('Failed to add question')
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (error) throw error

      toast.success('Question deleted')
      loadQuestions()
    } catch (error: any) {
      console.error('Error deleting question:', error)
      toast.error('Failed to delete question')
    }
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const csvQuestions: QuestionInsert[] = results.data.map((row: any, index: number) => ({
            quiz_id: quizId!,
            question_text: row.question || row.Question || '',
            question_type: (row.type || row.Type || 'mcq').toLowerCase() as 'mcq' | 'integer' | 'paragraph',
            options: row.type?.toLowerCase() === 'mcq' ? {
              A: row.optionA || row.OptionA || '',
              B: row.optionB || row.OptionB || '',
              C: row.optionC || row.OptionC || '',
              D: row.optionD || row.OptionD || ''
            } : null,
            correct_answer: row.answer || row.Answer || '',
            marks: parseInt(row.marks || row.Marks || '1'),
            order_number: questions.length + index + 1
          }))

          const { error } = await supabase
            .from('questions')
            .insert(csvQuestions)

          if (error) throw error

          toast.success(`${csvQuestions.length} questions uploaded successfully`)
          loadQuestions()
          e.target.value = ''
        } catch (error: any) {
          console.error('Error uploading CSV:', error)
          toast.error('Failed to upload questions')
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error)
        toast.error('Failed to parse CSV file')
      }
    })
  }

  const downloadCSVTemplate = () => {
    const template = [
      {
        question: 'What is 2 + 2?',
        type: 'mcq',
        optionA: '3',
        optionB: '4',
        optionC: '5',
        optionD: '6',
        answer: 'B',
        marks: '1'
      },
      {
        question: 'What is the capital of France?',
        type: 'paragraph',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        answer: 'Paris',
        marks: '2'
      },
      {
        question: 'How many days in a week?',
        type: 'integer',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        answer: '7',
        marks: '1'
      }
    ]

    const csv = Papa.unparse(template)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quiz_questions_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quizzes
          </Button>
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-foreground">{quiz?.title}</h1>
            <p className="text-muted-foreground">Manage questions for this quiz</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Add Question Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Add Question</CardTitle>
                <CardDescription>Create questions for your quiz</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="mcq">Multiple Choice</TabsTrigger>
                    <TabsTrigger value="integer">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph">Paragraph</TabsTrigger>
                  </TabsList>

                  <form onSubmit={handleAddQuestion} className="mt-6 space-y-4">
                    <div>
                      <Label>Question *</Label>
                      <Textarea
                        value={formData.question_text}
                        onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                        placeholder="Enter your question..."
                        rows={3}
                        required
                      />
                    </div>

                    <TabsContent value="mcq" className="space-y-4 mt-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Option A *</Label>
                          <Input
                            value={formData.optionA}
                            onChange={(e) => setFormData({ ...formData, optionA: e.target.value })}
                            placeholder="First option"
                          />
                        </div>
                        <div>
                          <Label>Option B *</Label>
                          <Input
                            value={formData.optionB}
                            onChange={(e) => setFormData({ ...formData, optionB: e.target.value })}
                            placeholder="Second option"
                          />
                        </div>
                        <div>
                          <Label>Option C</Label>
                          <Input
                            value={formData.optionC}
                            onChange={(e) => setFormData({ ...formData, optionC: e.target.value })}
                            placeholder="Third option"
                          />
                        </div>
                        <div>
                          <Label>Option D</Label>
                          <Input
                            value={formData.optionD}
                            onChange={(e) => setFormData({ ...formData, optionD: e.target.value })}
                            placeholder="Fourth option"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Correct Answer (A/B/C/D) *</Label>
                        <Input
                          value={formData.correct_answer}
                          onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value.toUpperCase() })}
                          placeholder="e.g., A"
                          maxLength={1}
                          required
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="integer" className="space-y-4 mt-4">
                      <div>
                        <Label>Correct Answer (Number) *</Label>
                        <Input
                          type="number"
                          value={formData.correct_answer}
                          onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                          placeholder="e.g., 42"
                          required
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="paragraph" className="space-y-4 mt-4">
                      <div>
                        <Label>Sample Answer / Keywords *</Label>
                        <Textarea
                          value={formData.correct_answer}
                          onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                          placeholder="Enter expected answer or keywords for manual evaluation..."
                          rows={3}
                          required
                        />
                      </div>
                    </TabsContent>

                    <div>
                      <Label>Marks *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.marks}
                        onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) || 1 })}
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Question
                    </Button>
                  </form>
                </Tabs>
              </CardContent>
            </Card>

            {/* CSV Upload */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Bulk Upload</CardTitle>
                <CardDescription>Upload multiple questions via CSV</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button variant="outline" onClick={downloadCSVTemplate} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <Label htmlFor="csv-upload" className="flex-1">
                    <Button variant="outline" className="w-full" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload CSV
                      </span>
                    </Button>
                  </Label>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Questions List */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Questions ({questions.length})</CardTitle>
                <CardDescription>All questions in this quiz</CardDescription>
              </CardHeader>
              <CardContent>
                {questions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No questions yet. Add your first question.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {questions.map((question, index) => (
                      <div key={question.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-primary">Q{index + 1}</span>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                                {question.question_type.toUpperCase()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                              </span>
                            </div>
                            <p className="text-sm text-foreground line-clamp-2">
                              {question.question_text}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
