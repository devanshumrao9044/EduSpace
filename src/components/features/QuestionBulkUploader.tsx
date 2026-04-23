import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QuestionBulkUploaderProps {
  quizId: string;
  questionsCount: number;
  onUploadComplete: () => void;
}

export default function QuestionBulkUploader({ quizId, questionsCount, onUploadComplete }: QuestionBulkUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)

  // 🔥 DITTO SAME BULK UPLOAD LOGIC 🔥
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const reader = new FileReader()
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        // Logic: Skip header, filter empty lines
        const lines = text.split('\n').filter(line => line.trim() !== '').slice(1) 

        const payload = lines.map((line, idx) => {
          const [text, type, marks, correct, a, b, c, d] = line.split(',').map(item => item.trim())
          return {
            quiz_id: quizId!,
            question_text: text,
            question_type: type?.toLowerCase() || 'mcq',
            marks: parseInt(marks) || 1,
            correct_answer: correct,
            options: type?.toLowerCase() === 'mcq' ? { A: a, B: b, C: c, D: d } : null,
            // Naye questions current count ke baad se start honge
            order_number: questionsCount + idx + 1
          }
        })

        const { error } = await supabase.from('questions').insert(payload)
        if (error) throw error

        toast.success(`${payload.length} Questions Added via CSV!`)
        onUploadComplete() // List refresh karne ke liye
      } catch (err) {
        toast.error("Format error! Check your CSV columns.")
        console.error(err)
      } finally {
        setIsUploading(false)
        // Reset input so same file can be uploaded again
        if (e.target) e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="relative inline-block">
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleBulkUpload} 
        className="hidden" 
        id="csv-input-file" 
        disabled={isUploading} 
      />
      <label htmlFor="csv-input-file">
        <Button 
          variant="outline" 
          size="sm" 
          asChild 
          className="cursor-pointer border-dashed border-green-500 text-green-600 hover:bg-green-50"
        >
          <span>
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Bulk CSV
          </span>
        </Button>
      </label>
    </div>
  )
}
