import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi, revisionApi } from '../../api/schedule.api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useState } from 'react'
import PartieList from '../../components/revision/PartieList'
import RevisionGeneratorPanel from '../../components/revision/RevisionGeneratorPanel'
import type { EventItem, RevisionSlot } from '../../types/event.types'

const STATUT_COLORS = {
  planifie: 'bg-blue-100 text-blue-700',
  fait: 'bg-green-100 text-green-700',
  saute: 'bg-gray-100 text-gray-500 line-through',
}

export default function RevisionPage() {
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: eventsApi.list })
  const examens = events.filter((e: EventItem) => e.event_type === 'examen')
  const [selectedExamen, setSelectedExamen] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-primary-950 tracking-tight">Mes révisions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Examens</h2>
          {examens.length === 0 && <p className="text-sm text-gray-400">Aucun examen prévu</p>}
          {examens.map((e: EventItem) => (
            <button
              key={e.id}
              onClick={() => setSelectedExamen(e.id)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selectedExamen === e.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-sm text-gray-800">{e.titre}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {format(new Date(e.created_at), 'dd MMM yyyy', { locale: fr })}
              </p>
            </button>
          ))}
        </div>

        {selectedExamen && (
          <div className="lg:col-span-2 space-y-4">
            <PartieList examenId={selectedExamen} />
            <RevisionGeneratorPanel examenId={selectedExamen} />
            <RevisionSlotsList examenId={selectedExamen} />
          </div>
        )}
      </div>
    </div>
  )
}

function RevisionSlotsList({ examenId }: { examenId: string }) {
  const qc = useQueryClient()
  const { data: slots = [] } = useQuery({
    queryKey: ['revision', examenId],
    queryFn: () => revisionApi.list(examenId),
  })

  const toggle = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: string }) => revisionApi.updateSlot(id, statut),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['revision', examenId] }),
  })

  if (slots.length === 0) return null

  const done = slots.filter((s: RevisionSlot) => s.statut === 'fait').length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Créneaux générés</h3>
        <span className="text-xs text-gray-500">{done}/{slots.length} fait(s)</span>
      </div>
      {slots.map((slot: RevisionSlot) => (
        <div key={slot.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              {format(new Date(slot.debut), 'EEE dd MMM · HH:mm', { locale: fr })} – {format(new Date(slot.fin), 'HH:mm')}
            </p>
            <p className="text-xs text-gray-400">{slot.duree_minutes} min</p>
          </div>
          <select
            value={slot.statut}
            onChange={e => toggle.mutate({ id: slot.id, statut: e.target.value })}
            className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUT_COLORS[slot.statut as keyof typeof STATUT_COLORS]}`}
          >
            <option value="planifie">Planifié</option>
            <option value="fait">Fait</option>
            <option value="saute">Sauté</option>
          </select>
        </div>
      ))}
    </div>
  )
}
