/** App-level Active Accounts management modal (dev-only entry points, e.g. the
 * People → Users "Manage accounts" button). Renders ActiveAccountsPanel — the same
 * component Settings → People & accounts shows inline — inside a modal shell.
 * Pattern mirrors JobDetailModalContext; shell conventions mirror UserReviewModal. */
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const ActiveAccountsPanel = lazy(() => import('../components/settings/ActiveAccountsPanel'))

const MODAL_Z = 1200
const TITLE_ID = 'active-accounts-modal-title'

export type OpenActiveAccountsOptions = {
  /** Called after any successful mutation so the host page can refresh its own lists. */
  onDataChanged?: () => void
}

export type ActiveAccountsModalContextValue = {
  openActiveAccounts: (options?: OpenActiveAccountsOptions) => void
  closeActiveAccounts: () => void
  isOpen: boolean
}

const ActiveAccountsModalContext = createContext<ActiveAccountsModalContextValue | null>(null)

type OpenState =
  | { kind: 'closed' }
  | { kind: 'open'; instanceKey: number; onDataChanged?: () => void }

let activeAccountsModalInstanceSeed = 0

function ActiveAccountsModalShell({ onClose, onDataChanged }: { onClose: () => void; onDataChanged?: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 'min(100%, 56rem)',
          width: '100%',
          maxHeight: 'min(90vh, 800px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <h2 id={TITLE_ID} style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: '#111827' }}>
            Active Accounts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280', padding: '0.25rem' }}
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 0.25rem' }}>
          <Suspense fallback={<p style={{ padding: '1.5rem', color: '#6b7280' }}>Loading…</p>}>
            <ActiveAccountsPanel variant="modal" onDataChanged={onDataChanged} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export function ActiveAccountsModalProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState<OpenState>({ kind: 'closed' })

  const closeActiveAccounts = useCallback(() => {
    setOpenState({ kind: 'closed' })
  }, [])

  const openActiveAccounts = useCallback((options?: OpenActiveAccountsOptions) => {
    activeAccountsModalInstanceSeed += 1
    setOpenState({ kind: 'open', instanceKey: activeAccountsModalInstanceSeed, onDataChanged: options?.onDataChanged })
  }, [])

  const value = useMemo(
    (): ActiveAccountsModalContextValue => ({
      openActiveAccounts,
      closeActiveAccounts,
      isOpen: openState.kind === 'open',
    }),
    [openActiveAccounts, closeActiveAccounts, openState.kind],
  )

  return (
    <ActiveAccountsModalContext.Provider value={value}>
      {children}
      {openState.kind === 'open' ? (
        <ActiveAccountsModalShell
          key={openState.instanceKey}
          onClose={closeActiveAccounts}
          onDataChanged={openState.onDataChanged}
        />
      ) : null}
    </ActiveAccountsModalContext.Provider>
  )
}

export function useActiveAccountsModal(): ActiveAccountsModalContextValue | null {
  return useContext(ActiveAccountsModalContext)
}
