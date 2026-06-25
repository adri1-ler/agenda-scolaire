export type EventType = 'examen' | 'devoir' | 'autre'
export type EventStatut = 'planifie' | 'en_cours' | 'termine' | 'annule'
export type PartieStatut = 'a_reviser' | 'en_cours' | 'revise'
export type RevisionSlotStatut = 'planifie' | 'fait' | 'saute'

export interface ScheduleItem {
  id: string
  titre: string
  description?: string | null
  periode_debut: string
  periode_fin: string
  source: 'manual' | 'ics_import' | 'auto_revision'
  couleur: string
  is_private: boolean
  event_type?: EventType
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: ScheduleItem
}

export interface EventItem {
  id: string
  titre: string
  description?: string
  lieu?: string
  statut: EventStatut
  event_type: EventType
  schedule_id: string
  created_at: string
}

export interface Partie {
  id: string
  nom: string
  description?: string | null
  temps_requis_heures: number
  statut: PartieStatut
  ordre: number
}

export interface RevisionSlot {
  id: string
  debut: string
  fin: string
  statut: RevisionSlotStatut
  duree_minutes: number
  partie_id: string
}

export interface DevoirItem {
  event_id: string
  schedule_id: string
  titre: string
  description?: string | null
  matiere: string
  date_limite: string
  temps_requis: number
  statut: EventStatut
}

export type NotifType = 'in_app' | 'email' | 'both'

export interface Reminder {
  id: string
  schedule_id: string | null
  event_id: string | null
  type_notification: NotifType
  trigger_at: string
  sent: boolean
}
