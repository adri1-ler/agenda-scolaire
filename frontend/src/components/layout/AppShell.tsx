import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import DrawerNav from './DrawerNav'
import { useCurrentUser } from '../../hooks/useAuth'

export default function AppShell() {
  useCurrentUser()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex fixed inset-0 bg-warm-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <DrawerNav open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
