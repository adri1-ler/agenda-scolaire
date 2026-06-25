import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api/axios'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const WS_BASE = import.meta.env.VITE_API_URL?.replace('http', 'ws') ?? 'ws://localhost:8000'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 60000,
  })

  const unread = notifications.filter((n: any) => !n.is_read).length

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? ''
    if (!token) return
    const ws = new WebSocket(`${WS_BASE}/ws/notifications?token=${token}`)
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'message') {
          const channelId = payload.channel_id
          toast(payload.titre, {
            description: payload.contenu?.substring(0, 100),
            duration: 4000,
            action: channelId ? {
              label: 'Ouvrir',
              onClick: () => navigate(`/messaging?channel=${channelId}`),
            } : undefined,
          })
        }
      } catch {}
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
    return () => ws.close()
  }, [qc, navigate])

  const markRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`)
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAllRead = async () => {
    await api.put('/notifications/read-all')
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const handleNotifClick = async (n: any) => {
    if (!n.is_read) await markRead(n.id)
    if (n.type === 'message' && n.channel_id) {
      setOpen(false)
      navigate(`/messaging?channel=${n.channel_id}`)
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 text-gray-500 hover:text-gray-700">
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-800">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                Tout marquer lu
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Aucune notification</p>
            )}
            {notifications.slice(0, 20).map((n: any) => (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50' : ''}`}
              >
                <p className="text-sm font-medium text-gray-800">{n.titre}</p>
                {n.contenu && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.contenu}</p>}
                {n.type === 'message' && n.channel_id && (
                  <p className="text-xs text-primary-600 mt-0.5">→ Ouvrir la discussion</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {format(new Date(n.created_at), 'dd MMM · HH:mm', { locale: fr })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
