import { useState } from 'react'
import { useParties, useCreatePartie, useUpdatePartie, useDeletePartie } from '../../hooks/useSchedule'
import type { Partie } from '../../types/event.types'

const STATUT_LABELS: Record<string, string> = {
  a_reviser: 'À réviser',
  en_cours: 'En cours',
  revise: 'Révisé',
}

const STATUT_COLORS: Record<string, string> = {
  a_reviser: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-100 text-blue-700',
  revise: 'bg-green-100 text-green-700',
}

export default function PartieList({ examenId }: { examenId: string }) {
  const { data: parties = [], isLoading } = useParties(examenId)
  const createPartie = useCreatePartie(examenId)
  const updatePartie = useUpdatePartie(examenId)
  const deletePartie = useDeletePartie(examenId)
  const [nom, setNom] = useState('')
  const [heures, setHeures] = useState(2)

  const handleAdd = async () => {
    if (!nom.trim()) return
    await createPartie.mutateAsync({ nom, temps_requis_heures: heures, ordre: parties.length })
    setNom('')
    setHeures(2)
  }

  const cycleStatut = (partie: Partie) => {
    const cycle = ['a_reviser', 'en_cours', 'revise']
    const next = cycle[(cycle.indexOf(partie.statut) + 1) % cycle.length]
    updatePartie.mutate({ partieId: partie.id, data: { statut: next } })
  }

  if (isLoading) return <div className="text-sm text-gray-400">Chargement…</div>

  const totalHeures = parties.reduce((s, p) => s + Number(p.temps_requis_heures), 0)
  const revisees = parties.filter(p => p.statut === 'revise').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Parties à réviser</h3>
        <span className="text-xs text-gray-500">{revisees}/{parties.length} révisées · {totalHeures}h total</span>
      </div>

      {parties.map((p) => (
        <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <button
            onClick={() => cycleStatut(p)}
            className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUT_COLORS[p.statut]}`}
          >
            {STATUT_LABELS[p.statut]}
          </button>
          <span className="flex-1 text-sm text-gray-800">{p.nom}</span>
          <span className="text-xs text-gray-400">{p.temps_requis_heures}h</span>
          <button
            onClick={() => deletePartie.mutate(p.id)}
            disabled={deletePartie.isPending}
            title="Supprimer cette partie"
            className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>
      ))}

      <div className="flex gap-2 mt-3">
        <input
          value={nom}
          onChange={e => setNom(e.target.value)}
          placeholder="Nom de la partie"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="number"
          min={0.5}
          step={0.5}
          value={heures}
          onChange={e => setHeures(Number(e.target.value))}
          className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <span className="self-center text-sm text-gray-500">h</span>
        <button
          onClick={handleAdd}
          disabled={createPartie.isPending || !nom.trim()}
          className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          +
        </button>
      </div>
    </div>
  )
}
