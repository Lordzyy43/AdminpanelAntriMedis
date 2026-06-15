import {
  Activity,
  CalendarDays,
  Building2,
  LayoutDashboard,
  Monitor,
  Stethoscope,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type NavigationItem = {
  icon: ReactNode
  label: string
  newTab?: boolean
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
    icon: <Monitor size={18} />,
    label: 'Display',
    newTab: true,
    to: '/queue-display',
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
