export type ChannelType = 'direct' | 'groupe_classe' | 'matiere'

export interface Channel {
  id: string
  type: ChannelType
  nom: string | null
  classe_id: string | null
  matiere: string | null
  created_at: string
  unread_count: number
  created_by: string | null
}

export interface Attachment {
  id: string
  filename: string
  mimetype: string | null
  size_bytes: number | null
}

export interface Message {
  id: string
  channel_id: string
  sender_id: string
  sender_nom: string
  sender_prenom: string
  sender_photo_url?: string | null
  content: string | null
  created_at: string
  edited_at: string | null
  parent_id: string | null
  attachments: Attachment[]
}
