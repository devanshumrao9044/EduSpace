import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilePicker } from '@capawesome/capacitor-file-picker'
import { Filesystem } from '@capacitor/filesystem'

export default function QuestionBulkUploader({ quizId, onUploadComplete }: any) {
  const [uploading, setUploading] = useState(false)

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
      if (char === '"' && inQuotes && cleanedText[i + 1] === '"') {
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

  const handleCSVSelection = async () => {
    setUploading(true)
    try {
      const check = await Filesystem.checkPermissions()
      if (check.publicStorage !== 'granted') {
        await Filesystem.requestPermissions()
      }

      const result = await FilePicker.pickFiles({
        types: ['*/*'], 
        multiple: false,
        readData: true 
      })

      if (result.files.length === 0) {
        setUploading(false); return
      }

      const file = result.files[0]
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error("Bhai, sirf .csv file hi chalegi!"); setUploading(false); return
      }

      if (!file.data) throw new Error("File data nahi mila.")
      
      const text = atob(file.data) 
      const rows = parseCSV(text)
      const questions = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row.length < 8 || row[0].toLowerCase().includes('question_text')) continue

        const clean = (val: string) => val ? val.trim() : ''
        questions.push({
          quiz_id: quizId,
          question_text: clean(row[0]),
          question_type: ['mcq', 'integer', 'paragraph'].includes(clean(row[1]).toLowerCase()) ? clean(row[1]).toLowerCase() : 'mcq',
          options: { A: clean(row[2]), B: clean(row[3]), C: clean(row[4]), D: clean(row[5]) },
          correct_answer: clean(row[6]),
          marks: parseInt(clean(row[7])) || 1,
          order_number: i + 100 
        })
      }

      const { error } = await supabase.from('questions').insert(questions)
      if (error) throw error

      toast.success(`Mast! ${questions.length} questions upload ho gaye!`)
      if (onUploadComplete) onUploadComplete()
      
    } catch (err: any) {
      toast.error(`Error: ${err.message || 'File access error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCSVSelection} disabled={uploading} className="border-dashed border-green-500 text-green-600">
      {uploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
      Bulk CSV
    </Button>
  )
}
