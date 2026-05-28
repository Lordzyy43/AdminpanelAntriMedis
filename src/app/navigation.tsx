import {
  Activity,
  CalendarDays,
  Building2,
  LayoutDashboard,
  Stethoscope,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type NavigationItem = {
  icon: ReactNode
  label: string
  to: string
}

export const adminNavigation: NavigationItem[] = [
  {
    icon: <LayoutDashboard size={18} />,
    label: 'Dashboard',
    to: '/dashboard',
  },
  {
    icon: <Activity size={18} />,
    label: 'Antrean',
    to: '/queues',
  },
  {
    icon: <CalendarDays size={18} />,
    label: 'Jadwal',
    to: '/schedules',
  },
  {
    icon: <Stethoscope size={18} />,
    label: 'Dokter',
    to: '/doctors',
  },
  {
    icon: <Building2 size={18} />,
    label: 'Poli',
    to: '/polyclinics',
  },
]
