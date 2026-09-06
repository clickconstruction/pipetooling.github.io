import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Toast, type ToastAction, type ToastAnchor, type ToastPlacement } from '../components/Toast'

type ToastType = 'info' | 'warning' | 'error' | 'success'

type ToastContextValue = {
  showToast: (
    message: string,
    type?: ToastType,
    durationMs?: number,
    anchor?: ToastAnchor,
    placement?: ToastPlacement,
  ) => void
  /**
   * A toast with one inline action (Tier-2 #42): "Imported 12 rows · Undo".
   * `durationMs` is the undo window — the action disappears with the toast.
   */
  showActionToast: (message: string, action: ToastAction, opts?: { type?: ToastType; durationMs?: number }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<
    Array<{
      id: number
      message: string
      type: ToastType
      durationMs?: number
      anchor?: ToastAnchor
      placement?: ToastPlacement
      action?: ToastAction
    }>
  >([])

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      durationMs?: number,
      anchor?: ToastAnchor,
      placement: ToastPlacement = 'corner',
    ) => {
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message, type, durationMs, anchor, placement }])
    },
    [],
  )

  const showActionToast = useCallback(
    (message: string, action: ToastAction, opts?: { type?: ToastType; durationMs?: number }) => {
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message, type: opts?.type ?? 'success', durationMs: opts?.durationMs ?? 10000, action, placement: 'corner' }])
    },
    [],
  )

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const contextValue = useMemo(() => ({ showToast, showActionToast }), [showToast, showActionToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.durationMs}
          anchor={toast.anchor}
          placement={toast.placement ?? 'corner'}
          action={toast.action}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider')
  return ctx
}
