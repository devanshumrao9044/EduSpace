import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle, XCircle, MinusCircle, Flame, TrendingUp, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import type { Question } from '@/types/database'

interface QuestionAnalyticsProps {
  quizId: string
}

interface QuestionStats extends Question {
  originalQNum: number
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

      // 3. Calculate stats for each question (preserve original order number)
      const calculatedStats: QuestionStats[] = questionsData.map((question, index) => {
        let correctCount = 0
        let wrongCount = 0
        let skippedCount = 0

        attemptsData.forEach((attempt) => {
          const answers = attempt.answers as Record<string, any>
          const studentAnswer = answers[question.id]?.answer

          if (!studentAnswer) {
            skippedCount++
          } else {
            const isCorrect =
              question.question_type === 'mcq'
                ? studentAnswer.toUpperCase() === question.correct_answer.toUpperCase()
                : studentAnswer === question.correct_answer

            if (isCorrect) correctCount++
            else wrongCount++
          }
        })

        const correctPercentage =
          totalStudents > 0 ? Math.round((correctCount / totalStudents) * 100) : 0

        return {
          ...question,
          originalQNum: index + 1,
          correctCount,
          wrongCount,
          skippedCount,
          totalAttempts: totalStudents,
          correctPercentage,
        }
      })

      // 4. Sort: hardest (lowest correct %) first
      calculatedStats.sort((a, b) => a.correctPercentage - b.correctPercentage)

      setStats(calculatedStats)
    } catch (error) {
      console.error('Error generating analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-lg w-full mt-6" />
  }

  if (stats.length === 0 || stats[0].totalAttempts === 0) {
    return null
  }

  // 5. Group questions by difficulty
  const hardQuestions = stats.filter((s) => s.correctPercentage < 40)
  const moderateQuestions = stats.filter(
    (s) => s.correctPercentage >= 40 && s.correctPercentage <= 75
  )
  const easyQuestions = stats.filter((s) => s.correctPercentage > 75)

  const renderQuestionRow = (stat: QuestionStats) => (
    <div key={stat.id} className="p-6 hover:bg-slate-50 transition-colors border-b last:border-b-0 bg-white">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Question Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-gray-800 text-white text-xs font-bold rounded">
              Q{stat.originalQNum}
            </span>
            <span className="text-sm font-semibold text-gray-500">
              {stat.correctPercentage}% Correct Rate
            </span>
          </div>
          <p className="font-medium text-gray-800 text-sm mb-4">{stat.question_text}</p>

          {/* Progress Bar */}
          <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100">
            <div
              style={{ width: `${(stat.correctCount / stat.totalAttempts) * 100}%` }}
              className="bg-green-500"
              title="Correct"
            />
            <div
              style={{ width: `${(stat.wrongCount / stat.totalAttempts) * 100}%` }}
              className="bg-red-500"
              title="Wrong"
            />
            <div
              style={{ width: `${(stat.skippedCount / stat.totalAttempts) * 100}%` }}
              className="bg-gray-300"
              title="Skipped"
            />
          </div>
        </div>

        {/* Right: Stat Boxes */}
        <div className="flex gap-4 items-center shrink-0">
          <div className="text-center p-3 bg-green-50 rounded-lg min-w-[70px]">
            <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-700">{stat.correctCount}</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg min-w-[70px]">
            <XCircle className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-700">{stat.wrongCount}</p>
          </div>
          <div className="text-center p-3 bg-gray-100 rounded-lg min-w-[70px]">
            <MinusCircle className="w-4 h-4 text-gray-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-700">{stat.skippedCount}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Card className="mt-8 border-0 shadow-md ring-1 ring-gray-100 overflow-hidden">
      <CardHeader className="bg-gray-800 text-white border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          Question Analytics (Grouped by Difficulty)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 bg-gray-50">
        {/* Hard */}
        {hardQuestions.length > 0 && (
          <div className="mb-2">
            <div className="bg-red-50 border-y border-red-100 px-6 py-3 flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-red-700 uppercase tracking-wider text-sm">
                Hard / Needs Attention ({hardQuestions.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">{hardQuestions.map(renderQuestionRow)}</div>
          </div>
        )}

        {/* Moderate */}
        {moderateQuestions.length > 0 && (
          <div className="mb-2">
            <div className="bg-orange-50 border-y border-orange-100 px-6 py-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-orange-700 uppercase tracking-wider text-sm">
                Moderate / Needs Practice ({moderateQuestions.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">{moderateQuestions.map(renderQuestionRow)}</div>
          </div>
        )}

        {/* Easy */}
        {easyQuestions.length > 0 && (
          <div>
            <div className="bg-green-50 border-y border-green-100 px-6 py-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-green-700 uppercase tracking-wider text-sm">
                Easy / Well Understood ({easyQuestions.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">{easyQuestions.map(renderQuestionRow)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
