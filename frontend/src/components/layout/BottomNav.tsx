import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const studentLinks = [
  { to: '/schedule', label: 'Planning', icon: '📅' },
  { to: '/devoirs', label: 'Devoirs', icon: '📝' },
  { to: '/revision', label: 'Révisions', icon: '📚' },
  { to: '/messaging', label: 'Messages', icon: '💬' },
  { to: '/notifications', label: 'Notifs', icon: '🔔' },
  { to: '/profile', label: 'Profil', icon: '⚙️' },
]

const profLinks = [
  { to: '/schedule', label: 'Planning', icon: '📅' },
  { to: '/classes', label: 'Classes', icon: '🏫' },
  { to: '/messaging', label: 'Messages', icon: '💬' },
  { to: '/notifications', label: 'Notifs', icon: '🔔' },
  { to: '/profile', label: 'Profil', icon: '⚙️' },
]

export default function BottomNav() {
  const { user } = useAuthStore()
  const links = user?.role === 'prof' ? profLinks : studentLinks

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-primary-950 border-t border-white/10 z-50">
      <div className="flex">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-accent-400' : 'text-white/40'
              }`
            }
          >
            <span className="text-lg leading-none">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
