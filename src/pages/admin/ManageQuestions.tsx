import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
// 🔥 Naya Import yahan hai
import QuestionBulkUploader from '@/components/features/QuestionBulkUploader'
import type { Question } from '@/types/database'

export default function ManageQuestions() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

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

  const handleEdit = (q: Question) => {
    setEditingId(q.id)
    setQuestionType(q.question_type as any)
    setFormData({
      question_text: q.question_text,
      optionA: (q.options as any)?.A || '',
      optionB: (q.options as any)?.B || '',
      optionC: (q.options as any)?.C || '',
      optionD: (q.options as any)?.D || '',
      correct_answer: q.correct_answer,
      marks: q.marks
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      toast.success('Updated!')
    } else {
      await supabase.from('questions').insert([{ ...payload, order_number: questions.length + 1 }])
      toast.success('Added!')
    }
    resetForm()
    loadQuestions()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this?')) return
    await supabase.from('questions').delete().eq('id', id)
    loadQuestions()
    toast.success('Deleted')
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/quizzes')} className="font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="mr-2 h-4 w-4"/> Back to Dashboard
        </Button>

        <div className="grid lg:grid-cols-3 gap-6 text-slate-800">
          {/* FORM SECTION */}
          <div className="lg:col-span-2 space-y-6">
            <Card className={editingId ? "border-indigo-500 shadow-2xl ring-1 ring-indigo-100" : "shadow-md border-none"}>
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="flex justify-between items-center text-xl font-black italic tracking-tight">
                  <div className="flex items-center gap-4">
                    <span>{editingId ? "EDITING MODE" : "ADD NEW QUESTION"}</span>
                    {/* 🔥 Teri Bulk Uploader File yahan use ho rahi hai */}
                    {!editingId && (
                      <QuestionBulkUploader 
                        quizId={quizId!} 
                        onUploadComplete={loadQuestions} 
                      />
                    )}
                  </div>
                  {editingId && (
                    <Button variant="ghost" size="sm" onClick={resetForm} className="text-slate-400 hover:text-rose-500">
                      <X className="h-5 w-5"/>
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 rounded-xl">
                    <TabsTrigger value="mcq" className="font-bold uppercase tracking-tighter">MCQ</TabsTrigger>
                    <TabsTrigger value="integer" className="font-bold uppercase tracking-tighter">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph" className="font-bold uppercase tracking-tighter">Paragraph</TabsTrigger>
                  </TabsList>
                </Tabs>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Textarea
                    placeholder="Enter your question here..."
                    className="min-h-[120px] text-lg font-medium border-slate-200 focus:ring-indigo-500 rounded-xl"
                    value={formData.question_text}
                    onChange={e => setFormData({...formData, question_text: e.target.value})}
                    required
                  />
                  {questionType === 'mcq' && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input className="h-12" placeholder="Option A" value={formData.optionA} onChange={e => setFormData({...formData, optionA: e.target.value})} required/>
                      <Input className="h-12" placeholder="Option B" value={formData.optionB} onChange={e => setFormData({...formData, optionB: e.target.value})} required/>
                      <Input className="h-12" placeholder="Option C" value={formData.optionC} onChange={e => setFormData({...formData, optionC: e.target.value})} required/>
                      <Input className="h-12" placeholder="Option D" value={formData.optionD} onChange={e => setFormData({...formData, optionD: e.target.value})} required/>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      className="h-12 border-indigo-100 focus:border-indigo-500"
                      placeholder="Correct Answer"
                      value={formData.correct_answer}
                      onChange={e => setFormData({...formData, correct_answer: e.target.value})}
                      required
                    />
                    <Input
                      className="h-12"
                      type="number"
                      placeholder="Marks"
                      value={formData.marks}
                      onChange={e => setFormData({...formData, marks: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <Button type="submit" className={`w-full h-14 font-black text-lg rounded-xl shadow-lg transition-all ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                    {editingId ? "UPDATE QUESTION" : "SAVE QUESTION"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* LIST SECTION */}
          <Card className="shadow-md border-none h-fit">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-black uppercase opacity-60 tracking-widest">Question List ({questions.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {questions.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold italic">No questions added yet.</div>
              ) : (
                questions.map((q, i) => (
                  <div key={q.id} className={`p-4 border-b flex justify-between items-center transition-all hover:bg-slate-50 ${editingId === q.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}>
                    <div className="truncate flex-1">
                      <div className="text-[10px] font-black text-slate-400">#0{i + 1} | {q.question_type.toUpperCase()}</div>
                      <p className="font-bold truncate text-slate-700">{q.question_text}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(q)} className="h-9 w-9 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

