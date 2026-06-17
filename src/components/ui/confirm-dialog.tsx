import { AlertTriangle, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from './button'

type ConfirmDialogProps = {
  confirmLabel?: string
  children?: ReactNode
  description?: string
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 backdrop-blur-md">
      <div
        className="
          w-full max-w-md
          overflow-hidden
          rounded-3xl
          border border-white/20
          bg-white/60
          shadow-[0_0_30px_rgba(20,184,166,0.25),0_0_80px_rgba(20,184,166,0.15),0_20px_60px_rgba(0,0,0,0.25)]
          backdrop-blur-3xl
        ">
        <div className="relative p-6">
          <div
    className="
      absolute
      left-1/2
      top-1/2
      -z-10
      h-72
      w-72
      -translate-x-1/2
      -translate-y-1/2
      rounded-full
      bg-teal-400/30
      blur-3xl
    "
  />
          <button
            aria-label="Tutup dialog"
            title="Tutup dialog"
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            onClick={onCancel}
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div
              className={[
                'mb-5 flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur-md',
                tone === 'danger'
                  ? 'border-rose-200 bg-rose-500/15 text-rose-600'
                  : 'border-teal-200 bg-teal-500/15 text-teal-600',
              ].join(' ')}
            >
              {icon ?? <AlertTriangle size={34} />}
            </div>

            <h2 className="text-xl font-black text-slate-950">
              {title}
            </h2>

            {description ? (
              <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>

          {children ? (
            <div
              className="
                mt-5
                rounded-2xl
                border border-white/20
                bg-white/30
                p-4
                backdrop-blur-md
              "
            >
              {children}
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            <Button
              className="flex-1 rounded-2xl"
              disabled={isLoading}
              variant="secondary"
              onClick={onCancel}
            >
              Batal
            </Button>

            <Button
              className="flex-1 rounded-2xl"
              disabled={isLoading}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
