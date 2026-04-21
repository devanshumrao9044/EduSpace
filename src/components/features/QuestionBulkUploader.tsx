import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Upload, FileText, Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function BulkQuestionUploader() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        
        // 1. Line Cleaning: Windows aur Linux dono ke line breaks handle karega
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 2)
        
        // 2. Header Logic: Pehli line skip karega agar wo header hai
        const startIdx = lines[0].toLowerCase().includes('question') ? 1 : 0
        const dataLines = lines.slice(startIdx)

        const questions = dataLines.map((line, index) => {
          // 3. Smart CSV Parsing: Quotes ke andar wale commas ko ignore karega
          const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',')
          const d = parts.map(p => p.replace(/^"|"$/g, '').trim())

          // 4. AI-Style Auto Fill: Agar column khali hai toh crash nahi hoga
          const qText = d[0] || `Generated Question ${index + 1}`
          const qType = (d[1]?.toLowerCase() === 'integer' || d[1]?.toLowerCase() === 'paragraph') 
                        ? d[1].toLowerCase() 
                        : 'mcq'
          const marks = parseInt(d[2]) || 1
          const correct = d[3] || (qType === 'mcq' ? 'A' : '0')

          return {
            quiz_id: quizId,
            question_text: qText,
            question_type: qType,
            marks: marks,
            correct_answer: correct,
            // 5. Options: MCQ ke liye object banayega, baaki ke liye null
            options: qType === 'mcq' ? {
              A: d[4] || 'Option A',
              B: d[5] || 'Option B',
              C: d[6] || 'Option C',
              D: d[7] || 'Option D'
            } : null,
            order_number: index + 1
          }
        })

        if (questions.length === 0) throw new Error("Empty file detected!")

        // 6. Supabase Bulk Insert
        const { error } = await supabase.from('questions').insert(questions)
        if (error) throw error

        toast.success(`${questions.length} questions successfully sync ho gaye!`)
        
        // Success ke baad wapas Manage page pe bhej dega
        setTimeout(() => navigate(-1), 1500)

      } catch (err: any) {
        console.error("Upload Error:", err)
        toast.error(err.message || "CSV format check karein!")
      } finally {
        setUploading(false)
        if (event.target) event.target.value = '' 
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="font-bold">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-10 text-center">
            <Badge className="bg-indigo-500 mb-4 border-none px-4 py-1">CSV UPLOADER</Badge>
            <CardTitle className="text-3xl font-black italic tracking-tighter">
              BULK IMPORT QUESTIONS
            </CardTitle>
            <p className="text-slate-400 mt-2 text-sm">Upload karein aur apne saare sawal ek baar mein add karein.</p>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center gap-8 py-14">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-indigo-200">
              {uploading ? (
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              ) : (
                <FileText className="w-10 h-10 text-indigo-600" />
              )}
            </div>

            <div className="text-center space-y-3">
              <h3 className="font-black text-slate-800 text-xl uppercase tracking-tight">Select your CSV file</h3>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="bg-slate-50">Question</Badge>
                <Badge variant="outline" className="bg-slate-50">Type</Badge>
                <Badge variant="outline" className="bg-slate-50">Marks</Badge>
                <Badge variant="outline" className="bg-slate-50">Correct</Badge>
                <Badge variant="outline" className="bg-slate-50">Options A-D</Badge>
              </div>
            </div>

            <div className="relative w-full max-w-sm">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer z-20"
              />
              <Button 
                className={`w-full h-16 rounded-2xl font-black text-xl shadow-xl transition-all ${
                  uploading ? 'bg-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
                disabled={uploading}
              >
                {uploading ? 'PROCESSING...' : 'CHOOSE CSV FILE'}
              </Button>
            </div>

            {uploading && (
              <p className="text-indigo-600 font-bold animate-pulse flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Syncing with Database...
              </p>
            )}
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem] flex gap-4">
          <AlertCircle className="h-6 w-6 text-blue-600 shrink-0" />
          <div className="text-xs text-blue-800 leading-relaxed space-y-1">
            <p className="font-black uppercase tracking-widest text-[10px] opacity-60">Pro Tips:</p>
            <p>1. CSV ki pehli line header honi chahiye (Question, Type, Marks, etc.)</p>
            <p>2. Questions ke beech mein comma hai? Don't worry, ye "Smart Parser" hai handle kar lega.</p>
            <p>3. MCQ ke liye 4 options de, Integer/Paragraph ke liye options khali chhod de.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
