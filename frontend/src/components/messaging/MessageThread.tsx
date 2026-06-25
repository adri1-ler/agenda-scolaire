import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuthStore } from '../../store/authStore'
import Avatar from '../ui/Avatar'
import type { Message } from '../../types/messaging.types'

export default function MessageThread({ messages }: { messages: Message[] }) {
  const { user } = useAuthStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
      {messages.map((msg) => {
        const isMe = msg.sender_id === user?.id
        return (
          <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {!isMe && (
              <Avatar photoUrl={msg.sender_photo_url} prenom={msg.sender_prenom} nom={msg.sender_nom} size={28} className="mb-5" />
            )}
            <div className={`max-w-xs lg:max-w-md min-w-0 ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {!isMe && (
                <span className="text-xs text-gray-400 px-1">
                  {msg.sender_prenom} {msg.sender_nom}
                </span>
              )}
              <div className={`rounded-2xl px-4 py-2 text-sm break-words ${
                isMe ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                {msg.content && <p>{msg.content}</p>}
                {msg.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 mt-1 text-xs opacity-80">
                    <span>📎</span>
                    <span className="underline cursor-pointer">{att.filename}</span>
                    {att.size_bytes && <span>({Math.round(att.size_bytes / 1024)}kb)</span>}
                  </div>
                ))}
              </div>
              <span className="text-xs text-gray-400 px-1">
                {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                {msg.edited_at && ' (modifié)'}
              </span>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
