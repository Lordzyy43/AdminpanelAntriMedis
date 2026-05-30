import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'

import {
  ToastContext,
  type Toast,
  type ToastInput,
  type ToastTone,
} from './toast-context'

const toneClassNames: Record<ToastTone, string> = {
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[70] grid w-[min(420px,calc(100vw-40px))] gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({
  onDismiss,
  toast,
}: {
  onDismiss: (id: string) => void
  toast: Toast
}) {
  const Icon =
    toast.tone === 'success'
      ? CheckCircle2
      : toast.tone === 'danger'
        ? TriangleAlert
        : Info

  return (
    <div
      className={[
        'rounded-2xl border p-4 shadow-xl shadow-slate-950/10',
        toneClassNames[toast.tone],
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0" size={19} />
        <div className="min-w-0 flex-1">
          {toast.title ? <p className="font-black">{toast.title}</p> : null}
          <p className="mt-0.5 text-sm font-semibold leading-6">
            {toast.message}
          </p>
        </div>
        <button
          className="rounded-lg p-1 opacity-70 transition hover:bg-white/50 hover:opacity-100"
          type="button"
          onClick={() => onDismiss(toast.id)}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
