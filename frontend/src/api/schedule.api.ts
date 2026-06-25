import { api } from './axios'
import type { ScheduleItem, EventItem, Partie, RevisionSlot, DevoirItem, Reminder, NotifType } from '../types/event.types'

export const scheduleApi = {
  list: (start?: string, end?: string) =>
    api.get<ScheduleItem[]>('/schedule', { params: { start, end } }).then(r => r.data),

  create: (data: { titre: string; periode_debut: string; periode_fin: string; couleur?: string }) =>
    api.post<ScheduleItem>('/schedule', data).then(r => r.data),

  update: (id: string, data: Partial<{ titre: string; periode_debut: string; periode_fin: string; couleur: string }>) =>
    api.put<ScheduleItem>(`/schedule/${id}`, data).then(r => r.data),

  delete: (id: string) => api.delete(`/schedule/${id}`),

  conflicts: () => api.get<ScheduleItem[]>('/schedule/conflicts').then(r => r.data),

  importIcs: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ScheduleItem[]>('/schedule/import-ics', form).then(r => r.data)
  },

  exportIcs: () => api.get('/schedule/export-ics', { responseType: 'blob' }).then(r => r.data),
}

export const eventsApi = {
  list: () => api.get<EventItem[]>('/events').then(r => r.data),

  createExamen: (data: {
    titre: string; description?: string; lieu?: string
    date_debut: string; date_fin: string; matiere: string; classe_id: string
  }) => api.post('/events/examens', data).then(r => r.data),

  createDevoir: (data: {
    titre: string; description?: string; date_limite: string
    matiere: string; temps_requis?: number; classe_id: string
  }) => api.post('/events/devoirs', data).then(r => r.data),

  listDevoirs: () => api.get<DevoirItem[]>('/events/devoirs').then(r => r.data),

  setStatut: (eventId: string, statut: 'planifie' | 'termine') =>
    api.put(`/events/${eventId}/statut`, { statut }).then(r => r.data),

  listParties: (eventId: string) =>
    api.get<Partie[]>(`/events/examens/${eventId}/parties`).then(r => r.data),

  createPartie: (eventId: string, data: { nom: string; temps_requis_heures: number; ordre?: number }) =>
    api.post<Partie>(`/events/examens/${eventId}/parties`, data).then(r => r.data),

  updatePartie: (eventId: string, partieId: string, data: Partial<Partie>) =>
    api.put<Partie>(`/events/examens/${eventId}/parties/${partieId}`, data).then(r => r.data),

  deletePartie: (eventId: string, partieId: string) =>
    api.delete(`/events/examens/${eventId}/parties/${partieId}`),
}

export const revisionApi = {
  generate: (examenId: string, slotDurationMinutes: number = 90, studyStartHour: number = 9, studyEndHour: number = 18) =>
    api.post<RevisionSlot[]>(`/revision/generate/${examenId}`, {
      slot_duration_minutes: slotDurationMinutes,
      study_start_hour: studyStartHour,
      study_end_hour: studyEndHour,
    }).then(r => r.data),

  list: (examenId: string) =>
    api.get<RevisionSlot[]>(`/revision/${examenId}`).then(r => r.data),

  updateSlot: (slotId: string, statut: string) =>
    api.put<RevisionSlot>(`/revision/slots/${slotId}`, { statut }).then(r => r.data),

  deleteAll: (examenId: string) => api.delete(`/revision/${examenId}`),

  importCourse: (examenId: string, file: File, totalHours: number) => {
    const form = new FormData()
    form.append('file', file)
    form.append('total_hours', String(totalHours))
    return api.post<import('../types/event.types').Partie[]>(
      `/revision/import-course/${examenId}`,
      form,
    ).then(r => r.data)
  },
}

export const remindersApi = {
  list: (scheduleId: string) =>
    api.get<Reminder[]>('/reminders', { params: { schedule_id: scheduleId } }).then(r => r.data),

  create: (scheduleId: string, minutesBefore: number, typeNotification: NotifType = 'in_app') =>
    api.post<Reminder>('/reminders', {
      schedule_id: scheduleId,
      minutes_before: minutesBefore,
      type_notification: typeNotification,
    }).then(r => r.data),

  delete: (reminderId: string) => api.delete(`/reminders/${reminderId}`),
}
