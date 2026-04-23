import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Wand2 } from 'lucide-react'
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

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  const generateQuestions = async () => {
    if (!inputText.trim()) return toast.error("Bhai, kuch likho toh sahi!")
    if (!GEMINI_API_KEY) return toast.error("API Key missing! .env restart kiya?")

    setIsGenerating(true)
    const toastId = toast.loading("AI is brainstorming...")

    try {
      const prompt = `
        You are a strict JSON generator. Based on the text below, create 5 MCQs.
        Return ONLY a JSON array. NO markdown, NO code blocks, NO preamble.
        
        Schema:
        [
          {
            "question_text": "string",
            "question_type": "mcq",
            "options": {"A": "str", "B": "str", "C": "str", "D": "str"},
            "correct_answer": "A",
            "marks": 1,
            "negative_marks": 0
          }
        ]

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
      
      // Error handling for API
      if (data.error) {
        console.error("Gemini API Error:", data.error)
        throw new Error(data.error.message)
      }

      let rawOutput = data.candidates[0].content.parts[0].text
      console.log("Raw AI Output:", rawOutput) // DEBUG: Inspect (F12) me check karo

      // 🔥 Robust JSON Extraction
      const jsonMatch = rawOutput.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error("No valid JSON array found")
      
      const questionsArray = JSON.parse(jsonMatch[0])

      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)

      const startOrder = (count || 0) + 1
      const finalPayload = questionsArray.map((q: any, i: number) => ({
        ...q,
        quiz_id: quizId,
        order_number: startOrder + i
      }))

      const { error: insertError } = await supabase.from('questions').insert(finalPayload)
      if (insertError) throw insertError

      toast.success("Questions magically added!", { id: toastId })
      setInputText('')
      onQuestionsGenerated()
      
    } catch (err: any) {
      console.error("Full Error Info:", err)
      toast.error(err.message || "Something went wrong", { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="p-6 border-none shadow-2xl bg-white rounded-[2.5rem] mb-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
        <Wand2 className="w-20 h-20 text-indigo-600" />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-black italic text-slate-800 uppercase tracking-tighter">AI MCQ Wizard</h3>
      </div>

      <Textarea 
        placeholder="Paste text here to generate 5 questions..."
        className="min-h-[120px] rounded-2xl border-slate-100 bg-slate-50/50 mb-4 p-4 text-sm"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
      />

      <Button 
        onClick={generateQuestions} 
        disabled={isGenerating || !inputText.trim()}
        className="w-full h-14 bg-slate-900 hover:bg-indigo-600 rounded-2xl font-black italic uppercase transition-all"
      >
        {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Magic Questions"}
      </Button>
    </Card>
  )
}
