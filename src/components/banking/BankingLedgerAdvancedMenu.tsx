import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * The Ledger tab's "Advanced" dropdown (Refresh / Backfill / Import CSV /
 * Manual accounts / Reload); role-gated items via optional-prop presence.
 * Verbatim module move out of Banking.tsx (in-file component moves; see
 * BANKING_TABS_ARCHITECTURE.md).
 */
type BankingLedgerAdvancedMenuProps = {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  syncing: boolean
  loading: boolean
  onRefreshFromMercury: () => void
  onReloadTable: () => void
  /** Dev-only; when undefined, the Backfill menu item is hidden. */
  onBackfillFromMercury?: () => void
  /** Dev / master-tech only; when undefined, the Import CSV menu item is hidden. */
  onImportCsv?: () => void
  /** Dev / master-tech only; when undefined, the Manual accounts menu item is hidden. */
  onManageManualAccounts?: () => void
}

export function BankingLedgerAdvancedMenu({
  menuOpen,
  onMenuOpenChange,
  syncing,
  loading,
  onRefreshFromMercury,
  onReloadTable,
  onBackfillFromMercury,
  onImportCsv,
  onManageManualAccounts,
}: BankingLedgerAdvancedMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onMenuOpenChange(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onMenuOpenChange(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, onMenuOpenChange])

  const menuId = 'banking-ledger-advanced-menu'
  const itemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-strong)',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => onMenuOpenChange(!menuOpen)}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 4,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        Advanced <span aria-hidden>▾</span>
      </button>
      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Advanced Mercury actions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: '14rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
            zIndex: 40,
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={syncing}
            onClick={() => {
              onMenuOpenChange(false)
              onRefreshFromMercury()
            }}
            style={{
              ...itemStyle,
              background: syncing ? 'var(--bg-muted)' : '#2563eb',
              color: syncing ? 'var(--text-faint)' : 'white',
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? 'Syncing from Mercury…' : 'Refresh from Mercury'}
          </button>
          {onBackfillFromMercury ? (
            <button
              type="button"
              role="menuitem"
              disabled={syncing}
              onClick={() => {
                onMenuOpenChange(false)
                onBackfillFromMercury()
              }}
              style={{
                ...itemStyle,
                cursor: syncing ? 'not-allowed' : 'pointer',
                opacity: syncing ? 0.7 : 1,
              }}
            >
              Backfill from Mercury…
            </button>
          ) : null}
          {onImportCsv ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMenuOpenChange(false)
                onImportCsv()
              }}
              style={itemStyle}
            >
              Import transactions (CSV)…
            </button>
          ) : null}
          {onManageManualAccounts ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMenuOpenChange(false)
                onManageManualAccounts()
              }}
              style={itemStyle}
            >
              Manual accounts…
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={loading}
            onClick={() => {
              onMenuOpenChange(false)
              onReloadTable()
            }}
            style={{
              ...itemStyle,
              borderBottom: 'none',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            Reload table
          </button>
        </div>
      ) : null}
    </div>
  )
}
