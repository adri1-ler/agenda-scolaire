import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/axios'
import { useCreateExamen } from '../../hooks/useSchedule'

const schema = z.object({
  titre: z.string().min(1),
  matiere: z.string().min(1),
  date_debut: z.string().min(1),
  date_fin: z.string().min(1),
  lieu: z.string().optional(),
  description: z.string().optional(),
  classe_id: z.string().min(1, 'Choisissez une classe'),
})

type FormData = z.infer<typeof schema>

export default function ExamenForm({ onClose }: { onClose: () => void }) {
  const createExamen = useCreateExamen()
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    await createExamen.mutateAsync(data)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
        <input {...register('titre')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        {errors.titre && <p className="text-red-500 text-xs mt-1">{errors.titre.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Matière</label>
        <input {...register('matiere')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
          <input type="datetime-local" {...register('date_debut')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
          <input type="datetime-local" {...register('date_fin')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
        <select {...register('classe_id')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Sélectionner une classe</option>
          {classes?.map((c: any) => <option key={c.id} value={c.id}>{c.nom} {c.niveau && `(${c.niveau})`}</option>)}
        </select>
        {errors.classe_id && <p className="text-red-500 text-xs mt-1">{errors.classe_id.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Lieu (optionnel)</label>
        <input {...register('lieu')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {isSubmitting ? 'Création…' : 'Créer l\'examen'}
        </button>
      </div>
    </form>
  )
}
