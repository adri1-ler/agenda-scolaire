import type { Channel } from '../../types/messaging.types'

const TYPE_ICONS: Record<string, string> = {
  direct: '👤',
  groupe_classe: '🏫',
  matiere: '📖',
}

const TYPE_LABELS: Record<string, string> = {
  direct: 'Direct',
  groupe_classe: 'Classe',
  matiere: 'Matière',
}

interface Props {
  channels: Channel[]
  selected: string | null
  onSelect: (id: string) => void
}

export default function ChannelList({ channels, selected, onSelect }: Props) {
  const grouped = {
    direct: channels.filter(c => c.type === 'direct'),
    groupe_classe: channels.filter(c => c.type === 'groupe_classe'),
    matiere: channels.filter(c => c.type === 'matiere'),
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      {(Object.entries(grouped) as [string, Channel[]][]).map(([type, items]) => {
        if (!items.length) return null
        return (
          <div key={type} className="py-2">
            <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {TYPE_LABELS[type]}
            </p>
            {items.map(ch => (
              <button
                key={ch.id}
                onClick={() => onSelect(ch.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  selected === ch.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{TYPE_ICONS[ch.type]}</span>
                <span className="flex-1 text-sm truncate text-gray-700">
                  {ch.nom || 'Conversation directe'}
                </span>
                {ch.unread_count > 0 && (
                  <span className="bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {ch.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
