import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Upload, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import type { Quiz, Question, QuestionInsert } from '@/types/database'

export default function ManageQuestions() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  
  // 🔥 Ek hi form use hoga Add aur Edit dono ke liye
  const [editingId, setEditingId] = useState<string | null>(null)
  const [questionType, setQuestionType] = useState<'mcq' | 'integer' | 'paragraph'>('mcq')
  const [formData, setFormData] = useState({
    question_text: '', optionA: '', optionB: '', optionC: '', optionD: '', correct_answer: '', marks: 1
  })

  useEffect(() => { if (quizId) loadQuestions() }, [quizId])

  const loadQuestions = async () => {
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number', { ascending: true })
    setQuestions(data || [])
    setLoading(false)
  }

  // --- EDIT BUTTON CLICK ---
  const handleEdit = (q: Question) => {
    setEditingId(q.id)
    setQuestionType(q.question_type)
    setFormData({
      question_text: q.question_text,
      optionA: q.options?.A || '',
      optionB: q.options?.B || '',
      optionC: q.options?.C || '',
      optionD: q.options?.D || '',
      correct_answer: q.correct_answer,
      marks: q.marks
    })
    window.scrollTo({ top: 0, behavior: 'smooth' }) // Form par le jane ke liye
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({ question_text: '', optionA: '', optionB: '', optionC: '', optionD: '', correct_answer: '', marks: 1 })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      quiz_id: quizId!,
      question_text: formData.question_text,
      question_type: questionType,
      correct_answer: formData.correct_answer,
      marks: formData.marks,
      options: questionType === 'mcq' ? { A: formData.optionA, B: formData.optionB, C: formData.optionC, D: formData.optionD } : null
    }

    if (editingId) {
      await supabase.from('questions').update(payload).eq('id', editingId)
      toast.success('Question Updated')
    } else {
      await supabase.from('questions').insert([{ ...payload, order_number: questions.length + 1 }])
      toast.success('Question Added')
    }
    resetForm()
    loadQuestions()
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/quizzes')}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* FORM SECTION */}
          <div className="lg:col-span-2 space-y-6">
            <Card className={editingId ? "border-blue-500 shadow-lg" : ""}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  {editingId ? "Editing Question" : "Add Question"}
                  {editingId && <Button variant="ghost" size="sm" onClick={resetForm}><X className="h-4 w-4 mr-1"/> Cancel</Button>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as any)} className="mb-4">
                  <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="mcq">MCQ</TabsTrigger><TabsTrigger value="integer">Int</TabsTrigger><TabsTrigger value="paragraph">Para</TabsTrigger></TabsList>
                </Tabs>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Textarea placeholder="Question Text" value={formData.question_text} onChange={e => setFormData({...formData, question_text: e.target.value})} required/>
                  {questionType === 'mcq' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Option A" value={formData.optionA} onChange={e => setFormData({...formData, optionA: e.target.value})}/>
                      <Input placeholder="Option B" value={formData.optionB} onChange={e => setFormData({...formData, optionB: e.target.value})}/>
                    </div>
                  )}
                  <Input placeholder="Answer" value={formData.correct_answer} onChange={e => setFormData({...formData, correct_answer: e.target.value})}/>
                  <Button type="submit" className={`w-full ${editingId ? 'bg-blue-600' : 'bg-green-600'}`}>
                    {editingId ? <><Pencil className="mr-2 h-4 w-4"/> Update Question</> : <><Plus className="mr-2 h-4 w-4"/> Add Question</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* LIST SECTION (Jahan Edit/Delete buttons hain) */}
          <Card>
            <CardHeader><CardTitle>Questions ({questions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {questions.map((q, i) => (
                <div key={q.id} className={`p-3 border rounded-lg flex justify-between items-center bg-white ${editingId === q.id ? 'border-blue-500 bg-blue-50' : ''}`}>
                  <div className="truncate pr-2">
                    <span className="font-bold text-xs text-gray-400">Q{i+1}</span>
                    <p className="text-sm truncate font-medium">{q.question_text}</p>
                  </div>
                  <div className="flex gap-1">
                    {/* 🔥 EDIT BUTTON - SAME STYLE AS DELETE */}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(q)} className="hover:bg-blue-100">
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={async () => { if(confirm('Delete?')) { await supabase.from('questions').delete().eq('id', q.id); loadQuestions(); } }} className="hover:bg-red-100">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
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
