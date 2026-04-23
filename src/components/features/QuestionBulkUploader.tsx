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
        
        // Jadoo wala logic
        const fixedText = text.replace(/(\d)"/g, '$1\n"') 
        
        const lines = fixedText.split('\n').filter(line => line.trim() !== '')
        const questions = []

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
          
          if (!values || values.length < 8) continue

          const clean = (val: string) => val ? val.replace(/^"|"$/g, '').trim() : ''

          // 🔥 YAHAN THA ERROR KA SOLUTION 🔥
          // Type ko strictly lowercase karo. Agar kuch ajeeb ho toh 'mcq' default kardo
          let rawType = clean(values[1]).toLowerCase()
          let validTypes = ['mcq', 'integer', 'paragraph']
          let finalType = validTypes.includes(rawType) ? rawType : 'mcq'

          questions.push({
            quiz_id: quizId,
            question_text: clean(values[0]),
            question_type: finalType, // 🔥 Ab DB reject nahi karega
            options: {
              A: clean(values[2]),
              B: clean(values[3]),
              C: clean(values[4]),
              D: clean(values[5]),
            },
            correct_answer: clean(values[6]),
            marks: parseInt(clean(values[7])) || 1,
            order_number: i + 100 
          })
        }

        if (questions.length === 0) {
          throw new Error("File empty hai ya format sahi match nahi hua.")
        }

        // Database mein bhejo
        const { error } = await supabase.from('questions').insert(questions)
        if (error) throw error

        toast.success(`${questions.length} Questions successfully added!`)
        if (onUploadComplete) onUploadComplete()
        
      } catch (err: any) {
        console.error("Supabase Error: ", err)
        toast.error(`Upload failed: ${err.message || 'Check format'}`)
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
        id="csv-upload-jaddu" 
        disabled={uploading} 
      />
      <label htmlFor="csv-upload-jaddu">
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
