export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'student' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'student' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'student' | 'admin'
          created_at?: string
          updated_at?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          title: string
          description: string
          duration_minutes: number
          total_marks: number
          passing_marks: number
          start_time: string
          end_time: string
          is_active: boolean
          show_results_immediately: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          duration_minutes: number
          total_marks: number
          passing_marks: number
          start_time: string
          end_time: string
          is_active?: boolean
          show_results_immediately?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          duration_minutes?: number
          total_marks?: number
          passing_marks?: number
          start_time?: string
          end_time?: string
          is_active?: boolean
          show_results_immediately?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          quiz_id: string
          question_text: string
          question_type: 'mcq' | 'integer' | 'paragraph'
          options: Record<string, string> | null
          correct_answer: string
          marks: number
          order_number: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question_text: string
          question_type: 'mcq' | 'integer' | 'paragraph'
          options?: Record<string, string> | null
          correct_answer: string
          marks: number
          order_number: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          question_text?: string
          question_type?: 'mcq' | 'integer' | 'paragraph'
          options?: Record<string, string> | null
          correct_answer?: string
          marks?: number
          order_number?: number
          created_at?: string
          updated_at?: string
        }
      }
      quiz_attempts: {
        Row: {
          id: string
          quiz_id: string
          student_id: string
          started_at: string
          submitted_at: string | null
          answers: Record<string, string>
          score: number | null
          is_evaluated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          student_id: string
          started_at?: string
          submitted_at?: string | null
          answers?: Record<string, string>
          score?: number | null
          is_evaluated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          student_id?: string
          started_at?: string
          submitted_at?: string | null
          answers?: Record<string, string>
          score?: number | null
          is_evaluated?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Quiz = Database['public']['Tables']['quizzes']['Row']
export type QuizInsert = Database['public']['Tables']['quizzes']['Insert']
export type QuizUpdate = Database['public']['Tables']['quizzes']['Update']

export type Question = Database['public']['Tables']['questions']['Row']
export type QuestionInsert = Database['public']['Tables']['questions']['Insert']
export type QuestionUpdate = Database['public']['Tables']['questions']['Update']

export type QuizAttempt = Database['public']['Tables']['quiz_attempts']['Row']
export type QuizAttemptInsert = Database['public']['Tables']['quiz_attempts']['Insert']
export type QuizAttemptUpdate = Database['public']['Tables']['quiz_attempts']['Update']
