import { supabase } from './supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface User {
  id: string
  email: string
  full_name: string
  role: 'student' | 'admin'
}

export const authService = {
  async login(email: string, password: string): Promise<User> {
    console.log('Login attempt:', email)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Login failed')
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      throw new Error('Failed to fetch user profile')
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role as 'student' | 'admin',
    }

    console.log('Login successful:', user)
    return user
  },

  async register(fullName: string, email: string, password: string): Promise<User> {
    console.log('Registration attempt:', email)
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'student',
        },
      },
    })

    if (error) {
      console.error('Registration error:', error)
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Registration failed')
    }

    // 🔥 SMART FIX: Agar session null hai (matlab email verify karna baki hai)
    // Toh profile fetch mat karo, seedha UI ko aage badha do
    if (!data.session) {
      console.log('Registration successful, waiting for email verification')
      return {
        id: data.user.id,
        email: data.user.email || email,
        full_name: fullName,
        role: 'student'
      }
    }

    // Agar Email Verification OFF hai, tab profile fetch chalega
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      throw new Error('Failed to fetch user profile')
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role as 'student' | 'admin',
    }

    console.log('Registration successful:', user)
    return user
  },

  async logout(): Promise<void> {
    console.log('Logout')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout error:', error)
      throw new Error(error.message)
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return null
    }

    // Fetch user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error || !profile) {
      console.error('Profile fetch error:', error)
      return null
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role as 'student' | 'admin',
    }

    console.log('getCurrentUser - SUCCESS:', {
      email: user.email,
      databaseRole: profile.role,
      mappedRole: user.role,
      source: 'profiles table'
    })

    return user
  },

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user !== null
  },

  async hasRole(allowedRoles: string[]): Promise<boolean> {
    const user = await this.getCurrentUser()
    if (!user) return false
    return allowedRoles.includes(user.role)
  },
}
