import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * "Nicknames" dropdown (Account nicknames / Debit cards) rendered in
 * the User Sort header tools and the Ledger toolbar. Verbatim module move out
 * of Banking.tsx (in-file component moves; see BANKING_TABS_ARCHITECTURE.md).
 */
type BankingNicknamesMenuProps = {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  showAccount: boolean
  showDebit: boolean
  onOpenAccount: () => void
  onOpenDebit: () => void
}

export function BankingNicknamesMenu({
  menuOpen,
  onMenuOpenChange,
  showAccount,
  showDebit,
  onOpenAccount,
  onOpenDebit,
}: BankingNicknamesMenuProps) {
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

  if (!showAccount && !showDebit) return null

  const menuId = 'banking-nicknames-menu'
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
        }}
      >
        Nicknames <span aria-hidden>▾</span>
      </button>
      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: '12.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
            zIndex: 40,
            overflow: 'hidden',
          }}
        >
          {showAccount ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMenuOpenChange(false)
                onOpenAccount()
              }}
              style={{ ...itemStyle, borderBottom: showDebit ? itemStyle.borderBottom : 'none' }}
            >
              Account nicknames
            </button>
          ) : null}
          {showDebit ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMenuOpenChange(false)
                onOpenDebit()
              }}
              style={{ ...itemStyle, borderBottom: 'none' }}
            >
              Debit cards
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
