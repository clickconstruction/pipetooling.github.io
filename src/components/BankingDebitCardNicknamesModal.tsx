import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { formatMercuryDebitCardIdCompact } from '../lib/mercuryRawDebitCard'

export type BankingDebitCardNicknamesModalProps = {
  open: boolean
  onClose: () => void
  debitCardIds: string[]
  nicknameByDebitCard: Record<string, string>
  nicknameDrafts: Record<string, string>
  setNicknameDrafts: Dispatch<SetStateAction<Record<string, string>>>
  savingNicknameId: string | null
  onSave: (mercuryDebitCardId: string) => void
  onClear: (mercuryDebitCardId: string) => void
  onOpenRecentTransactions?: (mercuryDebitCardId: string) => void
  /** When true, Escape should close the stacked recent-tx preview first, not this modal. */
  recentPreviewOpen?: boolean
}

export function BankingDebitCardNicknamesModal({
  open,
  onClose,
  debitCardIds,
  nicknameByDebitCard,
  nicknameDrafts,
  setNicknameDrafts,
  savingNicknameId,
  onSave,
  onClear,
  onOpenRecentTransactions,
  recentPreviewOpen = false,
}: BankingDebitCardNicknamesModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recentPreviewOpen) return
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, recentPreviewOpen])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banking-debit-card-nicknames-modal-title"
        aria-describedby="banking-debit-card-nicknames-modal-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          width: 'min(640px, calc(100vw - 2rem))',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}
        >
          <h2 id="banking-debit-card-nicknames-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Debit card nicknames
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <p id="banking-debit-card-nicknames-modal-desc" style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          Labels for Mercury <code>raw.details.debitCardInfo.id</code> (or top-level <code>raw.debitCardInfo.id</code>), shared for all devs. Save with
          empty text to remove a label, or use Clear.
        </p>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {debitCardIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              No debit card IDs yet — sync transactions that include debit card info, then Reload table.
            </p>
          ) : (
            debitCardIds.map((id) => (
              <div
                key={id}
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}
              >
                <button
                  type="button"
                  title={id}
                  aria-label="View recent transactions for this card"
                  disabled={!onOpenRecentTransactions}
                  onClick={() => onOpenRecentTransactions?.(id)}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    flex: '0 0 auto',
                    minWidth: '6.5rem',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: onOpenRecentTransactions ? '#1d4ed8' : 'inherit',
                    cursor: onOpenRecentTransactions ? 'pointer' : 'default',
                    textDecoration: onOpenRecentTransactions ? 'underline' : 'none',
                    textAlign: 'left',
                  }}
                >
                  {formatMercuryDebitCardIdCompact(id)}
                </button>
                <input
                  value={nicknameDrafts[id] ?? nicknameByDebitCard[id] ?? ''}
                  onChange={(e) => setNicknameDrafts((d) => ({ ...d, [id]: e.target.value }))}
                  placeholder="Nickname"
                  maxLength={120}
                  style={{ flex: '1 1 12rem', minWidth: 140, padding: '4px 8px', fontSize: '0.875rem' }}
                />
                <button
                  type="button"
                  disabled={savingNicknameId === id}
                  onClick={() => onSave(id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.8125rem',
                    borderRadius: 4,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: savingNicknameId === id ? 'wait' : 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={savingNicknameId === id || !nicknameByDebitCard[id]}
                  onClick={() => onClear(id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.8125rem',
                    borderRadius: 4,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: savingNicknameId === id ? 'wait' : 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
