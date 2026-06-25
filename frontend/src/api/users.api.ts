import { api } from './axios'
import type { User } from '../types/user.types'

export const usersApi = {
  uploadPhoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<User>('/users/me/photo', form).then(r => r.data)
  },

  deletePhoto: () => api.delete<User>('/users/me/photo').then(r => r.data),
}
