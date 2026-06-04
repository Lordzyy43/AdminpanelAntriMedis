import { Activity, LogOut, Stethoscope } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { adminNavigation } from '../../app/navigation'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'

type AdminLayoutProps = {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200/80 bg-white/90 px-5 py-6 shadow-sm shadow-slate-900/5 backdrop-blur lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-900/15">
            <Stethoscope size={22} />
          </div>
          <div>
            <p className="text-lg font-black">AntriMedis</p>
            <p className="text-xs font-bold text-slate-500">Admin Panel</p>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {adminNavigation.map((item) => (
            <NavItem icon={item.icon} key={item.to} to={item.to}>
              {item.label}
            </NavItem>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-slate-950 p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-black">
            <Activity className="text-teal-300" size={17} />
            Pemantauan aktif
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
            Perubahan antrean otomatis tampil di aplikasi pasien dan panel admin.
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/75 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                Klinik Sehat Sentosa
              </p>
              <h1 className="text-xl font-black tracking-tight">
                Operasional Antrean
              </h1>
            </div>
            <Button variant="secondary" onClick={signOut}>
              <LogOut size={16} />
              Keluar
            </Button>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {adminNavigation.map((item) => (
              <NavItem icon={item.icon} key={item.to} to={item.to}>
                {item.label}
              </NavItem>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
      </div>
    </div>
  )
}

type NavItemProps = {
  icon: ReactNode
  to: string
  children: ReactNode
}

function NavItem({ icon, to, children }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black transition',
          isActive
            ? 'bg-teal-600 text-white shadow-sm shadow-teal-900/15'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
        ].join(' ')
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}
