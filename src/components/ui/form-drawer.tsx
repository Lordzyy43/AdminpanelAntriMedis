import { X } from 'lucide-react'
import type { ReactNode } from 'react'

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
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <button
        aria-label="Tutup drawer"
        className="hidden flex-1 cursor-default lg:block"
        type="button"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">{title}</h2>
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
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <footer className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  )
}
