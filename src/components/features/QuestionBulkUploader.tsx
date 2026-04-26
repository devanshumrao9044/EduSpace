import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilePicker } from '@capawesome/capacitor-file-picker' // 👈 Naya Plugin

export default function QuestionBulkUploader({ quizId, onUploadComplete }: any) {
  const [uploading, setUploading] = useState(false)

  // 🔥 CUSTOM ROBUST CSV PARSER (Same as before)
  const parseCSV = (rawText: string) => {
    const cleanedText = rawText.split(/\r?\n/).map(line => {
      let trimmed = line.trim()
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).replace(/""/g, '"')
      }
      return trimmed
    }).join('\n')

    const rows = []
    let currentRow = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < cleanedText.length; i++) {
      const char = cleanedText[i]
      const nextChar = cleanedText[i + 1] || ''
      if (char === '"' && inQuotes && nextChar === '"') {
        currentCell += '"'; i++
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell); currentCell = ''
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentCell); rows.push(currentRow); currentRow = []; currentCell = ''
      } else {
        currentCell += char
      }
    }
    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell); rows.push(currentRow)
    }
    return rows
  }

  // 🚀 NAYA MOBILE-FRIENDLY UPLOAD LOGIC
  const handleCSVSelection = async () => {
    setUploading(true)
    try {
      // 1. Android ka asli File Manager khulega
      const result = await FilePicker.pickFiles({
        types: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        multiple: false,
        readData: true // Taaki file ka content mil jaye
      })

      if (result.files.length === 0) {
        setUploading(false)
        return
      }

      const file = result.files[0]
      
      // 2. Base64 data ko String mein convert karna (UTF-8 safe)
      if (!file.data) throw new Error("File data nahi mil paya.")
      const text = atob(file.data) 
      
      const rows = parseCSV(text)
      const questions = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row.length < 8) continue
        if (row[0].toLowerCase().includes('question_text')) continue

        const clean = (val: string) => val ? val.trim() : ''
        let rawType = clean(row[1]).toLowerCase()
        let finalType = ['mcq', 'integer', 'paragraph'].includes(rawType) ? rawType : 'mcq'

        questions.push({
          quiz_id: quizId,
          question_text: clean(row[0]),
          question_type: finalType,
          options: {
            A: clean(row[2]),
            B: clean(row[3]),
            C: clean(row[4]),
            D: clean(row[5]),
          },
          correct_answer: clean(row[6]),
          marks: parseInt(clean(row[7])) || 1,
          order_number: i + 100 
        })
      }

      if (questions.length === 0) {
        throw new Error("File empty hai ya format match nahi hua.")
      }

      const { error } = await supabase.from('questions').insert(questions)
      if (error) throw error

      toast.success(`Success! ${questions.length} questions add ho gaye!`)
      if (onUploadComplete) onUploadComplete()
      
    } catch (err: any) {
      console.error("Upload Error: ", err)
      toast.error(`Upload failed: ${err.message || 'Check format'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="inline-block">
      {/* Ab koi hidden input nahi chahiye, Button hi direct trigger karega */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleCSVSelection} 
        disabled={uploading}
        className="border-dashed border-green-500 text-green-600 hover:bg-green-50"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        Bulk CSV
      </Button>
    </div>
  )
}
