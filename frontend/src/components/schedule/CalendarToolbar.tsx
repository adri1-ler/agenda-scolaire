import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Props {
  date: Date
  view: 'week' | 'month' | 'day'
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void
  onView: (view: 'week' | 'month' | 'day') => void
}

export default function CalendarToolbar({ date, view, onNavigate, onView }: Props) {
  const btnBase = 'px-2 md:px-3 py-1 text-xs md:text-sm rounded-lg transition-colors'
  const activeBtn = `${btnBase} bg-primary-600 text-white`
  const inactiveBtn = `${btnBase} border border-gray-300 hover:bg-gray-50`

  return (
    <div className="flex items-center justify-between mb-2 md:mb-4 gap-2">
      <div className="flex items-center gap-1 md:gap-2">
        <button onClick={() => onNavigate('PREV')} className="px-2 md:px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">‹</button>
        <button onClick={() => onNavigate('TODAY')} className="px-2 md:px-3 py-1 text-xs md:text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <span className="hidden md:inline">Aujourd'hui</span>
          <span className="md:hidden">Auj.</span>
        </button>
        <button onClick={() => onNavigate('NEXT')} className="px-2 md:px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">›</button>
        <span className="ml-1 md:ml-3 font-semibold text-gray-800 text-xs md:text-base">
          <span className="hidden md:inline">
            {format(date,
              view === 'day' ? "EEEE d MMMM yyyy" :
              view === 'week' ? "'Semaine du' d MMMM yyyy" :
              'MMMM yyyy',
              { locale: fr }
            )}
          </span>
          <span className="md:hidden">
            {format(date,
              view === 'day' ? 'EEE d MMM' :
              view === 'week' ? 'd MMM' :
              'MMM yyyy',
              { locale: fr }
            )}
          </span>
        </span>
      </div>

      {/* Mobile: Jour / Sem. */}
      <div className="flex md:hidden gap-1">
        {(['day', 'week'] as const).map(v => (
          <button key={v} onClick={() => onView(v)} className={view === v ? activeBtn : inactiveBtn}>
            {v === 'day' ? 'Jour' : 'Sem.'}
          </button>
        ))}
      </div>

      {/* Desktop: Semaine / Mois */}
      <div className="hidden md:flex gap-1">
        {(['week', 'month'] as const).map(v => (
          <button key={v} onClick={() => onView(v)} className={view === v ? activeBtn : inactiveBtn}>
            {v === 'week' ? 'Semaine' : 'Mois'}
          </button>
        ))}
      </div>
    </div>
  )
}
