import { useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { useSchedule, useConflicts, useUpdateSchedule } from '../../hooks/useSchedule'
import { useAuthStore } from '../../store/authStore'
import CalendarToolbar from '../../components/schedule/CalendarToolbar'
import IcsDropzone from '../../components/schedule/IcsDropzone'
import ExamenForm from '../../components/events/ExamenForm'
import DevoirForm from '../../components/events/DevoirForm'
import ScheduleForm from '../../components/events/ScheduleForm'
import ScheduleEditForm from '../../components/events/ScheduleEditForm'
import type { ScheduleItem, CalendarEvent } from '../../types/event.types'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
})

// Wrap Calendar with drag-and-drop support
const DnDCalendar = withDragAndDrop(Calendar as any) as any

// Custom event renderer: bold title + optional description + small time
function EventContent({ event }: { event: CalendarEvent }) {
  const start = format(event.start, 'HH:mm')
  const end = format(event.end, 'HH:mm')
  const description = event.resource.description
  return (
    <div style={{ lineHeight: 1.2, overflow: 'hidden', height: '100%' }}>
      <div style={{ fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {event.title as string}
      </div>
      <div style={{ fontWeight: 400, fontSize: '9.5px', opacity: 0.75, marginTop: '1px' }}>
        {start} – {end}
      </div>
      {description && (
        <div style={{ fontWeight: 400, fontSize: '10px', opacity: 0.9, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {description}
        </div>
      )}
    </div>
  )
}

type ModalType = 'examen' | 'devoir' | 'event' | 'ics' | null

export default function SchedulePage() {
  const { user } = useAuthStore()
  const [view, setView] = useState<'week' | 'month' | 'day'>(() =>
    window.innerWidth < 768 ? 'day' : 'week'
  )
  const [date, setDate] = useState(new Date())
  const [modal, setModal] = useState<ModalType>(null)
  const [editingEvent, setEditingEvent] = useState<ScheduleItem | null>(null)

  const startParam = (
    view === 'day' ? subDays(date, 1) :
    view === 'week' ? subWeeks(date, 1) :
    subMonths(date, 1)
  ).toISOString()
  const endParam = (
    view === 'day' ? addDays(date, 1) :
    view === 'week' ? addWeeks(date, 1) :
    addMonths(date, 1)
  ).toISOString()

  const { data: schedules = [] } = useSchedule(startParam, endParam)
  const { data: conflicts = [] } = useConflicts()
  const updateSchedule = useUpdateSchedule()

  const conflictIds = new Set(conflicts.map(c => c.id))

  const calendarEvents: CalendarEvent[] = schedules.map((s: ScheduleItem) => ({
    id: s.id,
    title: s.titre,
    start: new Date(s.periode_debut),
    end: new Date(s.periode_fin),
    resource: s,
  }))

  const navigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') { setDate(new Date()); return }
    if (view === 'day') setDate(action === 'PREV' ? subDays(date, 1) : addDays(date, 1))
    else if (view === 'week') setDate(action === 'PREV' ? subWeeks(date, 1) : addWeeks(date, 1))
    else setDate(action === 'PREV' ? subMonths(date, 1) : addMonths(date, 1))
  }

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const color = event.resource.couleur
    const isConflict = conflictIds.has(event.id)
    const isExam = event.resource.event_type === 'examen'
    const isDevoir = event.resource.event_type === 'devoir'
    const isRevision = event.resource.source === 'auto_revision'

    let backgroundImage = 'none'
    if (isExam) {
      backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)'
    } else if (isRevision) {
      backgroundImage = 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.25) 4px, rgba(255,255,255,0.25) 8px)'
    } else if (isDevoir) {
      // Dotted motif so homework deadlines stand out on the calendar
      backgroundImage = 'radial-gradient(rgba(255,255,255,0.45) 1.5px, transparent 1.5px)'
    }

    let border = 'none'
    if (isConflict) border = '2px solid #B91C1C'
    else if (isExam) border = '2px solid #991B1B'
    else if (isDevoir) border = '2px dashed #B45309'
    else if (isRevision) border = '2px solid #059669'

    return {
      style: {
        backgroundColor: color,
        backgroundImage,
        backgroundSize: isDevoir ? '8px 8px' : undefined,
        color: '#FFFFFF',
        border,
        borderRadius: '6px',
        padding: '2px 5px',
        cursor: isRevision ? 'grab' : 'pointer',
      },
    }
  }, [conflictIds])

  const handleIcsSuccess = (firstDate: Date) => {
    setDate(firstDate)
    setModal(null)
  }

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event.resource)
  }, [])

  // Only revision slots are draggable
  const draggableAccessor = useCallback((event: CalendarEvent) => {
    return event.resource.source === 'auto_revision'
  }, [])

  const handleEventDrop = useCallback(({ event, start, end }: any) => {
    const ev = event as CalendarEvent
    if (ev.resource.source !== 'auto_revision') return
    updateSchedule.mutate({
      id: ev.id,
      data: {
        periode_debut: new Date(start).toISOString(),
        periode_fin: new Date(end).toISOString(),
      },
    })
  }, [updateSchedule])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl md:text-3xl text-primary-950 tracking-tight shrink-0">Mon planning</h1>
        <div className="flex flex-wrap gap-1.5 md:gap-2 justify-end">
          <button onClick={() => setModal('ics')} className="hidden md:block px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Importer .ics
          </button>
          <button onClick={() => setModal('event')} className="px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            + Créneau
          </button>
          {user?.role === 'prof' && (
            <>
              <button onClick={() => setModal('examen')} className="px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                + Examen
              </button>
              <button onClick={() => setModal('devoir')} className="px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">
                + Devoir
              </button>
            </>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          ⚠ {conflicts.length} créneau(x) en conflit détecté(s) dans votre planning.
        </div>
      )}

      <CalendarToolbar date={date} view={view} onNavigate={navigate} onView={setView} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 md:p-4 h-[420px] md:h-[600px]">
        <DnDCalendar
          localizer={localizer}
          events={calendarEvents}
          view={view}
          date={date}
          onNavigate={setDate}
          onView={(v: string) => setView(v as 'week' | 'month' | 'day')}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          components={{ event: EventContent as any }}
          draggableAccessor={draggableAccessor}
          onEventDrop={handleEventDrop}
          resizable={false}
          min={new Date(1970, 0, 1, 5, 0, 0)}
          max={new Date(1970, 0, 1, 22, 0, 0)}
          toolbar={false}
          culture="fr"
          messages={{
            noEventsInRange: 'Aucun événement sur cette période',
            allDay: 'Journée',
            week: 'Semaine',
            month: 'Mois',
            today: "Aujourd'hui",
          }}
        />
      </div>

      {editingEvent && (
        <Modal title="Modifier le créneau" onClose={() => setEditingEvent(null)}>
          <ScheduleEditForm schedule={editingEvent} onClose={() => setEditingEvent(null)} />
        </Modal>
      )}

      {modal === 'event' && (
        <Modal title="Nouveau créneau" onClose={() => setModal(null)}>
          <ScheduleForm onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'ics' && (
        <Modal title="Importer un fichier .ics" onClose={() => setModal(null)}>
          <IcsDropzone onSuccess={handleIcsSuccess} />
        </Modal>
      )}
      {modal === 'examen' && (
        <Modal title="Créer un examen" onClose={() => setModal(null)}>
          <ExamenForm onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'devoir' && (
        <Modal title="Assigner un devoir" onClose={() => setModal(null)}>
          <DevoirForm onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
