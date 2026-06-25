import { create } from 'zustand'
import type { User } from '../types/user.types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User) => void
  setTokens: (access: string, refresh: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),

  setUser: (user) => set({ user, isAuthenticated: true }),

  setTokens: (access, refresh) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    set({ isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },
}))
