import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type FeedbackBannerProps = {
  children: ReactNode
  title?: string
  tone?: 'danger' | 'info' | 'success' | 'warning'
}

const toneClassNames = {
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

export function FeedbackBanner({
  children,
  title,
  tone = 'info',
}: FeedbackBannerProps) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'danger'
        ? AlertCircle
        : tone === 'warning'
          ? TriangleAlert
          : Info

  return (
    <div
      className={[
        'rounded-xl border px-4 py-3 text-sm shadow-sm shadow-slate-900/5',
        toneClassNames[tone],
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0" size={18} />
        <div>
          {title ? <p className="font-black">{title}</p> : null}
          <div className={title ? 'mt-1 font-semibold leading-6' : 'font-bold leading-6'}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
