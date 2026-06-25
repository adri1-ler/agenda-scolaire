import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useQueryClient } from '@tanstack/react-query'
import NotificationBell from '../notifications/NotificationBell'
import Avatar from '../ui/Avatar'

interface Props {
  onMenuClick?: () => void
}

export default function TopBar({ onMenuClick }: Props) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleLogout = () => {
    logout()
    queryClient.clear()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
      {/* Left: hamburger on mobile, empty on desktop */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden flex flex-col gap-1.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Menu"
        >
          <span className="block w-5 h-0.5 bg-gray-600 rounded" />
          <span className="block w-5 h-0.5 bg-gray-600 rounded" />
          <span className="block w-5 h-0.5 bg-gray-600 rounded" />
        </button>
        <span className="md:hidden font-display text-lg text-primary-950">AgendaScope</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-2 md:gap-3">
        <NotificationBell />
        {user && (
          <div className="hidden md:flex items-center gap-2">
            <Avatar photoUrl={user.photo_url} prenom={user.prenom} nom={user.nom} size={32} />
            <span className="text-sm text-gray-600">
              {user.prenom} {user.nom}
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {user.role === 'prof' ? 'Professeur' : 'Élève'}
              </span>
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="hidden md:block text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </header>
  )
}
