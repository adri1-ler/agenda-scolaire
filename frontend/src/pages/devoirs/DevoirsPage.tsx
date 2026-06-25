import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, differenceInCalendarDays, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { eventsApi } from '../../api/schedule.api'
import type { DevoirItem } from '../../types/event.types'

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

function deadlineLabel(iso: string): { text: string; tone: 'late' | 'soon' | 'ok' } {
  const date = new Date(iso)
  const days = differenceInCalendarDays(date, new Date())
  if (isPast(date) && days < 0) return { text: 'En retard', tone: 'late' }
  if (days === 0) return { text: "Aujourd'hui", tone: 'soon' }
  if (days === 1) return { text: 'Demain', tone: 'soon' }
  if (days <= 3) return { text: `Dans ${days} jours`, tone: 'soon' }
  return { text: `Dans ${days} jours`, tone: 'ok' }
}

const TONE_STYLES = {
  late: 'bg-red-100 text-red-700',
  soon: 'bg-amber-100 text-amber-700',
  ok: 'bg-gray-100 text-gray-500',
}

export default function DevoirsPage() {
  const qc = useQueryClient()
  const { data: devoirs = [], isLoading } = useQuery({
    queryKey: ['devoirs'],
    queryFn: eventsApi.listDevoirs,
  })

  const toggleDone = useMutation({
    mutationFn: ({ eventId, done }: { eventId: string; done: boolean }) =>
      eventsApi.setStatut(eventId, done ? 'termine' : 'planifie'),
    onMutate: async ({ eventId, done }) => {
      await qc.cancelQueries({ queryKey: ['devoirs'] })
      const prev = qc.getQueryData<DevoirItem[]>(['devoirs'])
      qc.setQueryData<DevoirItem[]>(['devoirs'], (old = []) =>
        old.map(d => d.event_id === eventId ? { ...d, statut: done ? 'termine' : 'planifie' } : d)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['devoirs'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['devoirs'] }),
  })

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-primary-950 tracking-tight">Mes devoirs</h1>
        <p className="text-sm text-gray-500 mt-1">Ce que vous devez rendre, par échéance.</p>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Chargement…</p>}

      {!isLoading && devoirs.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-3xl mb-2">📚</p>
          <p className="text-sm text-gray-500">Aucun devoir à rendre pour le moment.</p>
        </div>
      )}

      <div className="space-y-3">
        {devoirs.map((d: DevoirItem) => {
          const deadline = deadlineLabel(d.date_limite)
          const done = d.statut === 'termine'
          return (
            <div
              key={d.event_id}
              className={`border rounded-xl p-4 flex items-start gap-4 transition-colors ${
                done ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
              }`}
            >
              {/* Done checkbox */}
              <input
                type="checkbox"
                checked={done}
                onChange={e => toggleDone.mutate({ eventId: d.event_id, done: e.target.checked })}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer flex-shrink-0"
                title={done ? 'Marquer comme à faire' : 'Marquer comme terminé'}
              />

              {/* Amber accent stripe — matches the calendar motif */}
              <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${done ? 'bg-gray-300' : 'bg-amber-400'}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{d.titre}</p>
                    <p className={`text-xs font-medium mt-0.5 ${done ? 'text-gray-400' : 'text-amber-700'}`}>{d.matiere}</p>
                  </div>
                  {done ? (
                    <span className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                      ✓ Terminé
                    </span>
                  ) : (
                    <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${TONE_STYLES[deadline.tone]}`}>
                      {deadline.text}
                    </span>
                  )}
                </div>

                {d.description && (
                  <p className={`text-sm mt-2 whitespace-pre-line ${done ? 'text-gray-400' : 'text-gray-600'}`}>{d.description}</p>
                )}

                <div className={`flex items-center gap-4 mt-3 text-xs ${done ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span className="flex items-center gap-1">
                    🗓 À rendre le {format(new Date(d.date_limite), "d MMMM 'à' HH:mm", { locale: fr })}
                  </span>
                  <span className="flex items-center gap-1">
                    ⏱ {formatDuration(d.temps_requis)} estimé
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
