import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useCreateSchedule } from '../../hooks/useSchedule'

const schema = z.object({
  titre: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  periode_debut: z.string().min(1, 'La date de début est requise'),
  periode_fin: z.string().min(1, 'La date de fin est requise'),
  couleur: z.string().default('#3B82F6'),
}).refine(d => new Date(d.periode_fin) > new Date(d.periode_debut), {
  message: 'La fin doit être après le début',
  path: ['periode_fin'],
})

type FormData = z.infer<typeof schema>

const COLORS = [
  { value: '#3B82F6', label: 'Bleu' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#EC4899', label: 'Rose' },
  { value: '#EF4444', label: 'Rouge' },
  { value: '#F97316', label: 'Orange' },
  { value: '#F59E0B', label: 'Ambre' },
  { value: '#EAB308', label: 'Jaune' },
  { value: '#22C55E', label: 'Vert' },
  { value: '#10B981', label: 'Émeraude' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#0EA5E9', label: 'Ciel' },
  { value: '#78716C', label: 'Pierre' },
  { value: '#6B7280', label: 'Gris' },
]

export default function ScheduleForm({ onClose }: { onClose: () => void }) {
  const createSchedule = useCreateSchedule()
  const now = new Date()
  const defaultDebut = format(now, "yyyy-MM-dd'T'HH:mm")
  const defaultFin = format(new Date(now.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { periode_debut: defaultDebut, periode_fin: defaultFin, couleur: '#3B82F6' },
  })
  const selectedColor = watch('couleur')

  const onSubmit = async (data: FormData) => {
    await createSchedule.mutateAsync({
      titre: data.titre,
      description: data.description || undefined,
      periode_debut: new Date(data.periode_debut).toISOString(),
      periode_fin: new Date(data.periode_fin).toISOString(),
      couleur: data.couleur,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
        <input
          {...register('titre')}
          placeholder="Ex : Cours de maths"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.titre && <p className="text-red-500 text-xs mt-1">{errors.titre.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optionnelle)</span></label>
        <textarea
          {...register('description')}
          placeholder="Ex : Chapitre 3 — fonctions dérivées"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
          <input
            type="datetime-local"
            {...register('periode_debut')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.periode_debut && <p className="text-red-500 text-xs mt-1">{errors.periode_debut.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
          <input
            type="datetime-local"
            {...register('periode_fin')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.periode_fin && <p className="text-red-500 text-xs mt-1">{errors.periode_fin.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <label key={c.value} className="flex items-center gap-1 cursor-pointer">
              <input type="radio" {...register('couleur')} value={c.value} className="sr-only" />
              <span
                className="w-6 h-6 rounded-full border-2 border-white shadow ring-2"
                style={{ backgroundColor: c.value, ringColor: selectedColor === c.value ? c.value : 'transparent', outline: selectedColor === c.value ? `2px solid ${c.value}` : '2px solid transparent', outlineOffset: '2px' }}
                title={c.label}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Ajout…' : 'Ajouter le créneau'}
        </button>
      </div>
    </form>
  )
}
