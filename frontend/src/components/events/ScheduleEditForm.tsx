import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useUpdateSchedule, useDeleteSchedule } from '../../hooks/useSchedule'
import { useAuthStore } from '../../store/authStore'
import ReminderSection from './ReminderSection'
import type { ScheduleItem } from '../../types/event.types'

const schema = z.object({
  titre: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  periode_debut: z.string().min(1),
  periode_fin: z.string().min(1),
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

interface Props {
  schedule: ScheduleItem
  onClose: () => void
}

export default function ScheduleEditForm({ schedule, onClose }: Props) {
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const { user } = useAuthStore()

  const isExam = schedule.event_type === 'examen'
  const isDevoir = schedule.event_type === 'devoir'
  const isRevision = schedule.source === 'auto_revision'
  const isProf = user?.role === 'prof'
  // Exams and teacher-assigned homework are locked for students
  const isLocked = isExam || isDevoir
  const isTimeReadOnly = isLocked && !isProf
  const canDelete = !isRevision && (!isLocked || isProf)

  const toLocal = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm")

  const { register, handleSubmit, getValues, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      titre: schedule.titre,
      description: schedule.description ?? '',
      periode_debut: toLocal(schedule.periode_debut),
      periode_fin: toLocal(schedule.periode_fin),
      couleur: schedule.couleur,
    },
  })
  const selectedColor = watch('couleur')

  const shiftHours = (hours: number) => {
    const debut = getValues('periode_debut')
    const fin = getValues('periode_fin')
    if (!debut || !fin) return
    const d = new Date(debut)
    const f = new Date(fin)
    d.setHours(d.getHours() + hours)
    f.setHours(f.getHours() + hours)
    setValue('periode_debut', format(d, "yyyy-MM-dd'T'HH:mm"), { shouldDirty: true })
    setValue('periode_fin', format(f, "yyyy-MM-dd'T'HH:mm"), { shouldDirty: true })
  }

  const onSubmit = async (data: FormData) => {
    await updateSchedule.mutateAsync({
      id: schedule.id,
      data: {
        titre: data.titre,
        description: data.description || undefined,
        periode_debut: new Date(data.periode_debut).toISOString(),
        periode_fin: new Date(data.periode_fin).toISOString(),
        couleur: data.couleur,
      },
    })
    onClose()
  }

  const handleDelete = async () => {
    await deleteSchedule.mutateAsync(schedule.id)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {isLocked && !isProf && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-medium">
          {isExam
            ? "Créneau d'examen — titre, horaires et description non modifiables"
            : 'Devoir assigné par votre professeur — titre, horaires et description non modifiables, suppression impossible'}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
        <input
          {...register('titre')}
          disabled={isTimeReadOnly}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        {errors.titre && <p className="text-red-500 text-xs mt-1">{errors.titre.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optionnelle)</span></label>
        <textarea
          {...register('description')}
          disabled={isTimeReadOnly}
          placeholder="Ex : Chapitre 3 — fonctions dérivées"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
          <input
            type="datetime-local"
            {...register('periode_debut')}
            disabled={isTimeReadOnly}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          />
          {errors.periode_debut && <p className="text-red-500 text-xs mt-1">{errors.periode_debut.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
          <input
            type="datetime-local"
            {...register('periode_fin')}
            disabled={isTimeReadOnly}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          />
          {errors.periode_fin && <p className="text-red-500 text-xs mt-1">{errors.periode_fin.message}</p>}
        </div>
      </div>

      {!isTimeReadOnly && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Décaler :</span>
          {[-2, -1, 1, 2].map(h => (
            <button
              key={h}
              type="button"
              onClick={() => shiftHours(h)}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              {h > 0 ? `+${h}h` : `${h}h`}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <label key={c.value} className="cursor-pointer">
              <input type="radio" {...register('couleur')} value={c.value} className="sr-only" />
              <span
                className="block w-6 h-6 rounded-full border-2 border-white shadow ring-2"
                style={{ backgroundColor: c.value, outline: selectedColor === c.value ? `2px solid ${c.value}` : '2px solid transparent', outlineOffset: '2px' }}
                title={c.label}
              />
            </label>
          ))}
        </div>
      </div>

      <ReminderSection scheduleId={schedule.id} />

      <div className="flex items-center justify-between pt-2">
        {canDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteSchedule.isPending}
            className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            {deleteSchedule.isPending ? 'Suppression…' : 'Supprimer'}
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || updateSchedule.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting || updateSchedule.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </form>
  )
}
