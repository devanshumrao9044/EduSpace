import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function QuestionBulkUploader({ quizId, onUploadComplete }: any) {
  const [uploading, setUploading] = useState(false)

  // 🔥 CUSTOM ROBUST CSV PARSER 🔥
  // Ye tooti hui lines aur andar ke inverted commas ko automatically theek karega
  const parseCSV = (rawText: string) => {
    // Step 1: Fix broken wrapped lines
    const cleanedText = rawText.split(/\r?\n/).map(line => {
      let trimmed = line.trim()
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).replace(/""/g, '"')
      }
      return trimmed
    }).join('\n')

    // Step 2: Advanced Parsing (Jo newlines ko samajhta hai)
    const rows = []
    let currentRow = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < cleanedText.length; i++) {
      const char = cleanedText[i]
      const nextChar = cleanedText[i + 1] || ''

      if (char === '"' && inQuotes && nextChar === '"') {
        currentCell += '"'
        i++ // Skip extra quote
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell)
        currentCell = ''
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentCell)
        rows.push(currentRow)
        currentRow = []
        currentCell = ''
      } else {
        currentCell += char
      }
    }
    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell)
      rows.push(currentRow)
    }
    return rows
  }

  const handleFileUpload = async (event: any) => {
    const file = event.target.files[0]
    if (!file) return

    setUploading(true)
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const rows = parseCSV(text)
        const questions = []

        // Har row ko check karega
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          
          // Agar 8 columns nahi hain toh chhod dega (jaise toota hua header)
          if (row.length < 8) continue
          
          // Agar pehli line (Header) aa gayi toh skip karega
          if (row[0].toLowerCase().includes('question_text')) continue

          const clean = (val: string) => val ? val.trim() : ''

          // Type constraint fix
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
          throw new Error("File empty hai ya format sahi match nahi hua.")
        }

        // Database mein data bhejenge
        const { error } = await supabase.from('questions').insert(questions)
        if (error) throw error

        toast.success(`Success! Poore ${questions.length} questions add ho gaye!`)
        if (onUploadComplete) onUploadComplete()
        
      } catch (err: any) {
        console.error("Upload Error: ", err)
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
        id="csv-upload-pro" 
        disabled={uploading} 
      />
      <label htmlFor="csv-upload-pro">
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
