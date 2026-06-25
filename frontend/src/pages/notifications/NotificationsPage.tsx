import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '../../api/axios'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const KIND_ICONS: Record<string, string> = {
  reminder: '⏰',
  message: '💬',
  revision: '📚',
  system: 'ℹ️',
}

export default function NotificationsPage() {
  const qc = useQueryClient()
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
  })

  const markAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = notifications.filter((n: any) => !n.is_read).length

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-primary-950 tracking-tight">Notifications</h1>
        {unread > 0 && (
          <button onClick={() => markAll.mutate()} className="text-sm text-primary-600 hover:underline">
            Tout marquer comme lu ({unread})
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🔔</p>
          <p>Aucune notification pour l'instant</p>
        </div>
      )}

      {notifications.map((n: any) => (
        <div
          key={n.id}
          className={`flex gap-3 p-4 bg-white rounded-xl border ${!n.is_read ? 'border-primary-200 bg-primary-50' : 'border-gray-200'}`}
        >
          <span className="text-xl mt-0.5">{KIND_ICONS[n.type] ?? 'ℹ️'}</span>
          <div className="flex-1">
            <p className={`text-sm font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.titre}</p>
            {n.contenu && <p className="text-xs text-gray-500 mt-0.5">{n.contenu}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {format(new Date(n.created_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
          <button
            onClick={() => del.mutate(n.id)}
            className="text-gray-300 hover:text-red-400 text-lg self-start"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
