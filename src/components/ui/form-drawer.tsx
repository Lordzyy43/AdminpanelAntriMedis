import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId } from 'react'

type FormDrawerProps = {
  children: ReactNode
  description?: string
  footer?: ReactNode
  onClose: () => void
  open: boolean
  title: string
}

export function FormDrawer({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: FormDrawerProps) {
  const titleId = useId()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-3 py-5 backdrop-blur-sm sm:px-6">
      <button
        aria-label="Tutup form"
        className="absolute inset-0 cursor-default"
        type="button"
        onClick={onClose}
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative flex max-h-[calc(100vh-2.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25 ring-1 ring-slate-950/5"
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2
              className="text-lg font-black text-slate-950 sm:text-xl"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
        {footer ? (
          <footer className="border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  )
}
