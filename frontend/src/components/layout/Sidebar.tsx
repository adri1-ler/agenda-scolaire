import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const studentLinks = [
  { to: '/schedule', label: 'Planning', icon: '📅' },
  { to: '/devoirs', label: 'Devoirs', icon: '📝' },
  { to: '/revision', label: 'Révisions', icon: '📚' },
  { to: '/messaging', label: 'Messagerie', icon: '💬' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
]

const profLinks = [
  { to: '/schedule', label: 'Planning', icon: '📅' },
  { to: '/classes', label: 'Mes classes', icon: '🏫' },
  { to: '/messaging', label: 'Messagerie', icon: '💬' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
]

export default function Sidebar() {
  const { user } = useAuthStore()
  const links = user?.role === 'prof' ? profLinks : studentLinks

  return (
    <aside className="hidden md:flex w-56 bg-primary-950 flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <span className="font-display text-xl text-white tracking-tight">AgendaScope</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-500/20 text-accent-400'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <span className="text-base">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-accent-500/20 text-accent-400' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`
          }
        >
          <span className="text-base">⚙️</span>
          Profil
        </NavLink>
      </div>
    </aside>
  )
}
