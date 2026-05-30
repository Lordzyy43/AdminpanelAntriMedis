import { createContext } from 'react'

export type ToastTone = 'danger' | 'info' | 'success' | 'warning'

export type Toast = {
  id: string
  message: string
  title?: string
  tone: ToastTone
}

export type ToastInput = Omit<Toast, 'id'>

export type ToastContextValue = {
  notify: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
