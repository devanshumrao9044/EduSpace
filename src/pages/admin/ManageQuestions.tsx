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
      toast.error("Please select a valid option (A, B, C, or D) for the correct answer.")
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

  const handleTypeChange = (value: 'mcq' | 'integer' | 'paragraph') => {
    setQuestionType(value)
    if (value === 'mcq') {
       if (!['A', 'B', 'C', 'D'].includes(formData.correct_answer)) {
           setFormData({ ...formData, correct_answer: '' })
       }
    } else {
       setFormData({ ...formData, correct_answer: '' })
    }
  }

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50 overflow-hidden">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  )

  return (
    // 👇 FIX 1: pt-12 (Padding Top) add kiya taaki Status Bar se overlap na ho
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gray-50 p-4 pt-12 sm:p-8 sm:pt-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/quizzes')} className="font-bold -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4"/> Back
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className={editingId ? "border-indigo-500 shadow-xl" : "border-none shadow-md"}>
              <CardHeader className="bg-white border-b px-4 sm:px-6">
                <CardTitle className="flex justify-between items-center text-lg sm:text-xl font-black italic">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
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
              <CardContent className="p-4 sm:p-6">
                
                <Tabs value={questionType} onValueChange={(v) => handleTypeChange(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100">
                    <TabsTrigger value="mcq" className="font-bold text-xs sm:text-sm">MCQ</TabsTrigger>
                    <TabsTrigger value="integer" className="font-bold text-xs sm:text-sm">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph" className="font-bold text-xs sm:text-sm">Paragraph</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* IMAGE UPLOAD UI */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Question Image (Optional)</label>
                      {formData.image_url && (
                        <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="text-xs text-red-500 font-bold hover:underline">
                          Remove Image
                        </button>
                      )}
                    </div>
                    
                    {formData.image_url ? (
                      <div className="relative rounded-xl border-2 border-dashed border-indigo-200 overflow-hidden bg-slate-50 flex justify-center p-2">
                        <img 
                          src={formData.image_url} 
                          alt="Preview" 
                          className="max-h-[300px] max-w-full object-contain rounded-lg transition-transform hover:scale-[1.02] cursor-zoom-in"
                        />
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-indigo-300 transition-all"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        ) : (
                          <>
                            <UploadCloud className="h-6 w-6 text-slate-400 mb-1" />
                            <span className="text-xs font-bold text-slate-500">Click to upload image</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleImageUpload}
                        />
                      </div>
                    )}
                  </div>

                  <Textarea
                    placeholder={formData.image_url ? "Type question text here (Optional)..." : "Enter question text..."}
                    className="min-h-[120px] text-base sm:text-lg font-medium rounded-xl w-full"
                    value={formData.question_text}
                    onChange={e => setFormData({...formData, question_text: e.target.value})}
                  />
                  
                  {questionType === 'mcq' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <Input placeholder="Option A" value={formData.optionA} onChange={e => setFormData({...formData, optionA: e.target.value})} required className="w-full"/>
                      <Input placeholder="Option B" value={formData.optionB} onChange={e => setFormData({...formData, optionB: e.target.value})} required className="w-full"/>
                      <Input placeholder="Option C" value={formData.optionC} onChange={e => setFormData({...formData, optionC: e.target.value})} required className="w-full"/>
                      <Input placeholder="Option D" value={formData.optionD} onChange={e => setFormData({...formData, optionD: e.target.value})} required className="w-full"/>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 sm:items-end">
                    <div className="space-y-1 w-full">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Correct Answer</label>
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
                          className="w-full"
                        />
                      )}
                    </div>

                    <div className="flex gap-3 sm:gap-4 sm:col-span-2">
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marks (+)</label>
                        <Input
                          type="number"
                          placeholder="Marks"
                          value={formData.marks}
                          onChange={e => setFormData({...formData, marks: parseFloat(e.target.value) || 1})}
                          min={0}
                          step="0.25"
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Negative (-)</label>
                        <Input
                          type="number"
                          placeholder="Neg Marks"
                          value={formData.negative_marks}
                          onChange={e => setFormData({...formData, negative_marks: parseFloat(e.target.value) || 0})}
                          min={0}
                          step="0.25"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={isUploadingImage} className={`w-full h-14 font-black text-lg mt-4 ${editingId ? 'bg-indigo-600' : 'bg-slate-900'} disabled:opacity-50`}>
                    {editingId ? "SAVE CHANGES" : "ADD QUESTION"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-md h-fit">
            <CardHeader className="bg-slate-50 border-b p-4">
              <CardTitle className="text-sm font-black uppercase opacity-60 flex items-center gap-2">
                <ListChecks className="w-4 h-4"/> Questions ({questions?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
              {(!questions || questions.length === 0) ? (
                <div className="p-8 sm:p-12 text-center text-slate-300 font-bold italic">Empty</div>
              ) : (
                questions.map((q: any, i) => (
                  <div key={q.id} className="p-3 sm:p-4 border-b flex justify-between items-center hover:bg-slate-50 transition-colors w-full">
                    
                    {/* 👇 FIX 2: min-w-0 add kiya taaki truncate kaam kare aur dhakka na de */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400">#0{i + 1} | {q.question_type.toUpperCase()}</span>
                        {q.image_url && <ImageIcon className="w-3 h-3 text-indigo-500" />}
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{q.marks}</span>
                        {q.negative_marks > 0 && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{q.negative_marks}</span>
                        )}
                      </div>
                      <p className="font-bold truncate text-slate-700 text-xs sm:text-sm">
                        {q.question_text ? q.question_text : <span className="italic text-slate-400">Image Based Question</span>}
                      </p>
                    </div>
                    
                    {/* 👇 FIX 3: shrink-0 add kiya taaki icons hamesha dikhen, screen ke bahar na jayen */}
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(q)} className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600 hover:bg-indigo-50"><Pencil className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="h-7 w-7 sm:h-8 sm:w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
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

