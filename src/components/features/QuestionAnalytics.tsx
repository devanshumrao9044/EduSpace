import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle, XCircle, MinusCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import type { Question, QuizAttempt } from '@/types/database'

interface QuestionAnalyticsProps {
  quizId: string
}

interface QuestionStats extends Question {
  correctCount: number
  wrongCount: number
  skippedCount: number
  totalAttempts: number
  correctPercentage: number
}

export default function QuestionAnalytics({ quizId }: QuestionAnalyticsProps) {
  const [stats, setStats] = useState<QuestionStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (quizId) fetchAnalytics()
  }, [quizId])

  const fetchAnalytics = async () => {
    try {
      // 1. Fetch all questions for this quiz
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_number')

      // 2. Fetch all attempts for this quiz
      const { data: attemptsData } = await supabase
        .from('quiz_attempts')
        .select('answers')
        .eq('quiz_id', quizId)
        .not('submitted_at', 'is', null)

      if (!questionsData || !attemptsData) return

      const totalStudents = attemptsData.length

      // 3. Calculate stats for each question
      const calculatedStats = questionsData.map((question) => {
        let correctCount = 0
        let wrongCount = 0
        let skippedCount = 0

        attemptsData.forEach((attempt) => {
          const answers = attempt.answers as Record<string, any>
          const studentAnswer = answers[question.id]?.answer

          if (!studentAnswer) {
            skippedCount++
          } else {
            // Check if correct
            const isCorrect = question.question_type === 'mcq'
              ? studentAnswer.toUpperCase() === question.correct_answer.toUpperCase()
              : studentAnswer === question.correct_answer

            if (isCorrect) correctCount++
            else wrongCount++
          }
        })

        const correctPercentage = totalStudents > 0 ? Math.round((correctCount / totalStudents) * 100) : 0

        return {
          ...question,
          correctCount,
          wrongCount,
          skippedCount,
          totalAttempts: totalStudents,
          correctPercentage
        }
      })

      setStats(calculatedStats)
    } catch (error) {
      console.error('Error generating analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-lg w-full mt-6"></div>
  }

  if (stats.length === 0 || stats[0].totalAttempts === 0) {
    return null // Agar koi attempt nahi hai toh kuch mat dikhao
  }

  return (
    <Card className="mt-8 border-0 shadow-md ring-1 ring-gray-100">
      <CardHeader className="bg-gray-50/50 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="w-5 h-5 text-primary" />
          Question Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y">
        {stats.map((stat, index) => {
          // Identify "Hard" questions (e.g., less than 40% correct rate)
          const isHardQuestion = stat.correctPercentage < 40 && stat.totalAttempts > 0

          return (
            <div key={stat.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Left Side: Question Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded">
                      Q{index + 1}
                    </span>
                    {isHardQuestion && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Needs Attention
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800 text-sm mb-4">{stat.question_text}</p>
                  
                  {/* Progress Bar */}
                  <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100">
                    <div style={{ width: `${(stat.correctCount / stat.totalAttempts) * 100}%` }} className="bg-green-500" />
                    <div style={{ width: `${(stat.wrongCount / stat.totalAttempts) * 100}%` }} className="bg-red-500" />
                    <div style={{ width: `${(stat.skippedCount / stat.totalAttempts) * 100}%` }} className="bg-gray-300" />
                  </div>
                </div>

                {/* Right Side: Detailed Stats */}
                <div className="flex gap-4 items-center shrink-0">
                  <div className="text-center p-3 bg-green-50 rounded-lg min-w-[80px]">
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xl font-bold text-green-700">{stat.correctCount}</p>
                    <p className="text-[10px] uppercase text-green-600 font-semibold">Correct</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg min-w-[80px]">
                    <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                    <p className="text-xl font-bold text-red-700">{stat.wrongCount}</p>
                    <p className="text-[10px] uppercase text-red-600 font-semibold">Wrong</p>
                  </div>
                  <div className="text-center p-3 bg-gray-100 rounded-lg min-w-[80px]">
                    <MinusCircle className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-gray-700">{stat.skippedCount}</p>
                    <p className="text-[10px] uppercase text-gray-500 font-semibold">Skipped</p>
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

