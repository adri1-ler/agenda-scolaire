import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { remindersApi } from '../../api/schedule.api'
import type { NotifType, Reminder } from '../../types/event.types'

const PRESETS = [
  { label: '10 minutes avant', minutes: 10 },
  { label: '1 heure avant', minutes: 60 },
  { label: '1 jour avant', minutes: 1440 },
  { label: '1 semaine avant', minutes: 10080 },
]

const CHANNELS: { value: NotifType; label: string }[] = [
  { value: 'in_app', label: 'Notification' },
  { value: 'email', label: 'E-mail' },
  { value: 'both', label: 'Les deux' },
]

const CHANNEL_ICON: Record<NotifType, string> = { in_app: '🔔', email: '✉️', both: '🔔✉️' }

export default function ReminderSection({ scheduleId }: { scheduleId: string }) {
  const qc = useQueryClient()
  const [minutes, setMinutes] = useState(60)
  const [channel, setChannel] = useState<NotifType>('in_app')

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', scheduleId],
    queryFn: () => remindersApi.list(scheduleId),
  })

  const addReminder = useMutation({
    mutationFn: () => remindersApi.create(scheduleId, minutes, channel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders', scheduleId] })
      toast.success('Rappel ajouté')
    },
    onError: () => toast.error('Impossible d\'ajouter le rappel'),
  })

  const removeReminder = useMutation({
    mutationFn: (id: string) => remindersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders', scheduleId] }),
  })

  return (
    <div className="border-t border-gray-100 pt-3">
      <label className="block text-sm font-medium text-gray-700 mb-2">🔔 Rappels</label>

      {reminders.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {reminders.map((r: Reminder) => (
            <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-gray-700">
                {CHANNEL_ICON[r.type_notification]} {format(new Date(r.trigger_at), "d MMM 'à' HH:mm", { locale: fr })}
                {r.sent && <span className="ml-2 text-gray-400">(envoyé)</span>}
              </span>
              <button
                type="button"
                onClick={() => removeReminder.mutate(r.id)}
                className="text-gray-400 hover:text-red-600 text-sm leading-none px-1"
                title="Supprimer le rappel"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={minutes}
          onChange={e => setMinutes(Number(e.target.value))}
          className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        >
          {PRESETS.map(p => <option key={p.minutes} value={p.minutes}>{p.label}</option>)}
        </select>
        <select
          value={channel}
          onChange={e => setChannel(e.target.value as NotifType)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        >
          {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => addReminder.mutate()}
          disabled={addReminder.isPending}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
        >
          Ajouter
        </button>
      </div>
    </div>
  )
}
