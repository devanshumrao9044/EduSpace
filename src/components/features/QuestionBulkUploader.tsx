import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface QuestionBulkUploaderProps {
  quizId: string;
  onUploadComplete?: () => void;
}

export default function QuestionBulkUploader({ quizId, onUploadComplete }: QuestionBulkUploaderProps) {
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        
        // 1. Line Cleaning: Windows (\r\n) aur Linux (\n) dono ke line breaks handle karega
        // Empty lines ko filter out kar dega
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 5)
        
        // 2. Header Logic: Agar pehli line mein "question" ya "type" likha hai toh use skip karega
        const startIdx = lines[0].toLowerCase().includes('question') ? 1 : 0
        const dataLines = lines.slice(startIdx)

        const questions = dataLines.map((line, index) => {
          // 3. Smart CSV Parsing (Regex): 
          // Ye quotes ke andar wale commas ko ignore karega (e.g. "What is 2,000?" ko nahi todega)
          const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',')
          const d = parts.map(p => p.replace(/^"|"$/g, '').trim())

          // 4. AI-Style Auto Fill: Jo column missing hai wahan default data bhar dega
          const qText = d[0] || `Bulk Question ${index + 1}`
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
            // 5. Options: MCQ ke liye object, baki ke liye null
            options: qType === 'mcq' ? {
              A: d[4] || 'Option A',
              B: d[5] || 'Option B',
              C: d[6] || 'Option C',
              D: d[7] || 'Option D'
            } : null,
            order_number: index + 1
          }
        })

        if (questions.length === 0) throw new Error("File empty hai ya format bilkul galat hai!")

        // 6. Supabase Bulk Insert
        const { error } = await supabase.from('questions').insert(questions)
        if (error) throw error

        toast.success(`${questions.length} Questions successfully upload ho gaye!`)
        
        if (onUploadComplete) onUploadComplete()

      } catch (err: any) {
        console.error("Bulk Upload Error:", err)
        toast.error(err.message || "CSV format check karein!")
      } finally {
        setUploading(false)
        if (event.target) event.target.value = '' 
      }
    }
    reader.readAsText(file)
  }

  return (
    <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 text-white p-8">
        <div className="flex justify-between items-center">
          <div>
            <Badge className="bg-indigo-500 mb-2 border-none">CSV SMART UPLOADER</Badge>
            <CardTitle className="text-2xl font-black italic tracking-tighter">BULK IMPORT</CardTitle>
          </div>
          <FileText className="w-10 h-10 text-indigo-400 opacity-50" />
        </div>
      </CardHeader>
      
      <CardContent className="p-10 flex flex-col items-center gap-6">
        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center border-2 border-dashed border-indigo-200">
          {uploading ? (
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-indigo-600" />
          )}
        </div>

        <div className="text-center">
          <h3 className="font-bold text-slate-800 text-lg">Select CSV File</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            Format: Question, Type, Marks, Correct, A, B, C, D
          </p>
        </div>

        <div className="relative w-full">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="absolute inset-0 opacity-0 cursor-pointer z-20"
          />
          <Button 
            className={`w-full h-14 rounded-2xl font-black text-lg transition-all ${
              uploading ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100'
            }`}
            disabled={uploading}
          >
            {uploading ? 'UPLOADING...' : 'CHOOSE CSV'}
          </Button>
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm animate-pulse">
            <CheckCircle className="h-4 w-4" /> 
            Syncing with Database...
          </div>
        )}

        <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-[10px] text-amber-800 leading-tight font-medium">
            <b>Note:</b> MCQ ke liye 4 options bharein. Integer/Paragraph ke liye options khali chhod sakte hain. Chipki hui lines ye khud handle kar lega.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

