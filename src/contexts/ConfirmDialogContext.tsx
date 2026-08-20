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
 *
 * window.prompt gets the same treatment via usePromptDialog():
 *
 *   const promptDialog = usePromptDialog()
 *   const name = await promptDialog({ message: 'Name for the new roadmap?' })
 *   if (name === null) return  // cancelled — same contract as window.prompt
 *
 * Resolves the entered string on confirm (Enter submits), null on cancel.
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

export type PromptDialogOptions = {
  message: string
  /** Optional heading above the message. */
  title?: string
  /** Confirm button label (default "OK"). */
  confirmLabel?: string
  /** Cancel button label (default "Cancel"). */
  cancelLabel?: string
  /** Pre-filled input value (window.prompt's second argument). */
  defaultValue?: string
  placeholder?: string
}

type ConfirmFn = (options: ConfirmDialogOptions) => Promise<boolean>
type PromptFn = (options: PromptDialogOptions) => Promise<string | null>

const ConfirmDialogContext = createContext<ConfirmFn | null>(null)
const PromptDialogContext = createContext<PromptFn | null>(null)

export function useConfirmDialog(): ConfirmFn {
  const fn = useContext(ConfirmDialogContext)
  if (!fn) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  return fn
}

export function usePromptDialog(): PromptFn {
  const fn = useContext(PromptDialogContext)
  if (!fn) throw new Error('usePromptDialog must be used within ConfirmDialogProvider')
  return fn
}

type PendingDialog =
  | { kind: 'confirm'; options: ConfirmDialogOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptDialogOptions; resolve: (value: string | null) => void }

function cancelValue(pending: PendingDialog): void {
  if (pending.kind === 'confirm') pending.resolve(false)
  else pending.resolve(null)
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null)
  const pendingRef = useRef<PendingDialog | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // A second request while one is open cancels the first.
      if (pendingRef.current) cancelValue(pendingRef.current)
      const next: PendingDialog = { kind: 'confirm', options, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  const prompt = useCallback<PromptFn>((options) => {
    return new Promise<string | null>((resolve) => {
      if (pendingRef.current) cancelValue(pendingRef.current)
      const next: PendingDialog = { kind: 'prompt', options, resolve }
      pendingRef.current = next
      setPending(next)
      setInputValue(options.defaultValue ?? '')
    })
  }, [])

  const settleCancel = useCallback(() => {
    if (pendingRef.current) cancelValue(pendingRef.current)
    pendingRef.current = null
    setPending(null)
  }, [])

  const settleConfirm = useCallback(() => {
    const current = pendingRef.current
    if (current) {
      if (current.kind === 'confirm') current.resolve(true)
      else current.resolve(inputRef.current?.value ?? '')
    }
    pendingRef.current = null
    setPending(null)
  }, [])

  useEffect(() => {
    if (!pending) return
    if (pending.kind === 'prompt') inputRef.current?.focus()
    else confirmButtonRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        settleCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [pending, settleCancel])

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      <PromptDialogContext.Provider value={prompt}>
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
              if (e.target === e.currentTarget) settleCancel()
            }}
          >
            <div
              role={pending.kind === 'prompt' ? 'dialog' : 'alertdialog'}
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
              {pending.kind === 'prompt' ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      settleConfirm()
                    }
                  }}
                  placeholder={pending.options.placeholder}
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem 0.65rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    color: 'var(--text-strong)',
                    fontSize: '0.95rem',
                  }}
                />
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
                <button
                  type="button"
                  onClick={settleCancel}
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
                  onClick={settleConfirm}
                  style={{
                    padding: '0.5rem 1rem',
                    background: pending.kind === 'confirm' && pending.options.danger ? '#dc2626' : '#3b82f6',
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
      </PromptDialogContext.Provider>
    </ConfirmDialogContext.Provider>
  )
}
