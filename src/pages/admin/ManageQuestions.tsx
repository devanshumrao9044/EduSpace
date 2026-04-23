import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Trash2, Loader2, Pencil, X, ListChecks, Image as ImageIcon, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import QuestionBulkUploader from '@/components/features/QuestionBulkUploader'
import AIQuestionGenerator from '@/components/features/AIQuestionGenerator' // 🔥 AI Component Import

export default function ManageQuestions() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [questionType, setQuestionType] = useState<'mcq' | 'integer' | 'paragraph'>('mcq')
  const [formData, setFormData] = useState({
    question_text: '',
    image_url: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correct_answer: '',
    marks: 1,
    negative_marks: 0
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingImage(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random()}.${fileExt}`
      const filePath = `${quizId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('quiz-images').getPublicUrl(filePath)
      
      setFormData({ ...formData, image_url: data.publicUrl })
      toast.success('Image successfully uploaded!')
    } catch (error: any) {
      console.error(error)
      toast.error('Image upload failed. Bucket check karo.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleEdit = (q: any) => {
    setEditingId(q.id)
    setQuestionType(q.question_type as any)
    const opts = (q.options as any) || {}
    setFormData({
      question_text: q.question_text || '',
      image_url: q.image_url || '',
      optionA: opts.A || '',
      optionB: opts.B || '',
      optionC: opts.C || '',
      optionD: opts.D || '',
      correct_answer: q.correct_answer || '',
      marks: q.marks || 1,
      negative_marks: q.negative_marks || 0
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      question_text: '',
      image_url: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correct_answer: '',
      marks: 1,
      negative_marks: 0
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.question_text.trim() && !formData.image_url) {
      toast.error("Bhai, ya toh question likho ya picture upload karo!")
      return
    }
    
    let finalAnswer = formData.correct_answer
    if (questionType === 'mcq' && !['A', 'B', 'C', 'D'].includes(finalAnswer)) {
      toast.error("Please select a valid option (A, B, C, or D).")
      return
    }

    const payload = {
      quiz_id: quizId!,
      question_text: formData.question_text,
      image_url: formData.image_url,
      question_type: questionType,
      correct_answer: finalAnswer,
      marks: formData.marks,
      negative_marks: formData.negative_marks,
      options: questionType === 'mcq' ? {
        A: formData.optionA,
        B: formData.optionB,
        C: formData.optionC,
        D: formData.optionD
      } : null
    }

    try {
      if (editingId) {
        await supabase.from('questions').update(payload).eq('id', editingId)
        toast.success('Updated!')
      } else {
        await supabase.from('questions').insert([{ ...payload, order_number: (questions?.length || 0) + 1 }])
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
            
            {/* 🔥 AI MAGIC GENERATOR 🔥 */}
            <AIQuestionGenerator 
              quizId={quizId!} 
              onQuestionsGenerated={loadQuestions} 
            />

            <Card className={editingId ? "border-indigo-500 shadow-xl" : "border-none shadow-md"}>
              <CardHeader className="bg-white border-b">
                <CardTitle className="flex justify-between items-center text-xl font-black italic uppercase">
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
                <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100">
                    <TabsTrigger value="mcq" className="font-bold">MCQ</TabsTrigger>
                    <TabsTrigger value="integer" className="font-bold">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph" className="font-bold">Paragraph</TabsTrigger>
                  </TabsList>
                </Tabs>
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Image UI */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Question Image (Optional)</label>
                    {formData.image_url ? (
                      <div className="relative rounded-xl border p-2 bg-slate-50 flex justify-center">
                        <img src={formData.image_url} alt="Preview" className="max-h-[300px] object-contain rounded-lg" />
                        <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2 h-6 w-6 rounded-full p-0" onClick={() => setFormData({...formData, image_url: ''})}><X className="w-4 h-4"/></Button>
                      </div>
                    ) : (
                      <div onClick={() => fileInputRef.current?.click()} className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-all">
                        {isUploadingImage ? <Loader2 className="h-6 w-6 animate-spin text-indigo-500" /> : <><UploadCloud className="h-6 w-6 text-slate-400 mb-1" /><span className="text-xs font-bold text-slate-500">Upload Image</span></>}
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                      </div>
                    )}
                  </div>

                  <Textarea placeholder="Enter question text..." className="min-h-[120px] text-lg rounded-xl" value={formData.question_text} onChange={e => setFormData({...formData, question_text: e.target.value})} />

                  {questionType === 'mcq' && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input placeholder="Option A" value={formData.optionA} onChange={e => setFormData({...formData, optionA: e.target.value})} required/>
                      <Input placeholder="Option B" value={formData.optionB} onChange={e => setFormData({...formData, optionB: e.target.value})} required/>
                      <Input placeholder="Option C" value={formData.optionC} onChange={e => setFormData({...formData, optionC: e.target.value})} required/>
                      <Input placeholder="Option D" value={formData.optionD} onChange={e => setFormData({...formData, optionD: e.target.value})} required/>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Correct Answer</label>
                      {questionType === 'mcq' ? (
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.correct_answer} onChange={e => setFormData({...formData, correct_answer: e.target.value})} required>
                          <option value="" disabled>Select</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                        </select>
                      ) : <Input placeholder="Correct Answer" value={formData.correct_answer} onChange={e => setFormData({...formData, correct_answer: e.target.value})} required />}
                    </div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marks</label><Input type="number" value={formData.marks} onChange={e => setFormData({...formData, marks: parseFloat(e.target.value) || 1})} min={0} step="0.25"/></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Negative</label><Input type="number" value={formData.negative_marks} onChange={e => setFormData({...formData, negative_marks: parseFloat(e.target.value) || 0})} min={0} step="0.25"/></div>
                  </div>
                  <Button type="submit" disabled={isUploadingImage} className={`w-full h-14 font-black text-lg mt-4 ${editingId ? 'bg-indigo-600' : 'bg-slate-900'}`}>{editingId ? "SAVE CHANGES" : "ADD QUESTION"}</Button>
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
              {(!questions || questions.length === 0) ? <div className="p-12 text-center text-slate-300 font-bold italic">Empty</div> : questions.map((q: any, i) => (
                <div key={q.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-slate-400">#0{i + 1} | {q.question_type.toUpperCase()}</span>
                      {q.image_url && <ImageIcon className="w-3 h-3 text-indigo-500" />}
                      <span className="text-[10px] font-bold text-green-600">+{q.marks}</span>
                    </div>
                    <p className="font-bold truncate text-slate-700 text-sm">{q.question_text || "Image Based Question"}</p>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(q)} className="h-8 w-8 text-indigo-600"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="h-8 w-8 text-rose-500"><Trash2 className="h-4 w-4" /></Button>
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
