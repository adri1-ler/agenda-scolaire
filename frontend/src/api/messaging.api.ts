import { api } from './axios'
import type { Channel, Message } from '../types/messaging.types'

export const messagingApi = {
  listChannels: () => api.get<Channel[]>('/messaging/channels').then(r => r.data),

  createMatiereChannel: (data: { nom: string; matiere: string; classe_id: string }) =>
    api.post<Channel>('/messaging/channels', data).then(r => r.data),

  createDirect: (other_user_id: string) =>
    api.post<Channel>('/messaging/channels/direct', { other_user_id }).then(r => r.data),

  listMessages: (channelId: string, before?: string) =>
    api.get<Message[]>(`/messaging/channels/${channelId}/messages`, { params: { before, limit: 50 } }).then(r => r.data),

  sendMessage: (channelId: string, content: string, parent_id?: string) =>
    api.post<Message>(`/messaging/channels/${channelId}/messages`, { content, parent_id }).then(r => r.data),

  editMessage: (messageId: string, content: string) =>
    api.put<Message>(`/messaging/messages/${messageId}`, { content }).then(r => r.data),

  deleteMessage: (messageId: string) => api.delete(`/messaging/messages/${messageId}`),

  uploadAttachment: (messageId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/messaging/messages/${messageId}/attachments`, form).then(r => r.data)
  },

  markRead: (channelId: string) => api.put(`/messaging/channels/${channelId}/read`),

  renameChannel: (channelId: string, nom: string) =>
    api.put<Channel>(`/messaging/channels/${channelId}`, { nom }).then(r => r.data),
}
