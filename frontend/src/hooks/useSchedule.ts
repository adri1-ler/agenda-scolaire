import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi, eventsApi } from '../api/schedule.api'
import { toast } from 'sonner'

export function useSchedule(start?: string, end?: string) {
  return useQuery({
    queryKey: ['schedule', start, end],
    queryFn: () => scheduleApi.list(start, end),
  })
}

export function useConflicts() {
  return useQuery({
    queryKey: ['schedule', 'conflicts'],
    queryFn: scheduleApi.conflicts,
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Créneau ajouté')
    },
    onError: () => toast.error('Erreur lors de la création'),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Créneau supprimé')
    },
  })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ titre: string; description: string; periode_debut: string; periode_fin: string; couleur: string }> }) =>
      scheduleApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Créneau mis à jour')
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })
}

export function useImportIcs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scheduleApi.importIcs,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success(`${data.length} événement(s) importé(s)`)
    },
    onError: () => toast.error('Erreur lors de l\'import'),
  })
}

export function useCreateExamen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: eventsApi.createExamen,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Examen créé et envoyé aux élèves')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Erreur'),
  })
}

export function useCreateDevoir() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: eventsApi.createDevoir,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Devoir assigné aux élèves')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Erreur'),
  })
}

export function useParties(eventId: string | null) {
  return useQuery({
    queryKey: ['parties', eventId],
    queryFn: () => eventsApi.listParties(eventId!),
    enabled: !!eventId,
  })
}

export function useCreatePartie(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { nom: string; temps_requis_heures: number; ordre?: number }) =>
      eventsApi.createPartie(eventId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parties', eventId] })
      toast.success('Partie ajoutée')
    },
  })
}

export function useUpdatePartie(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ partieId, data }: { partieId: string; data: any }) =>
      eventsApi.updatePartie(eventId, partieId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties', eventId] }),
  })
}

export function useDeletePartie(examenId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partieId: string) => eventsApi.deletePartie(examenId, partieId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parties', examenId] })
      toast.success('Partie supprimée')
    },
  })
}
