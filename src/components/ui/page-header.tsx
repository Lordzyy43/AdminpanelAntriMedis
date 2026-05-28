import type { ReactNode } from 'react'

type PageHeaderProps = {
  actions?: ReactNode
  eyebrow: string
  title: string
  description: string
}

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm shadow-slate-900/5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-teal-700">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
