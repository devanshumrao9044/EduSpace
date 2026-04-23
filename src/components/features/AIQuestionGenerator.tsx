import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Wand2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface AIQuestionGeneratorProps {
  quizId: string
  onQuestionsGenerated: () => void
}

export default function AIQuestionGenerator({ quizId, onQuestionsGenerated }: AIQuestionGeneratorProps) {
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // 🔥 .env se API Key load ho rahi hai
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  const generateQuestions = async () => {
    if (!inputText.trim()) return toast.error("Bhai, pehle thoda content toh dalo!")
    if (!GEMINI_API_KEY) return toast.error("API Key missing! .env file check karo.")

    setIsGenerating(true)
    const toastId = toast.loading("AI is crafting your questions...")

    try {
      // Strict Prompt for perfect JSON output
      const prompt = `
        Context: You are an expert quiz creator for a learning platform.
        Task: Based on the provided text, generate 5 high-quality Multiple Choice Questions (MCQs).
        
        Strict Output Rules:
        1. Return ONLY a raw JSON array.
        2. No conversational text, no markdown blocks (no \`\`\`json).
        3. Each object must follow this exact schema:
           {
             "question_text": "Clear and concise question",
             "question_type": "mcq",
             "options": {"A": "Option 1", "B": "Option 2", "C": "Option 3", "D": "Option 4"},
             "correct_answer": "A",
             "marks": 1,
             "negative_marks": 0
           }
        
        Source Text: ${inputText}
      `

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      })

      const data = await response.json()
      
      if (data.error) throw new Error(data.error.message)

      let rawOutput = data.candidates[0].content.parts[0].text
      
      // Sanitizing output (removing any accidental markdown)
      const cleanJson = rawOutput.replace(/```json|```/g, "").trim()
      const questionsArray = JSON.parse(cleanJson)

      // Fetching current question count to set the correct order_number
      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)

      const startOrder = (count || 0) + 1

      // Prepare payload with quizId and order_number
      const finalPayload = questionsArray.map((q: any, index: number) => ({
        ...q,
        quiz_id: quizId,
        order_number: startOrder + index
      }))

      // Batch Insert into Supabase
      const { error: insertError } = await supabase.from('questions').insert(finalPayload)
      
      if (insertError) throw insertError

      toast.success(`${questionsArray.length} Questions added successfully!`, { id: toastId })
      setInputText('')
      onQuestionsGenerated() // Refresh the parent list
      
    } catch (err: any) {
      console.error("AI Error:", err)
      toast.error("AI is a bit confused. Please try with different text.", { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="p-6 border-none shadow-2xl bg-white rounded-[2.5rem] relative overflow-hidden group mb-8">
      {/* Decorative Background Icon */}
      <div className="absolute -top-6 -right-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
        <Wand2 className="w-40 h-40 text-indigo-600 rotate-12" />
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-black italic text-slate-800 uppercase tracking-tight text-lg leading-none">AI MCQ Wizard</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Powered by Gemini 1.5 Flash
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Textarea 
          placeholder="Paste your study notes, a paragraph from a book, or any topic details here..."
          className="min-h-[140px] rounded-[1.5rem] border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium p-5 resize-none leading-relaxed"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />

        <Button 
          onClick={generateQuestions} 
          disabled={isGenerating || !inputText.trim()}
          className="w-full h-14 bg-slate-900 hover:bg-indigo-600 rounded-2xl font-black italic uppercase tracking-widest transition-all duration-300 shadow-xl disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing Content...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate 5 Magic Questions
            </>
          )}
        </Button>

        <div className="flex items-start gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
          <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-indigo-900/60 uppercase leading-normal">
            Pro Tip: The better the text you provide, the more accurate the questions will be. Always review AI-generated content.
          </p>
        </div>
      </div>
    </Card>
  )
}

