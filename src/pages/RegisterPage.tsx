import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, ArrowRight, Mail, Lock, User, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { authService } from '@/lib/auth'
import { registerSchema, type RegisterFormData } from '@/lib/validations'

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)
  const navigate = useNavigate()
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  })

  useEffect(() => {
    const checkAuth = async () => {
      const user = await authService.getCurrentUser()
      if (user) {
        navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard', { replace: true })
      }
    }
    checkAuth()
  }, [navigate])

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    try {
      await authService.register(data.fullName, data.email, data.password)
      setIsEmailSent(true)
      toast.success("Account created! Check your mail.")
    } catch (error: any) {
      console.error('Registration error:', error)
      toast.error(error.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 border-none shadow-2xl rounded-[2.5rem] bg-white">
          <CardHeader>
            <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 rotate-3 group-hover:rotate-0 transition-transform">
              <CheckCircle2 className="w-12 h-12 text-indigo-600" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Verify Email</CardTitle>
            <CardDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em] mt-2">
              MATERIALHUB QUIZX Safety Protocol
            </CardDescription>
            <p className="mt-6 text-slate-600 font-medium leading-relaxed">
              Humne ek verification link aapke email par bheja hai. Use click karne ke baad hi aap **MATERIALHUB QUIZX** access kar payenge.
            </p>
          </CardHeader>
          <CardFooter className="mt-4">
            <Button onClick={() => navigate('/login')} className="w-full h-14 bg-slate-900 hover:bg-indigo-600 rounded-2xl font-black italic uppercase tracking-widest transition-all shadow-xl">
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        
        {/* Left side - Branding */}
        <div className="hidden lg:block space-y-10 px-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl rotate-3">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">MATERIALHUB</h1>
              <span className="text-indigo-600 font-black italic uppercase tracking-[0.3em] text-xs">RANKIFY PLATFORM</span>
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-5xl font-black text-slate-900 leading-[1.1] italic uppercase tracking-tighter">
              Level up your <br />
              <span className="text-indigo-600">Learning Game.</span>
            </h2>
            <p className="text-lg text-slate-500 font-bold uppercase tracking-tight max-w-md">
              Join the elite community of learners on MATERIALHUB. Fast, Secure, and Built for Success.
            </p>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-none ring-1 ring-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <BookOpen className="w-32 h-32 text-indigo-600 rotate-12" />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <img
                src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop"
                alt="Student"
                className="w-14 h-14 rounded-2xl object-cover ring-4 ring-indigo-50"
              />
              <div>
                <p className="font-black italic text-slate-800 uppercase leading-none">Sarah Johnson</p>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Verified Scholar</p>
              </div>
            </div>
            <p className="text-slate-600 font-bold italic leading-relaxed relative z-10">
              "Rankify is a game changer. The interface is clean and the verification system makes it super secure."
            </p>
          </div>
        </div>

        {/* Right side - Register Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <Card className="shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-none rounded-[3rem] p-4 bg-white/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-6 pt-8 text-center">
              <div className="lg:hidden flex flex-col items-center gap-2 mb-6">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-black italic uppercase tracking-tighter">MATERIALHUB QUIZX</span>
              </div>
              <CardTitle className="text-3xl font-black italic uppercase text-slate-900 tracking-tighter">Join the Hub</CardTitle>
              <CardDescription className="font-black text-slate-400 uppercase text-[10px] tracking-[0.25em]">
                Create your student identity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      className="pl-12 h-14 rounded-2xl bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-100 font-bold"
                      {...register('fullName')}
                    />
                  </div>
                  {errors.fullName && <p className="text-[10px] font-black text-red-500 ml-2 uppercase italic">{errors.fullName.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@materialhub.com"
                      className="pl-12 h-14 rounded-2xl bg-slate-50 border-none font-bold"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && <p className="text-[10px] font-black text-red-500 ml-2 uppercase italic">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Secret Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-12 h-14 rounded-2xl bg-slate-50 border-none font-bold"
                      {...register('password')}
                    />
                  </div>
                  {errors.password && <p className="text-[10px] font-black text-red-500 ml-2 uppercase italic">{errors.password.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Verify Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="pl-12 h-14 rounded-2xl bg-slate-50 border-none font-bold"
                      {...register('confirmPassword')}
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-[10px] font-black text-red-500 ml-2 uppercase italic">{errors.confirmPassword.message}</p>}
                </div>

                <Button type="submit" className="w-full h-16 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black italic uppercase tracking-widest transition-all shadow-xl shadow-slate-200 mt-4 group" disabled={isLoading}>
                  {isLoading ? "HUB IS PROCESSING..." : (
                    <span className="flex items-center gap-2">
                      Sign Up <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 border-t border-slate-50 pt-8 pb-4">
              <p className="text-[10px] text-center font-black text-slate-400 uppercase tracking-widest">
                Member of the Hub?{' '}
                <Link to="/login" className="text-indigo-600 hover:underline underline-offset-4">
                  Sign in Access
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}

