import { AlertTriangle, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from './button'

type ConfirmDialogProps = {
  confirmLabel?: string
  children?: ReactNode
  description: string
  icon?: ReactNode
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  tone?: 'default' | 'danger'
  title: string
}

export function ConfirmDialog({
  confirmLabel = 'Konfirmasi',
  children,
  description,
  icon,
  isLoading = false,
  onCancel,
  onConfirm,
  open,
  tone = 'default',
  title,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex gap-3">
            <div
              className={[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                tone === 'danger'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-teal-50 text-teal-700',
              ].join(' ')}
            >
              {icon ?? <AlertTriangle size={20} />}
            </div>
            <div>
              <h2 className="font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
              {children ? <div className="mt-4">{children}</div> : null}
            </div>
          </div>
          <button
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-2 p-4">
          <Button disabled={isLoading} variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button
            disabled={isLoading}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
