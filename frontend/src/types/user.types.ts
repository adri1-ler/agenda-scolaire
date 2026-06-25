export type UserRole = 'eleve' | 'prof'

export interface User {
  id: string
  nom: string
  prenom: string
  email: string
  role: UserRole
  photo_url?: string | null
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}
