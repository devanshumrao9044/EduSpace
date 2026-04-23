import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        
        // Sabse purana aur simple logic: Enter se line todo, pehli line (header) hatao
        const lines = text.split('\n').filter(line => line.trim() !== '').slice(1) 

        const questions = lines.map((line, index) => {
          // Direct comma se split (koi regex ya faltu dimaag nahi)
          const [qText, type, marks, correct, optA, optB, optC, optD] = line.split(',')
          
          return {
            quiz_id: quizId,
            question_text: qText?.trim(),
            question_type: type?.trim().toLowerCase() || 'mcq',
            marks: parseInt(marks) || 1,
            correct_answer: correct?.trim(),
            options: type?.trim().toLowerCase() === 'mcq' ? { 
              A: optA?.trim() || '', 
              B: optB?.trim() || '', 
              C: optC?.trim() || '', 
              D: optD?.trim() || '' 
            } : null,
            order_number: index + 100 // Taki naye questions list ke end mein aayein
          }
        })

        const { error } = await supabase.from('questions').insert(questions)
        if (error) throw error

        toast.success("Bulk Upload Successful!")
        if (onUploadComplete) onUploadComplete()
      } catch (error) {
        console.error(error)
        toast.error("Upload failed!")
      } finally {
        setUploading(false)
        if (event.target) event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="inline-block">
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        className="hidden" 
        id="csv-upload-simple" 
        disabled={uploading} 
      />
      <label htmlFor="csv-upload-simple">
        <Button variant="outline" size="sm" asChild className="cursor-pointer border-dashed border-green-500 text-green-600 hover:bg-green-50">
          <span>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Bulk CSV
          </span>
        </Button>
      </label>
    </div>
  )
}
