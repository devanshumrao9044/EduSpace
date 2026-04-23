import { z } from 'zod'

// Shared: Sirf letters aur spaces allow karega (No <script> or HTML)
const nameRegex = /^[a-zA-Z\s]*$/

export const loginSchema = z.object({
  email: z.string().email('Bhai, sahi email dalo!'),
  password: z.string().min(6, 'Password kam se kam 6 chars ka hona chahiye'),
})

export const registerSchema = z.object({
  fullName: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(50, 'Zada bada naam mat dalo')
    .regex(nameRegex, 'Naam mein sirf alphabets aur spaces allow hain!'), // 🔥 XSS Protection
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords match nahi kar rahe",
  path: ["confirmPassword"],
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>

