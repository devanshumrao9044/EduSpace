import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Trash2, Loader2, Pencil, X, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
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
    question_text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correct_answer: '',
    marks: 1
  })

  useEffect(() => {
    if (quizId) loadQuestions()
  }, [quizId])

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_number', { ascending: true })

      if (error) throw error
      setQuestions(data || [])
    } catch (error: any) {
      console.error(error)
      toast.error('Questions load nahi ho paaye')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (q: Question) => {
    setEditingId(q.id)
    setQuestionType(q.question_type as any)
    const opts = (q.options as any) || {}
    setFormData({
      question_text: q.question_text || '',
      optionA: opts.A || '',
      optionB: opts.B || '',
      optionC: opts.C || '',
      optionD: opts.D || '',
      correct_answer: q.correct_answer || '',
      marks: q.marks || 1
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      question_text: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correct_answer: '',
      marks: 1
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // MCQ type ke liye strict check - in case empty submit ho
    let finalAnswer = formData.correct_answer
    if (questionType === 'mcq' && !['A', 'B', 'C', 'D'].includes(finalAnswer)) {
      toast.error("Please select a valid option (A, B, C, or D) for the correct answer.")
      return
    }

    const payload = {
      quiz_id: quizId!,
      question_text: formData.question_text,
      question_type: questionType,
      correct_answer: finalAnswer,
      marks: formData.marks,
      options: questionType === 'mcq' ? {
        A: formData.optionA,
        B: formData.optionB,
        C: formData.optionC,
        D: formData.optionD
      } : null
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('questions').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Updated!')
      } else {
        const { error } = await supabase.from('questions').insert([
          { ...payload, order_number: (questions?.length || 0) + 1 }
        ])
        if (error) throw error
        toast.success('Added!')
      }
      resetForm()
      loadQuestions()
    } catch (error: any) {
      toast.error('Save error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this?')) return
    try {
      await supabase.from('questions').delete().eq('id', id)
      toast.success('Deleted')
      loadQuestions()
    } catch (error) {
      toast.error('Delete failed')
    }
  }

  // Handle Tab Change to reset answer logic safely
  const handleTypeChange = (value: 'mcq' | 'integer' | 'paragraph') => {
    setQuestionType(value)
    if (value === 'mcq') {
       if (!['A', 'B', 'C', 'D'].includes(formData.correct_answer)) {
           setFormData({ ...formData, correct_answer: '' }) // Reset if invalid for MCQ
       }
    } else {
       setFormData({ ...formData, correct_answer: '' })
    }
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/quizzes')} className="font-bold">
          <ArrowLeft className="mr-2 h-4 w-4"/> Back
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className={editingId ? "border-indigo-500 shadow-xl" : "border-none shadow-md"}>
              <CardHeader className="bg-white border-b">
                <CardTitle className="flex justify-between items-center text-xl font-black italic">
                  <div className="flex items-center gap-4">
                    <span>{editingId ? "EDITING" : "ADD QUESTION"}</span>
                    {!editingId && (
                      <QuestionBulkUploader 
                        quizId={quizId!}
                        questionsCount={questions?.length || 0}
                        onUploadComplete={loadQuestions} 
                      />
                    )}
                  </div>
                  {editingId && <Button variant="ghost" size="sm" onClick={resetForm}><X className="h-5 w-5"/></Button>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs value={questionType} onValueChange={(v) => handleTypeChange(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100">
                    <TabsTrigger value="mcq" className="font-bold">MCQ</TabsTrigger>
                    <TabsTrigger value="integer" className="font-bold">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph" className="font-bold">Paragraph</TabsTrigger>
                  </TabsList>
                </Tabs>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Textarea
                    placeholder="Enter question text..."
                    className="min-h-[120px] text-lg font-medium rounded-xl"
                    value={formData.question_text}
                    onChange={e => setFormData({...formData, question_text: e.target.value})}
                    required
                  />
                  {questionType === 'mcq' && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input placeholder="Option A" value={formData.optionA} onChange={e => setFormData({...formData, optionA: e.target.value})} required/>
                      <Input placeholder="Option B" value={formData.optionB} onChange={e => setFormData({...formData, optionB: e.target.value})} required/>
                      <Input placeholder="Option C" value={formData.optionC} onChange={e => setFormData({...formData, optionC: e.target.value})} required/>
                      <Input placeholder="Option D" value={formData.optionD} onChange={e => setFormData({...formData, optionD: e.target.value})} required/>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 items-end">
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Correct Answer</label>
                      {/* 🔥 FIXED CORRECT ANSWER FIELD 🔥 */}
                      {questionType === 'mcq' ? (
                        <select
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={formData.correct_answer}
                          onChange={e => setFormData({...formData, correct_answer: e.target.value})}
                          required
                        >
                          <option value="" disabled>Select Option</option>
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>
                      ) : (
                        <Input
                          placeholder="Correct Answer"
                          value={formData.correct_answer}
                          onChange={e => setFormData({...formData, correct_answer: e.target.value})}
                          required
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marks</label>
                       <Input
                         type="number"
                         placeholder="Marks"
                         value={formData.marks}
                         onChange={e => setFormData({...formData, marks: parseInt(e.target.value) || 1})}
                       />
                    </div>
                  </div>
                  <Button type="submit" className={`w-full h-14 font-black text-lg mt-4 ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                    {editingId ? "SAVE CHANGES" : "ADD QUESTION"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-md h-fit">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-black uppercase opacity-60 flex items-center gap-2">
                <ListChecks className="w-4 h-4"/> Questions ({questions?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {(!questions || questions.length === 0) ? (
                <div className="p-12 text-center text-slate-300 font-bold italic">Empty</div>
              ) : (
                questions.map((q, i) => (
                  <div key={q.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="truncate flex-1">
                      <div className="text-[10px] font-black text-slate-400">#0{i + 1} | {q.question_type.toUpperCase()}</div>
                      <p className="font-bold truncate text-slate-700 text-sm">{q.question_text}</p>
                    </div>
                    <div className="flex gap-1 ml-4">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(q)} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
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
