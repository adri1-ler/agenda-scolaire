import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { revisionApi, eventsApi } from '../../api/schedule.api'
import { toast } from 'sonner'

export default function RevisionGeneratorPanel({ examenId }: { examenId: string }) {
  const [duration, setDuration] = useState(90)
  const [studyStart, setStudyStart] = useState(9)
  const [studyEnd, setStudyEnd] = useState(18)
  const [totalHours, setTotalHours] = useState(4)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: parties = [] } = useQuery({
    queryKey: ['parties', examenId],
    queryFn: () => eventsApi.listParties(examenId),
  })

  const importCourse = useMutation({
    mutationFn: () => revisionApi.importCourse(examenId, selectedFile!, totalHours),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['parties', examenId] })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success(`${data.length} partie(s) créées depuis le cours`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Erreur lors de l\'import'),
  })

  const generate = useMutation({
    mutationFn: () => revisionApi.generate(examenId, duration, studyStart, studyEnd),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['revision', examenId] })
      toast.success(`${data.length} créneau(x) de révision générés`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Erreur de génération'),
  })

  const deleteAll = useMutation({
    mutationFn: () => revisionApi.deleteAll(examenId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['revision', examenId] })
      toast.success('Créneaux supprimés')
    },
  })

  const hours = Array.from({ length: 19 }, (_, i) => i + 5)
  const totalRequired = parties.reduce((sum, p) => sum + p.temps_requis_heures, 0)

  return (
    <div className="space-y-4">
      {/* Course import */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-blue-800">Importer votre cours (PDF)</h3>
        <p className="text-sm text-blue-700">
          L'app analyse votre cours et crée automatiquement les parties à réviser.
        </p>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 whitespace-nowrap">Heures de révision totales :</label>
          <input
            type="number"
            min={0.5}
            max={100}
            step={0.5}
            value={totalHours}
            onChange={e => setTotalHours(Number(e.target.value))}
            className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center"
          />
          <span className="text-sm text-gray-500">h</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-blue-300 file:text-sm file:text-blue-700 file:bg-blue-50 hover:file:bg-blue-100 file:cursor-pointer"
          />
        </div>

        <button
          onClick={() => importCourse.mutate()}
          disabled={!selectedFile || importCourse.isPending}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {importCourse.isPending ? 'Analyse en cours…' : 'Analyser et créer les parties'}
        </button>
      </div>

      {/* Parties list */}
      {parties.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              Parties à réviser
              <span className="ml-2 text-sm font-normal text-gray-500">
                {totalRequired}h au total
              </span>
            </h3>
          </div>
          <div className="space-y-1.5">
            {parties.map((p, i) => (
              <div key={p.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{p.nom}</span>
                    <span className="flex-shrink-0 text-xs text-gray-500">{p.temps_requis_heures}h</span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision generation */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-green-800">Génération automatique des créneaux</h3>
        <p className="text-sm text-green-700">
          L'app répartit les heures requises sur vos créneaux libres avant l'examen.
        </p>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 whitespace-nowrap">Durée par session :</label>
          <input
            type="range"
            min={60}
            max={120}
            step={15}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-medium text-gray-700 w-16">{duration} min</span>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 whitespace-nowrap">Heures de travail :</label>
          <select
            value={studyStart}
            onChange={e => setStudyStart(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
          >
            {hours.map(h => (
              <option key={h} value={h} disabled={h >= studyEnd}>{h}h00</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">→</span>
          <select
            value={studyEnd}
            onChange={e => setStudyEnd(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
          >
            {hours.map(h => (
              <option key={h} value={h} disabled={h <= studyStart}>{h}h00</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending || parties.length === 0}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {generate.isPending ? 'Génération…' : 'Générer les créneaux'}
          </button>
          <button
            onClick={() => deleteAll.mutate()}
            disabled={deleteAll.isPending}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
        {parties.length === 0 && (
          <p className="text-xs text-gray-400 text-center">
            Importez votre cours ou ajoutez des parties pour générer les créneaux.
          </p>
        )}
      </div>
    </div>
  )
}
