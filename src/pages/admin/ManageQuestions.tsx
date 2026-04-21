import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Upload, Loader2 } from 'lucide-react'
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
  const [isUploading, setIsUploading] = useState(false)
  const [questionType, setQuestionType] = useState<'mcq' | 'integer' | 'paragraph'>('mcq')
  const [formData, setFormData] = useState({
    question_text: '', optionA: '', optionB: '', optionC: '', optionD: '', correct_answer: '', marks: 1
  })

  useEffect(() => {
    if (quizId) { loadQuiz(); loadQuestions(); }
  }, [quizId])

  const loadQuiz = async () => {
    const { data } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
    if (data) setQuiz(data)
  }

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number', { ascending: true })
      if (error) throw error
      setQuestions(data || [])
    } finally { setLoading(false) }
  }

  /* ─── CSV SANITIZER (Mobile Notes Fixer) ─── */
  const sanitizeAndParse = (rawText: string) => {
    let clean = rawText.split('\n')
      .map(line => line.trim().replace(/^"|"$/g, ''))
      .join('');
    clean = clean.replace(/""/g, '"');
    const formatted = clean.replace(/(\d)"/g, '$1\n"');
    return formatted;
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const rawText = event.target?.result as string
        const fixedCSV = sanitizeAndParse(rawText)

        Papa.parse(fixedCSV, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const csvQuestions: QuestionInsert[] = results.data
              .filter((row: any) => row.question_text || row.question)
              .map((row: any, index: number) => {
                const type = (row.question_type || row.type || 'mcq').toLowerCase()
                return {
                  quiz_id: quizId!,
                  question_text: row.question_text || row.question || '',
                  question_type: type as any,
                  options: type === 'mcq' ? {
                    A: row.option_a || row.optionA || '',
                    B: row.option_b || row.optionB || '',
                    C: row.option_c || row.optionC || '',
                    D: row.option_d || row.optionD || ''
                  } : null,
                  correct_answer: String(row.correct_answer || row.answer || ''),
                  marks: parseInt(row.marks || '1'),
                  order_number: questions.length + index + 1
                }
              })

            if (csvQuestions.length === 0) throw new Error('No questions found. Check format.')

            const { error } = await supabase.from('questions').insert(csvQuestions)
            if (error) throw error

            toast.success(`${csvQuestions.length} questions uploaded!`)
            loadQuestions()
          },
          error: () => toast.error('Parsing failed')
        })
      } catch (err: any) {
        toast.error(err.message || 'Upload failed')
      } finally {
        setIsUploading(false)
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  /* ─── Manual Actions ─── */
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    const newQ: QuestionInsert = {
      quiz_id: quizId!, question_text: formData.question_text, question_type: questionType,
      correct_answer: formData.correct_answer, marks: formData.marks, order_number: questions.length + 1,
      options: questionType === 'mcq' ? { A: formData.optionA, B: formData.optionB, C: formData.optionC, D: formData.optionD } : null
    }
    await supabase.from('questions').insert(newQ)
    setFormData({ question_text: '', optionA: '', optionB: '', optionC: '', optionD: '', correct_answer: '', marks: 1 })
    loadQuestions()
    toast.success('Added!')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return
    await supabase.from('questions').delete().eq('id', id)
    loadQuestions()
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/quizzes')}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* CSV Card */}
            <Card className="border-2 border-dashed bg-blue-50/50">
              <CardHeader>
                <CardTitle className="text-blue-700">Mobile CSV Fixer</CardTitle>
                <CardDescription>Upload your messy CSV file here</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <input type="file" id="csv" className="hidden" accept=".csv" onChange={handleCSVUpload} disabled={isUploading}/>
                <Label htmlFor="csv">
                  <Button asChild disabled={isUploading} className="bg-blue-600 hover:bg-blue-700">
                    <span>{isUploading ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2"/>} Select CSV File</span>
                  </Button>
                </Label>
              </CardContent>
            </Card>

            {/* Manual Form */}
            <Card>
              <CardHeader><CardTitle>Manual Add</CardTitle></CardHeader>
              <CardContent>
                <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as any)}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="mcq">MCQ</TabsTrigger>
                    <TabsTrigger value="integer">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph">Paragraph</TabsTrigger>
                  </TabsList>
                </Tabs>
                <form onSubmit={handleAddQuestion} className="space-y-4">
                  <Textarea placeholder="Question Text" value={formData.question_text} onChange={e => setFormData({...formData, question_text: e.target.value})} required/>
                  {questionType === 'mcq' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Option A" value={formData.optionA} onChange={e => setFormData({...formData, optionA: e.target.value})}/>
                      <Input placeholder="Option B" value={formData.optionB} onChange={e => setFormData({...formData, optionB: e.target.value})}/>
                      <Input placeholder="Option C" value={formData.optionC} onChange={e => setFormData({...formData, optionC: e.target.value})}/>
                      <Input placeholder="Option D" value={formData.optionD} onChange={e => setFormData({...formData, optionD: e.target.value})}/>
                    </div>
                  )}
                  <Input placeholder="Correct Answer" value={formData.correct_answer} onChange={e => setFormData({...formData, correct_answer: e.target.value})}/>
                  <Input type="number" placeholder="Marks" value={formData.marks} onChange={e => setFormData({...formData, marks: parseInt(e.target.value)})}/>
                  <Button type="submit" className="w-full"><Plus className="mr-2 h-4 w-4"/> Add Question</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* List */}
          <Card>
            <CardHeader><CardTitle>Questions ({questions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {questions.map((q, i) => (
                <div key={q.id} className="p-3 border rounded flex justify-between items-center bg-white shadow-sm">
                  <p className="text-sm truncate flex-1 font-medium">Q{i+1}: {q.question_text}</p>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 text-red-500"/></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
