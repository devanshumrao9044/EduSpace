export interface User {
  id: string
  email: string
  full_name: string
  role: 'student' | 'admin'
}

export interface Course {
  id: number
  title: string
  description: string
  instructor: string
  progress?: number
  students?: number
  completion?: number
}
