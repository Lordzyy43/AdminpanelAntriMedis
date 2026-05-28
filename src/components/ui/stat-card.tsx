import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { Card } from './card'

type StatCardProps = {
  icon?: ReactNode
  label: string
  value: number | string
  helper?: string
  tone?: 'teal' | 'blue' | 'amber' | 'emerald' | 'slate'
}

const toneClass = {
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  slate: 'bg-slate-100 text-slate-600',
  teal: 'bg-teal-50 text-teal-700',
}

export function StatCard({
  helper,
  icon,
  label,
  tone = 'teal',
  value,
}: StatCardProps) {
  return (
    <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              toneClass[tone],
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
