import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useQueryClient } from '@tanstack/react-query'
import Avatar from '../ui/Avatar'

const studentLinks = [
  { to: '/schedule', label: 'Planning', icon: '📅' },
  { to: '/devoirs', label: 'Devoirs', icon: '📝' },
  { to: '/revision', label: 'Révisions', icon: '📚' },
  { to: '/messaging', label: 'Messagerie', icon: '💬' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/profile', label: 'Profil', icon: '⚙️' },
]

const profLinks = [
  { to: '/schedule', label: 'Planning', icon: '📅' },
  { to: '/classes', label: 'Mes classes', icon: '🏫' },
  { to: '/messaging', label: 'Messagerie', icon: '💬' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/profile', label: 'Profil', icon: '⚙️' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function DrawerNav({ open, onClose }: Props) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const links = user?.role === 'prof' ? profLinks : studentLinks

  const handleLogout = () => {
    logout()
    queryClient.clear()
    navigate('/login')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-primary-950 z-50 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="font-display text-xl text-white tracking-tight">AgendaScope</span>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* User info */}
        {user && (
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3">
            <Avatar photoUrl={user.photo_url} prenom={user.prenom} nom={user.nom} size={40} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.prenom} {user.nom}</p>
              <p className="text-xs text-white/50 mt-0.5">
                {user.role === 'prof' ? 'Professeur' : 'Élève'}
              </p>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-500/20 text-accent-400'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-white/10 transition-colors"
          >
            <span className="text-lg">🚪</span>
            Déconnexion
          </button>
        </div>
      </div>
    </>
  )
}
