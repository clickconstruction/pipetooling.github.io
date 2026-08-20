import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * In-app replacement for window.confirm (owner request 2026-08-19: "all
 * confirmation notices should be modals" — the browser-native dialog is
 * unstyled, unthemed, and says "pipetooling.com says").
 *
 *   const confirmDialog = useConfirmDialog()
 *   if (!(await confirmDialog({ message: 'Delete this draft?' }))) return
 *
 * Promise-based: resolves true on confirm, false on cancel / Escape /
 * backdrop click. Renders above modal z-indexes so it works from inside
 * other dialogs. One dialog at a time; a second request while one is open
 * auto-cancels the first (matching how stacked window.confirm never
 * happened in practice).
 */

export type ConfirmDialogOptions = {
  message: string
  /** Optional heading above the message. */
  title?: string
  /** Confirm button label (default "OK"). */
  confirmLabel?: string
  /** Cancel button label (default "Cancel"). */
  cancelLabel?: string
  /** Red confirm button for destructive actions. */
  danger?: boolean
}

type ConfirmFn = (options: ConfirmDialogOptions) => Promise<boolean>

const ConfirmDialogContext = createContext<ConfirmFn | null>(null)

export function useConfirmDialog(): ConfirmFn {
  const fn = useContext(ConfirmDialogContext)
  if (!fn) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  return fn
}

type PendingDialog = {
  options: ConfirmDialogOptions
  resolve: (value: boolean) => void
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null)
  const pendingRef = useRef<PendingDialog | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // A second request while one is open cancels the first.
      pendingRef.current?.resolve(false)
      const next = { options, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  const settle = useCallback((value: boolean) => {
    pendingRef.current?.resolve(value)
    pendingRef.current = null
    setPending(null)
  }, [])

  useEffect(() => {
    if (!pending) return
    confirmButtonRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        settle(false)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [pending, settle])

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {pending ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) settle(false)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.options.title ?? pending.options.message}
            style={{
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              maxWidth: 420,
              width: '100%',
              padding: '1.1rem 1.25rem 1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 16px 48px rgba(0,0,0,0.18)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {pending.options.title ? (
              <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 600 }}>{pending.options.title}</h2>
            ) : null}
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {pending.options.message}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
              <button
                type="button"
                onClick={() => settle(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  color: 'var(--text-700)',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {pending.options.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => settle(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: pending.options.danger ? '#dc2626' : '#3b82f6',
                  border: 'none',
                  borderRadius: 6,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {pending.options.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  )
}
