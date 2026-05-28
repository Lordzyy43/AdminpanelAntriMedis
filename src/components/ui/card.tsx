import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/5 backdrop-blur',
        className,
      )}
      {...props}
    />
  )
}
