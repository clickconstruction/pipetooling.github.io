import { useEffect, type Dispatch, type SetStateAction } from 'react'

export type BankingAccountNicknamesModalProps = {
  open: boolean
  onClose: () => void
  accountIds: string[]
  nicknameByAccount: Record<string, string>
  nicknameDrafts: Record<string, string>
  setNicknameDrafts: Dispatch<SetStateAction<Record<string, string>>>
  savingNicknameId: string | null
  onSave: (mercuryAccountId: string) => void
  onClear: (mercuryAccountId: string) => void
}

function shortUuidPrefix(id: string): string {
  if (id.length <= 8) return id
  return `${id.slice(0, 8)}…`
}

export function BankingAccountNicknamesModal({
  open,
  onClose,
  accountIds,
  nicknameByAccount,
  nicknameDrafts,
  setNicknameDrafts,
  savingNicknameId,
  onSave,
  onClear,
}: BankingAccountNicknamesModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

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
        aria-labelledby="banking-account-nicknames-modal-title"
        aria-describedby="banking-account-nicknames-modal-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
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
          <h2 id="banking-account-nicknames-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Account nicknames
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <p id="banking-account-nicknames-modal-desc" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          One label per Mercury account id (shared for all devs). Save with empty text to remove a label, or use Clear.
        </p>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {accountIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No account IDs yet — use Refresh from Mercury or Reload table.
            </p>
          ) : (
            accountIds.map((id) => (
              <div
                key={id}
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}
              >
                <code style={{ fontSize: '0.75rem', flex: '0 0 auto', minWidth: '6.5rem' }} title={id}>
                  {shortUuidPrefix(id)}
                </code>
                <input
                  value={nicknameDrafts[id] ?? nicknameByAccount[id] ?? ''}
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
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    cursor: savingNicknameId === id ? 'wait' : 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={savingNicknameId === id || !nicknameByAccount[id]}
                  onClick={() => onClear(id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.8125rem',
                    borderRadius: 4,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
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
