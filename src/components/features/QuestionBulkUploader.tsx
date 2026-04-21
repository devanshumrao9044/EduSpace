import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function QuestionBulkUploader({ quizId, onUploadComplete }: any) {
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (event: any) => {
    const file = event.target.files[0]
    if (!file) return

    setUploading(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim() !== '').slice(1)

        const questions = lines.map((line, index) => {
          const [qText, type, marks, correct, optA, optB, optC, optD] = line.split(',').map(s => s?.trim())
          return {
            quiz_id: quizId,
            question_text: qText,
            question_type: type?.toLowerCase() || 'mcq',
            marks: parseInt(marks) || 1,
            correct_answer: correct,
            options: type?.toLowerCase() === 'mcq' ? { A: optA, B: optB, C: optC, D: optD } : null,
            order_number: index + 100 // Existing questions ke baad aaye
          }
        })

        const { error } = await supabase.from('questions').insert(questions)
        if (error) throw error
        
        toast.success(`${questions.length} Questions uploaded!`)
        onUploadComplete()
      } catch (err: any) {
        toast.error("Upload failed: Format check karo (Question,Type,Marks,Correct,A,B,C,D)")
      } finally {
        setUploading(false)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex gap-2 items-center">
      <input type="file" id="bulk-csv" accept=".csv" className="hidden" onChange={handleFileUpload} />
      <Button 
        variant="outline" 
        size="sm"
        disabled={uploading} 
        onClick={() => document.getElementById('bulk-csv')?.click()}
        className="border-dashed border-green-500 text-green-600 hover:bg-green-50"
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? 'Uploading...' : 'Bulk CSV'}
      </Button>
    </div>
  )
}
