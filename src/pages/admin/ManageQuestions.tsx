import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Trash2, Loader2, Pencil, X, ListChecks, Image as ImageIcon, UploadCloud, RotateCw, ZoomIn, ZoomOut, Check, CropIcon } from 'lucide-react'
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  
  // 🔥 NATIVE CANVAS CROPPER STATES 🔥
  const [showEditor, setShowEditor] = useState(false)
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  
  const isDragging = useRef(false), startPos = useRef({ x: 0, y: 0 })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [questionType, setQuestionType] = useState<'mcq' | 'integer' | 'paragraph'>('mcq')
  const [formData, setFormData] = useState({
    question_text: '', image_url: '', optionA: '', optionB: '', optionC: '', optionD: '', correct_answer: '', marks: 1, negative_marks: 0
  })

  useEffect(() => { if (quizId) loadQuestions() }, [quizId])

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_number', { ascending: true })
      if (error) throw error
      setQuestions(data || [])
    } catch (error: any) { toast.error('Questions load nahi ho paaye') } 
    finally { setLoading(false) }
  }

  // File Select hote hi Modal open karo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        setImgObj(img)
        setShowEditor(true)
        setScale(1); setRotation(0); setOffset({ x: 0, y: 0 })
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Pointer Events for Native Drag
  const onPtrDown = (e: React.PointerEvent) => { isDragging.current = true; startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y } }
  const onPtrMove = (e: React.PointerEvent) => { if (isDragging.current) setOffset({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y }) }
  const onPtrUp = () => { isDragging.current = false }

  // Canvas Drawing & Upload
  const handleCropUpload = async () => {
    if (!imgObj || !canvasRef.current) return
    setIsUploadingImage(true)

    const canvas = canvasRef.current, ctx = canvas.getContext('2d')!
    canvas.width = 600; canvas.height = 600

    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    // Translation logic for 600x600 canvas vs 300x300 UI (multiplied by 2)
    ctx.translate(canvas.width / 2 + offset.x * 2, canvas.height / 2 + offset.y * 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(scale, scale)
    ctx.drawImage(imgObj, -imgObj.width / 2, -imgObj.height / 2)
    ctx.restore()

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const filePath = `${quizId}/${Date.now()}.png`
      const { error } = await supabase.storage.from('quiz-images').upload(filePath, blob)
      if (!error) {
        const { data } = supabase.storage.from('quiz-images').getPublicUrl(filePath)
        setFormData({ ...formData, image_url: data.publicUrl })
        setShowEditor(false)
        toast.success("Image Cropped & Uploaded!")
      } else {
        toast.error("Image upload failed. Bucket policy check karo.")
      }
      setIsUploadingImage(false)
    }, 'image/png')
  }

  const handleEdit = (q: any) => {
    setEditingId(q.id)
    setQuestionType(q.question_type as any)
    const opts = (q.options as any) || {}
    setFormData({
      question_text: q.question_text || '', image_url: q.image_url || '',
      optionA: opts.A || '', optionB: opts.B || '', optionC: opts.C || '', optionD: opts.D || '',
      correct_answer: q.correct_answer || '', marks: q.marks || 1, negative_marks: q.negative_marks || 0
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({ question_text: '', image_url: '', optionA: '', optionB: '', optionC: '', optionD: '', correct_answer: '', marks: 1, negative_marks: 0 })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.question_text.trim() && !formData.image_url) return toast.error("Bhai, ya toh question likho ya picture upload karo!")
    if (questionType === 'mcq' && !['A', 'B', 'C', 'D'].includes(formData.correct_answer)) return toast.error("Please select a valid option (A, B, C, or D).")

    const payload = {
      quiz_id: quizId!, question_text: formData.question_text, image_url: formData.image_url, question_type: questionType,
      correct_answer: formData.correct_answer, marks: formData.marks, negative_marks: formData.negative_marks,
      options: questionType === 'mcq' ? { A: formData.optionA, B: formData.optionB, C: formData.optionC, D: formData.optionD } : null
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('questions').update(payload).eq('id', editingId)
        if (error) throw error; toast.success('Updated!')
      } else {
        const { error } = await supabase.from('questions').insert([{ ...payload, order_number: (questions?.length || 0) + 1 }])
        if (error) throw error; toast.success('Added!')
      }
      resetForm(); loadQuestions()
    } catch (error: any) { toast.error('Save error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this?')) return
    try { await supabase.from('questions').delete().eq('id', id); toast.success('Deleted'); loadQuestions() } 
    catch (error) { toast.error('Delete failed') }
  }

  const handleTypeChange = (value: 'mcq' | 'integer' | 'paragraph') => {
    setQuestionType(value)
    if (value === 'mcq') {
       if (!['A', 'B', 'C', 'D'].includes(formData.correct_answer)) setFormData({ ...formData, correct_answer: '' })
    } else setFormData({ ...formData, correct_answer: '' })
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      
      {/* 🔥 MOBILE CANVAS EDITOR MODAL 🔥 */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <span className="font-black italic flex items-center gap-2 text-indigo-600"><CropIcon className="w-5 h-5"/> CROP & ROTATE</span>
              <X className="cursor-pointer text-slate-400 p-1" onClick={() => setShowEditor(false)} />
            </div>
            
            <div className="p-4 bg-slate-900 flex justify-center">
              {/* THE CROP BOX (300x300 Square) */}
              <div 
                className="relative w-[300px] h-[300px] bg-slate-800 rounded-xl overflow-hidden border-2 border-indigo-500 touch-none shadow-lg cursor-move"
                style={{ touchAction: 'none' }} onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerCancel={onPtrUp} onPointerLeave={onPtrUp}
              >
                <img 
                  src={imgObj?.src} 
                  style={{ 
                    position: 'absolute', top: '50%', left: '50%',
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${scale})`,
                    transformOrigin: 'center', pointerEvents: 'none', maxWidth: 'none'
                  }}
                  alt="Crop preview"
                />
                {/* Visual Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-evenly pointer-events-none opacity-30">
                    <div className="w-full h-[1px] bg-white"></div><div className="w-full h-[1px] bg-white"></div>
                </div>
                <div className="absolute inset-0 flex justify-evenly pointer-events-none opacity-30">
                    <div className="h-full w-[1px] bg-white"></div><div className="h-full w-[1px] bg-white"></div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex justify-between gap-2">
                <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setScale(s => s + 0.15)}><ZoomIn className="h-5 w-5"/></Button>
                <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setScale(s => Math.max(0.2, s - 0.15))}><ZoomOut className="h-5 w-5"/></Button>
                <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setRotation(r => r + 90)}><RotateCw className="h-5 w-5"/></Button>
              </div>
              <Button onClick={handleCropUpload} disabled={isUploadingImage} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-black rounded-xl text-lg uppercase">
                {isUploadingImage ? <Loader2 className="animate-spin h-6 w-6" /> : <><Check className="mr-2 h-5 w-5"/> CROP & UPLOAD</>}
              </Button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <p className="text-white mt-4 text-xs font-bold italic opacity-70">Drag image to adjust crop</p>
        </div>
      )}

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
                    {!editingId && <QuestionBulkUploader quizId={quizId!} questionsCount={questions?.length || 0} onUploadComplete={loadQuestions} />}
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
                  
                  {/* 🔥 IMAGE UPLOAD UI 🔥 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Question Image (Optional)</label>
                      {formData.image_url && <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="text-xs text-red-500 font-bold hover:underline">Remove Image</button>}
                    </div>
                    
                    {formData.image_url ? (
                      <div className="relative rounded-xl border-2 border-dashed border-indigo-200 overflow-hidden bg-slate-50 flex justify-center p-2">
                        <img src={formData.image_url} alt="Preview" className="max-h-[300px] object-contain rounded-lg transition-transform hover:scale-[1.02] cursor-zoom-in" />
                      </div>
                    ) : (
                      <div onClick={() => fileInputRef.current?.click()} className="h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-indigo-300 transition-all">
                        <UploadCloud className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-xs font-bold text-slate-500">Click to upload & crop question image</span>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                      </div>
                    )}
                  </div>

                  <Textarea placeholder={formData.image_url ? "Type question text here (Optional)..." : "Enter question text..."} className="min-h-[120px] text-lg font-medium rounded-xl" value={formData.question_text} onChange={e => setFormData({...formData, question_text: e.target.value})} />
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
                        <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.correct_answer} onChange={e => setFormData({...formData, correct_answer: e.target.value})} required>
                          <option value="" disabled>Select Option</option><option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option>
                        </select>
                      ) : <Input placeholder="Correct Answer" value={formData.correct_answer} onChange={e => setFormData({...formData, correct_answer: e.target.value})} required />}
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marks (+)</label><Input type="number" placeholder="Marks" value={formData.marks} onChange={e => setFormData({...formData, marks: parseFloat(e.target.value) || 1})} min={0} step="0.25"/></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Negative (-)</label><Input type="number" placeholder="Neg Marks" value={formData.negative_marks} onChange={e => setFormData({...formData, negative_marks: parseFloat(e.target.value) || 0})} min={0} step="0.25"/></div>
                  </div>
                  
                  <Button type="submit" disabled={isUploadingImage || showEditor} className={`w-full h-14 font-black text-lg mt-4 ${editingId ? 'bg-indigo-600' : 'bg-slate-900'} disabled:opacity-50`}>
                    {editingId ? "SAVE CHANGES" : "ADD QUESTION"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-md h-fit">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-black uppercase opacity-60 flex items-center gap-2"><ListChecks className="w-4 h-4"/> Questions ({questions?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {(!questions || questions.length === 0) ? <div className="p-12 text-center text-slate-300 font-bold italic">Empty</div> : (
                questions.map((q: any, i) => (
                  <div key={q.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-400">#0{i + 1} | {q.question_type.toUpperCase()}</span>
                        {q.image_url && <ImageIcon className="w-3 h-3 text-indigo-500" />}
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{q.marks}</span>
                        {q.negative_marks > 0 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{q.negative_marks}</span>}
                      </div>
                      <p className="font-bold truncate text-slate-700 text-sm">{q.question_text ? q.question_text : <span className="italic text-slate-400">Image Based Question</span>}</p>
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

