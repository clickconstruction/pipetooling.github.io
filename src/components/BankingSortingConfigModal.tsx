import { useEffect, useState, type CSSProperties } from 'react'
import type { BankingSortingConfigV1 } from '../lib/bankingSortingConfig'
import { formatMercuryKind } from '../lib/mercuryKindLabels'
import { pageUnderlineTabStyle } from '../lib/pageUnderlineTabStyle'
import { formatWorkDateYmdFriendly } from '../utils/dateUtils'

export type BankingSortingConfigModalProps = {
  open: boolean
  onClose: () => void
  initialConfig: BankingSortingConfigV1
  kindChoices: string[]
  accountChoices: string[]
  nicknameByAccount: Record<string, string>
  debitCardChoices: string[]
  nicknameByDebitCard: Record<string, string>
  onSave: (cfg: BankingSortingConfigV1) => void
}

type ConfigSection = 'kinds' | 'accounts' | 'debit'

function shortUuidPrefix(id: string): string {
  if (id.length <= 8) return id
  return `${id.slice(0, 8)}…`
}

export function BankingSortingConfigModal({
  open,
  onClose,
  initialConfig,
  kindChoices,
  accountChoices,
  nicknameByAccount,
  debitCardChoices,
  nicknameByDebitCard,
  onSave,
}: BankingSortingConfigModalProps) {
  const [draftKinds, setDraftKinds] = useState<Set<string>>(() => new Set())
  const [draftAccounts, setDraftAccounts] = useState<Set<string>>(() => new Set())
  const [draftDebitCardIds, setDraftDebitCardIds] = useState<Set<string>>(() => new Set())
  const [startDateYmd, setStartDateYmd] = useState('')
  const [activeSection, setActiveSection] = useState<ConfigSection>('kinds')

  useEffect(() => {
    if (!open) return
    setDraftKinds(new Set(initialConfig.kinds))
    setDraftAccounts(new Set(initialConfig.accountIds))
    setDraftDebitCardIds(new Set(initialConfig.debitCardIds))
    setStartDateYmd(initialConfig.startDateYmd)
    setActiveSection('kinds')
  }, [open, initialConfig])

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

  function toggleKind(k: string) {
    setDraftKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function toggleAccount(id: string) {
    setDraftAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleDebitCard(id: string) {
    setDraftDebitCardIds((prev) => {
      const next = new Set(prev)
      const key = id.trim().toLowerCase()
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAllKinds() {
    setDraftKinds(new Set(kindChoices))
  }

  function clearKinds() {
    setDraftKinds(new Set())
  }

  function selectAllAccounts() {
    setDraftAccounts(new Set(accountChoices))
  }

  function clearAccounts() {
    setDraftAccounts(new Set())
  }

  function selectAllDebitCards() {
    setDraftDebitCardIds(new Set(debitCardChoices.map((id) => id.trim().toLowerCase()).filter(Boolean)))
  }

  function clearDebitCards() {
    setDraftDebitCardIds(new Set())
  }

  function handleSave() {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateYmd.trim())
    if (!m) return
    onSave({
      v: initialConfig.v,
      kinds: Array.from(draftKinds).sort(),
      accountIds: Array.from(draftAccounts).sort(),
      debitCardIds: Array.from(draftDebitCardIds).sort(),
      startDateYmd: startDateYmd.trim(),
    })
    onClose()
  }

  const listBoxStyle: CSSProperties = {
    maxHeight: 'min(28vh, 220px)',
    overflow: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    padding: '0.5rem 0.65rem',
    fontSize: '0.8125rem',
    background: '#fafafa',
  }

  const tabIds = {
    kinds: 'banking-sorting-config-tab-kinds',
    accounts: 'banking-sorting-config-tab-accounts',
    debit: 'banking-sorting-config-tab-debit',
  } as const

  const panelIds = {
    kinds: 'banking-sorting-config-panel-kinds',
    accounts: 'banking-sorting-config-panel-accounts',
    debit: 'banking-sorting-config-panel-debit',
  } as const

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
        aria-labelledby="banking-sorting-config-title"
        aria-describedby="banking-sorting-config-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          width: 'min(520px, calc(100vw - 2rem))',
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
            marginBottom: '0.5rem',
            flexShrink: 0,
          }}
        >
          <h2 id="banking-sorting-config-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Sorting configuration
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
            Cancel
          </button>
        </div>
        <p id="banking-sorting-config-desc" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
          Empty <strong>Kinds</strong>, <strong>Accounts</strong>, or <strong>Debit cards</strong> lists mean <strong>all</strong>. Start date uses the
          transaction <strong>posted</strong> day (America/Chicago); oldest row must be on or after that day.
        </p>

        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
          Start date
        </label>
        <input
          type="date"
          value={startDateYmd}
          onChange={(e) => setStartDateYmd(e.target.value)}
          style={{ marginBottom: '0.85rem', padding: '6px 8px', fontSize: '0.875rem', maxWidth: '12rem' }}
        />
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.85rem' }}>
          {startDateYmd ? formatWorkDateYmdFriendly(startDateYmd) : '—'}
        </div>

        <div
          role="tablist"
          aria-label="Filter dimension"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 0,
            marginBottom: '0.5rem',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <button
            type="button"
            role="tab"
            id={tabIds.kinds}
            aria-selected={activeSection === 'kinds'}
            aria-controls={panelIds.kinds}
            tabIndex={activeSection === 'kinds' ? 0 : -1}
            onClick={() => setActiveSection('kinds')}
            style={pageUnderlineTabStyle(activeSection === 'kinds')}
          >
            Kinds
          </button>
          <button
            type="button"
            role="tab"
            id={tabIds.accounts}
            aria-selected={activeSection === 'accounts'}
            aria-controls={panelIds.accounts}
            tabIndex={activeSection === 'accounts' ? 0 : -1}
            onClick={() => setActiveSection('accounts')}
            style={pageUnderlineTabStyle(activeSection === 'accounts')}
          >
            Accounts
          </button>
          <button
            type="button"
            role="tab"
            id={tabIds.debit}
            aria-selected={activeSection === 'debit'}
            aria-controls={panelIds.debit}
            tabIndex={activeSection === 'debit' ? 0 : -1}
            onClick={() => setActiveSection('debit')}
            style={pageUnderlineTabStyle(activeSection === 'debit')}
          >
            Debit cards
          </button>
        </div>

        {activeSection === 'kinds' ? (
          <div
            role="tabpanel"
            id={panelIds.kinds}
            aria-labelledby={tabIds.kinds}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: '0.85rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Kinds</span>
              <span style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" onClick={selectAllKinds} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  All
                </button>
                <button type="button" onClick={clearKinds} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  None (any)
                </button>
              </span>
            </div>
            <div style={listBoxStyle}>
              {kindChoices.length === 0 ? (
                <span style={{ color: '#6b7280' }}>No kinds loaded yet — open Ledger or reload transactions.</span>
              ) : (
                kindChoices.map((k) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.25rem' }}>
                    <input type="checkbox" checked={draftKinds.has(k)} onChange={() => toggleKind(k)} />
                    <span>{formatMercuryKind(k)}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeSection === 'accounts' ? (
          <div
            role="tabpanel"
            id={panelIds.accounts}
            aria-labelledby={tabIds.accounts}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: '0.85rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Accounts</span>
              <span style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" onClick={selectAllAccounts} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  All
                </button>
                <button type="button" onClick={clearAccounts} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  None (any)
                </button>
              </span>
            </div>
            <div style={listBoxStyle}>
              {accountChoices.length === 0 ? (
                <span style={{ color: '#6b7280' }}>No accounts loaded yet — open Ledger or reload transactions.</span>
              ) : (
                accountChoices.map((id) => (
                  <label
                    key={id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.25rem' }}
                    title={id}
                  >
                    <input type="checkbox" checked={draftAccounts.has(id)} onChange={() => toggleAccount(id)} />
                    <span>{nicknameByAccount[id] ? `${nicknameByAccount[id]} (${shortUuidPrefix(id)})` : id}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeSection === 'debit' ? (
          <div
            role="tabpanel"
            id={panelIds.debit}
            aria-labelledby={tabIds.debit}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: '0.85rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Debit cards</span>
              <span style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" onClick={selectAllDebitCards} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  All
                </button>
                <button type="button" onClick={clearDebitCards} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  None (any)
                </button>
              </span>
            </div>
            <div style={listBoxStyle}>
              {debitCardChoices.length === 0 ? (
                <span style={{ color: '#6b7280' }}>No debit cards loaded yet — sync from Mercury or add nicknames.</span>
              ) : (
                debitCardChoices.map((id) => {
                  const key = id.trim().toLowerCase()
                  return (
                    <label
                      key={key}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.25rem' }}
                      title={key}
                    >
                      <input type="checkbox" checked={draftDebitCardIds.has(key)} onChange={() => toggleDebitCard(id)} />
                      <span>
                        {nicknameByDebitCard[key] ? `${nicknameByDebitCard[key]} (${shortUuidPrefix(key)})` : key}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 4,
              border: '1px solid #1d4ed8',
              background: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
