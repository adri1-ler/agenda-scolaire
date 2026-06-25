import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api/axios'
import { messagingApi } from '../../api/messaging.api'
import { useAuthStore } from '../../store/authStore'
import ChannelList from '../../components/messaging/ChannelList'
import MessageThread from '../../components/messaging/MessageThread'
import MessageInput from '../../components/messaging/MessageInput'
import Avatar from '../../components/ui/Avatar'
import type { Message } from '../../types/messaging.types'

const WS_BASE = import.meta.env.VITE_API_URL?.replace('http', 'ws') ?? 'ws://localhost:8000'

interface UserItem {
  id: string
  nom: string
  prenom: string
  email: string
  role: string
  photo_url?: string | null
}

export default function MessagingPage() {
  const { user: me } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedChannel, setSelectedChannel] = useState<string | null>(
    searchParams.get('channel')
  )
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: channels = [], refetch: refetchChannels } = useQuery({
    queryKey: ['channels'],
    queryFn: messagingApi.listChannels,
    refetchInterval: 30000,
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedChannel],
    queryFn: () => messagingApi.listMessages(selectedChannel!),
    enabled: !!selectedChannel,
  })

  const { data: allUsers = [] } = useQuery<UserItem[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get<UserItem[]>('/users').then(r => r.data),
    enabled: showUserPicker,
  })

  useEffect(() => {
    if (!selectedChannel) return
    const token = localStorage.getItem('access_token') ?? ''
    const ws = new WebSocket(`${WS_BASE}/ws/messaging/${selectedChannel}?token=${token}`)
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      if (payload.type === 'message') {
        qc.setQueryData<Message[]>(['messages', selectedChannel], (old = []) => [...old, payload.data])
      }
    }
    wsRef.current = ws
    messagingApi.markRead(selectedChannel)
    return () => ws.close()
  }, [selectedChannel, qc])

  // Focus rename input when opened
  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => renameRef.current?.focus(), 50)
    }
  }, [isRenaming])

  const startDirectConversation = async (userId: string) => {
    try {
      const channel = await messagingApi.createDirect(userId)
      await refetchChannels()
      setSelectedChannel(channel.id)
      setShowUserPicker(false)
      setUserSearch('')
    } catch {
      const existing = channels.find(c => c.type === 'direct' && c.nom == null)
      if (existing) setSelectedChannel(existing.id)
    }
  }

  const startRename = () => {
    setRenameValue(selectedChannelData?.nom ?? '')
    setIsRenaming(true)
  }

  const confirmRename = async () => {
    if (!selectedChannel || !renameValue.trim()) return
    try {
      await messagingApi.renameChannel(selectedChannel, renameValue.trim())
      await refetchChannels()
      setIsRenaming(false)
    } catch {
      toast.error('Impossible de renommer la conversation')
    }
  }

  const filteredUsers = allUsers.filter(u =>
    u.id !== me?.id &&
    (`${u.prenom} ${u.nom} ${u.email}`).toLowerCase().includes(userSearch.toLowerCase())
  )

  const selectedChannelData = channels.find(c => c.id === selectedChannel)
  const canRename = selectedChannelData?.created_by === me?.id

  return (
    <div className="flex h-full -m-3 md:-m-6 overflow-hidden">
      {/* Conversation list — full width on mobile when no channel selected, fixed sidebar on desktop */}
      <div className={`bg-white border-r border-gray-200 flex flex-col overflow-hidden w-full md:w-64 ${selectedChannel ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Messagerie</span>
          <button
            onClick={() => setShowUserPicker(true)}
            title="Nouvelle conversation"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-lg font-bold"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChannelList channels={channels} selected={selectedChannel} onSelect={setSelectedChannel} />
        </div>
      </div>

      {/* Chat area — full width on mobile when channel selected */}
      {selectedChannel ? (
        <div className="flex flex-col flex-1 min-w-0 bg-white overflow-hidden w-full md:w-auto">
          <div className="px-3 md:px-5 py-3 border-b border-gray-200 flex items-center gap-2">
            {/* Back button — mobile only */}
            <button
              onClick={() => setSelectedChannel(null)}
              className="md:hidden text-gray-500 hover:text-gray-700 text-xl leading-none px-1"
              aria-label="Retour"
            >
              ←
            </button>

            {isRenaming ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setIsRenaming(false) }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de la conversation"
                />
                <button onClick={confirmRename} className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">OK</button>
                <button onClick={() => setIsRenaming(false)} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700">✕</button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-800 truncate">
                    {selectedChannelData?.nom || 'Conversation directe'}
                  </h2>
                  {selectedChannelData?.matiere && (
                    <p className="text-xs text-gray-400">{selectedChannelData.matiere}</p>
                  )}
                </div>
                {canRename && (
                  <button onClick={startRename} title="Renommer" className="text-gray-400 hover:text-gray-600 text-sm p-1 rounded hover:bg-gray-100 flex-shrink-0">
                    ✏️
                  </button>
                )}
              </>
            )}
          </div>
          <MessageThread messages={messages} />
          <MessageInput channelId={selectedChannel} />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-400">
          <div className="text-center">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm">Sélectionnez un canal ou</p>
            <button onClick={() => setShowUserPicker(true)} className="mt-2 text-sm text-blue-600 hover:underline">
              démarrez une nouvelle conversation
            </button>
          </div>
        </div>
      )}

      {/* User picker modal */}
      {showUserPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Nouvelle conversation</h2>
              <button
                onClick={() => { setShowUserPicker(false); setUserSearch('') }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <input
                autoFocus
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Rechercher par nom ou email…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-y-auto max-h-72">
              {filteredUsers.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400 text-center">Aucun utilisateur trouvé</p>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startDirectConversation(u.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left"
                  >
                    <Avatar photoUrl={u.photo_url} prenom={u.prenom} nom={u.nom} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-gray-400 truncate">{u.role === 'prof' ? '👨‍🏫 Prof' : '🎓 Élève'} · {u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
