import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, X, ListChecks, LayoutGrid } from 'lucide-react'
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
  
  // States
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
      question_text: q.question_text,
      optionA: opts.A || '',
      optionB: opts.B || '',
      optionC: opts.C || '',
      optionD: opts.D || '',
      correct_answer: q.correct_answer,
      marks: q.marks
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setEditingId(null)
    setQuestionType('mcq')
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
    const payload = {
      quiz_id: quizId!,
      question_text: formData.question_text,
      question_type: questionType,
      correct_answer: formData.correct_answer,
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
        toast.success('Question update ho gaya!')
      } else {
        const { error } = await supabase.from('questions').insert([
          { ...payload, order_number: questions.length + 1 }
        ])
        if (error) throw error
        toast.success('Naya question add ho gaya!')
      }
      resetForm()
      loadQuestions()
    } catch (error: any) {
      toast.error('Save karne mein error aayi')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Kya aap sach mein ise delete karna chahte hain?')) return
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id)
      if (error) throw error
      toast.success('Question uda diya gaya')
      loadQuestions()
    } catch (error: any) {
      toast.error('Delete nahi ho paya')
    }
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
      <p className="font-bold text-slate-500 animate-pulse uppercase tracking-widest">Loading Manager...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/admin/quizzes')} className="font-bold text-slate-600 hover:bg-white hover:shadow-sm transition-all">
            <ArrowLeft className="mr-2 h-4 w-4"/> Back to Quizzes
          </Button>
          <div className="flex items-center gap-2 text-slate-400 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
            <LayoutGrid className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-tighter">Quiz ID: {quizId?.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 text-slate-800">
          {/* LEFT: FORM SECTION */}
          <div className="lg:col-span-2 space-y-6">
            <Card className={`border-none shadow-xl rounded-[2rem] transition-all overflow-hidden ${editingId ? 'ring-2 ring-indigo-500' : ''}`}>
              <CardHeader className="bg-white border-b border-slate-50 p-6 sm:p-8">
                <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${editingId ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                      {editingId ? <Pencil className="w-6 h-6"/> : <Plus className="w-6 h-6"/>}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black italic tracking-tight uppercase leading-none">
                        {editingId ? "Edit Mode" : "New Question"}
                      </h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Setup your quiz content</p>
                    </div>
                  </div>
                  
                  {!editingId && (
                    <QuestionBulkUploader 
                      quizId={quizId!}
                      questionsCount={questions.length}
                      onUploadComplete={loadQuestions} 
                    />
                  )}
                  
                  {editingId && (
                    <Button variant="outline" size="sm" onClick={resetForm} className="rounded-full border-rose-200 text-rose-500 hover:bg-rose-50 font-bold">
                      <X className="h-4 w-4 mr-1"/> CANCEL EDIT
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 bg-white">
                <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as any)} className="mb-8">
                  <TabsList className="grid w-full grid-cols-3 h-14 bg-slate-50 p-1.5 rounded-2xl">
                    <TabsTrigger value="mcq" className="font-black uppercase tracking-tighter rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">MCQ</TabsTrigger>
                    <TabsTrigger value="integer" className="font-black uppercase tracking-tighter rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph" className="font-black uppercase tracking-tighter rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Paragraph</TabsTrigger>
                  </TabsList>
                </Tabs>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Question Description</label>
                    <Textarea
                      placeholder="Write your question text here..."
                      className="min-h-[140px] text-lg font-medium border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 rounded-2xl p-6 transition-all"
                      value={formData.question_text}
                      onChange={e => setFormData({...formData, question_text: e.target.value})}
                      required
                    />
                  </div>

                  {questionType === 'mcq' && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Multiple Choice Options</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                          <div key={opt} className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xs">{opt}</span>
                            <Input 
                              className="h-14 pl-10 border-slate-100 bg-slate-50/50 focus:bg-white rounded-xl font-bold" 
                              placeholder={`Option ${opt}`} 
                              value={formData[`option${opt}` as keyof typeof formData]} 
                              onChange={e => setFormData({...formData, [`option${opt}`]: e.target.value})} 
                              required
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Correct Answer</label>
                      <Input
                        className="h-14 border-indigo-100 bg-indigo-50/30 focus:bg-white font-black text-indigo-600 rounded-xl"
                        placeholder={questionType === 'mcq' ? "e.g. A" : "Enter correct answer"}
                        value={formData.correct_answer}
                        onChange={e => setFormData({...formData, correct_answer: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marks Weightage</label>
                      <Input
                        className="h-14 border-slate-100 bg-slate-50/50 focus:bg-white font-bold rounded-xl"
                        type="number"
                        placeholder="Marks"
                        value={formData.marks}
                        onChange={e => setFormData({...formData, marks: parseInt(e.target.value) || 1})}
                      />
                    </div>
                  </div>

                  <Button type="submit" className={`w-full h-16 font-black text-xl rounded-2xl shadow-lg transition-all active:scale-[0.98] ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                    {editingId ? "SAVE CHANGES" : "ADD TO QUIZ"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: LIST SECTION */}
          <div className="space-y-6">
            <Card className="border-none shadow-xl rounded-[2rem] h-fit overflow-hidden sticky top-8">
              <CardHeader className="bg-slate-900 text-white p-6 border-b border-white/5">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ListChecks className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-black uppercase tracking-[0.2em]">Inventory</span>
                  </div>
                  <Badge className="bg-indigo-500 font-black">{questions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[calc(100vh-250px)] overflow-y-auto bg-white">
                {questions.length === 0 ? (
                  <div className="p-16 text-center">
                    <p className="text-slate-300 font-black italic uppercase tracking-tighter text-lg">Empty List</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Start adding questions</p>
                  </div>
                ) : (
                  questions.map((q, i) => (
                    <div key={q.id} className={`group p-5 border-b border-slate-50 flex justify-between items-center transition-all hover:bg-slate-50 ${editingId === q.id ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' : ''}`}>
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 rounded text-slate-500 uppercase tracking-tighter">#0{i + 1}</span>
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">{q.question_type}</span>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{q.marks} PTS</span>
                        </div>
                        <p className="font-bold truncate text-slate-700 text-sm">{q.question_text}</p>
                      </div>
                      <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(q)} className="h-9 w-9 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
