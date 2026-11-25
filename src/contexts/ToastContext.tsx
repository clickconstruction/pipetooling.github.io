import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Toast, type ToastAction, type ToastAnchor, type ToastPlacement } from '../components/Toast'
import { errorLineOffersNote, troubleMemory } from '../lib/tellTheDev/trouble'
import { isTellTheDevListening, requestTellTheDev } from '../lib/tellTheDev/openBox'

/** An error line with the press stays long enough to press it. */
const ERROR_LINE_WITH_PRESS_MS = 9000

/**
 * Tell the dev (punch list #380): the press an error line carries, or none. Never for a line that
 * only says the signal dropped (the outbox keeps that press and sends it later), never offline,
 * and only while a box is there to answer.
 */
function errorLinePress(message: string): ToastAction | undefined {
  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  if (!errorLineOffersNote({ words: message, online, fixMode: isTellTheDevListening() })) return undefined
  return { label: 'Tell the dev', onClick: () => requestTellTheDev({ door: 'error_line', kind: 'broken' }) }
}

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
   * `key` names what the toast is about (one bid, one report): a newer toast with the same key takes the
   * older one's place, so a thing put away and brought back within the window shows one Undo, not two (v2.8603).
   */
  showActionToast: (message: string, action: ToastAction, opts?: { type?: ToastType; durationMs?: number; key?: string }) => void
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
      key?: string
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
      // Tell the dev (punch list #380): the last error lines shown ride on a note, in this tab's memory alone.
      if (type === 'error') troubleMemory.noteErrorLine(message)
      const action = type === 'error' ? errorLinePress(message) : undefined
      setToasts((prev) => [...prev, { id, message, type, durationMs: action ? Math.max(durationMs ?? 0, ERROR_LINE_WITH_PRESS_MS) : durationMs, anchor, placement, action }])
    },
    [],
  )

  const showActionToast = useCallback(
    (message: string, action: ToastAction, opts?: { type?: ToastType; durationMs?: number; key?: string }) => {
      const id = Date.now()
      const key = opts?.key
      setToasts((prev) => [...prev.filter((t) => key == null || t.key !== key), { id, message, type: opts?.type ?? 'success', durationMs: opts?.durationMs ?? 10000, action, placement: 'corner', key }])
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

/** The toasts, or null outside a ToastProvider: for a piece that should stay silent in a render smoke rather than throw. */
export function useOptionalToastContext(): ToastContextValue | null {
  return useContext(ToastContext)
}
