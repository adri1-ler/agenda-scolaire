import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { messagingApi } from '../../api/messaging.api'
import { toast } from 'sonner'

export default function MessageInput({ channelId }: { channelId: string }) {
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const send = useMutation({
    mutationFn: async (content: string) => {
      const msg = await messagingApi.sendMessage(channelId, content)
      const file = fileRef.current?.files?.[0]
      if (file) {
        await messagingApi.uploadAttachment(msg.id, file)
        if (fileRef.current) fileRef.current.value = ''
      }
      return msg
    },
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['messages', channelId] })
    },
    onError: () => toast.error('Erreur lors de l\'envoi'),
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim()) send.mutate(text.trim())
    }
  }

  return (
    <div className="border-t border-gray-200 p-3">
      <div className="flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message… (Entrée pour envoyer)"
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-gray-800 focus:outline-none max-h-32"
        />
        <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-gray-400 hover:text-gray-600 text-lg"
          title="Joindre un fichier"
        >
          📎
        </button>
        <button
          onClick={() => text.trim() && send.mutate(text.trim())}
          disabled={send.isPending || !text.trim()}
          className="bg-primary-600 text-white rounded-lg px-3 py-1 text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
