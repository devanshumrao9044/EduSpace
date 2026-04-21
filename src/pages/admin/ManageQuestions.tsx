import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import type { Question } from '@/types/database'

export default function ManageQuestions() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

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

  // 🔥 AI-STYLE SMART BULK UPLOAD 🔥
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const reader = new FileReader()
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 5)
        
        // Auto-detect Header
        const startIdx = lines[0].toLowerCase().includes('question') ? 1 : 0
        const dataLines = lines.slice(startIdx)

        const payload = dataLines.map((line, idx) => {
          // Regex handles commas inside quotes correctly
          const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',')
          const d = parts.map(p => p.replace(/^"|"$/g, '').trim())

          // Smart Mapping with Defaults
          const qType = (d[1]?.toLowerCase() === 'integer' || d[1]?.toLowerCase() === 'paragraph') 
                        ? d[1].toLowerCase() 
                        : 'mcq'
          
          return {
            quiz_id: quizId!,
            question_text: d[0] || `Auto-Generated Q${questions.length + idx + 1}`,
            question_type: qType,
            marks: parseInt(d[2]) || 1,
            correct_answer: d[3] || (qType === 'mcq' ? 'A' : '0'),
            options: qType === 'mcq' ? { 
              A: d[4] || 'Option A', 
              B: d[5] || 'Option B', 
              C: d[6] || 'Option C', 
              D: d[7] || 'Option D' 
            } : null,
            order_number: questions.length + idx + 1
          }
        })

        if (payload.length === 0) throw new Error("File is empty")

        const { error } = await supabase.from('questions').insert(payload)
        if (error) throw error

        toast.success(`${payload.length} Questions sync ho gaye (Auto-Fixed)!`)
        loadQuestions()
      } catch (err: any) {
        console.error(err)
        toast.error("Format Error: Make sure columns are comma separated.")
      } finally {
        setIsUploading(false)
        if (e.target) e.target.value = ''
      }
    }
    reader.readAsText(file)
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
        <Button variant="ghost" onClick={() => navigate('/admin/quizzes')} className="font-bold">
          <ArrowLeft className="mr-2 h-4 w-4"/> Back to Quizzes
        </Button>

        <div className="grid lg:grid-cols-3 gap-6 text-slate-800">
          <div className="lg:col-span-2 space-y-6">
            <Card className={editingId ? "border-blue-500 shadow-xl" : "shadow-md"}>
              <CardHeader className="border-b mb-4">
                <CardTitle className="flex justify-between items-center text-xl font-black italic">
                  <div className="flex items-center gap-3">
                    <span>{editingId ? "EDITING MODE" : "ADD NEW QUESTION"}</span>
                    {!editingId && (
                      <div className="relative">
                        <input type="file" accept=".csv" onChange={handleBulkUpload} className="hidden" id="csv-input" disabled={isUploading} />
                        <label htmlFor="csv-input">
                          <Button variant="outline" size="sm" asChild className="cursor-pointer border-dashed border-green-500 text-green-600 hover:bg-green-50 font-bold">
                            <span>
                              {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                              BULK CSV
                            </span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                  {editingId && <Button variant="ghost" size="sm" onClick={resetForm}><X className="h-4 w-4"/></Button>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-3 h-12">
                    <TabsTrigger value="mcq" className="font-bold uppercase tracking-tighter">MCQ</TabsTrigger>
                    <TabsTrigger value="integer" className="font-bold uppercase tracking-tighter">Integer</TabsTrigger>
                    <TabsTrigger value="paragraph" className="font-bold uppercase tracking-tighter">Paragraph</TabsTrigger>
                  </TabsList>
                </Tabs>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Textarea
                    placeholder="Enter your question here..."
                    className="min-h-[100px] text-lg font-medium"
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
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="Correct Answer"
                      value={formData.correct_answer}
                      onChange={e => setFormData({...formData, correct_answer: e.target.value})}
                      required
                    />
                    <Input
                      type="number"
                      placeholder="Marks"
                      value={formData.marks}
                      onChange={e => setFormData({...formData, marks: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <Button type="submit" className={`w-full h-12 font-black text-lg ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-black'}`}>
                    {editingId ? "UPDATE QUESTION" : "SAVE QUESTION"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-black uppercase opacity-60">Question List ({questions.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {questions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold italic">No questions added yet.</div>
              ) : (
                questions.map((q, i) => (
                  <div key={q.id} className={`p-4 border-b flex justify-between items-center transition-all hover:bg-slate-50 ${editingId === q.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}>
                    <div className="truncate flex-1">
                      <div className="text-[10px] font-black text-slate-400">#0{i + 1} | {q.question_type.toUpperCase()}</div>
                      <p className="font-bold truncate text-slate-700">{q.question_text}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(q)} className="h-8 w-8 text-blue-600"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button>
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
