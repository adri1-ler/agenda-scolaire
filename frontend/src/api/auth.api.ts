import { api } from './axios'
import type { User, TokenResponse } from '../types/user.types'

export interface RegisterPayload {
  nom: string
  prenom: string
  email: string
  mot_de_passe: string
  role: 'eleve' | 'prof'
  matiere?: string
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<User>('/auth/register', data).then((r) => r.data),

  login: (email: string, mot_de_passe: string) =>
    api.post<TokenResponse>('/auth/login', { email, mot_de_passe }).then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),
}
