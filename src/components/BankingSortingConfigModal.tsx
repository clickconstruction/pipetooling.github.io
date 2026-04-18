import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  BANKING_SORTING_MAX_EXCLUSION_PATTERNS,
  BANKING_SORTING_MAX_EXCLUSION_STRING_LEN,
  type BankingSortingConfigV1,
  normalizeExclusionLinesFromText,
} from '../lib/bankingSortingConfig'
import {
  defaultKindBadgeColor,
  normalizeHexColor,
  pruneKindBadgesToChoices,
  type MercuryKindBadge,
} from '../lib/bankPaymentsKindBadges'
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
  onSave: (cfg: BankingSortingConfigV1) => void | Promise<void>
  /** Extra line under the main description (e.g. scope: Jobs Bank payments only). */
  contextNote?: string
  /** Appended to dialog title/desc ids for unique aria when multiple instances exist. */
  dialogAriaSuffix?: string
  /** Dialog heading; default "Sorting configuration" (e.g. Banking). */
  title?: string
  /** Jobs Bank payments: edit per-kind badge label + color (saved separately). */
  enableKindBadgeEditor?: boolean
  /** Initial map when `enableKindBadgeEditor` (defaults to empty). */
  kindBadges?: Record<string, MercuryKindBadge>
  /** Called with badges pruned to kinds present in `kindChoices` (Mercury sample). */
  onSaveKindBadges?: (badges: Record<string, MercuryKindBadge>) => void | Promise<void>
  /**
   * Jobs Accounts Receivable only: fourth tab for substring exclusions on Counterparty / Note.
   * When false, Save keeps `initialConfig` exclusion arrays (Banking must not clear AR-only lists).
   */
  enableTextExclusionEditor?: boolean
}

type ConfigSection = 'kinds' | 'accounts' | 'debit' | 'exclusions'

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
  contextNote,
  dialogAriaSuffix,
  title,
  enableKindBadgeEditor = false,
  kindBadges = {},
  onSaveKindBadges,
  enableTextExclusionEditor = false,
}: BankingSortingConfigModalProps) {
  const suf = dialogAriaSuffix ? `-${dialogAriaSuffix}` : ''
  const titleId = `banking-sorting-config-title${suf}`
  const descId = `banking-sorting-config-desc${suf}`
  const contextNoteId = contextNote ? `banking-sorting-config-context${suf}` : undefined
  const describedBy = [descId, contextNoteId].filter(Boolean).join(' ')
  const [draftKinds, setDraftKinds] = useState<Set<string>>(() => new Set())
  const [draftAccounts, setDraftAccounts] = useState<Set<string>>(() => new Set())
  const [draftDebitCardIds, setDraftDebitCardIds] = useState<Set<string>>(() => new Set())
  const [startDateYmd, setStartDateYmd] = useState('')
  const [activeSection, setActiveSection] = useState<ConfigSection>('kinds')
  const [draftKindBadges, setDraftKindBadges] = useState<Record<string, MercuryKindBadge>>({})
  const [draftExcludeCounterpartyText, setDraftExcludeCounterpartyText] = useState('')
  const [draftExcludeNoteText, setDraftExcludeNoteText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const mergedKindChoices = useMemo(() => {
    const s = new Set<string>([...kindChoices, ...Object.keys(kindBadges)])
    return Array.from(s).sort()
  }, [kindChoices, kindBadges])

  useEffect(() => {
    if (!open) return
    setDraftKinds(new Set(initialConfig.kinds))
    setDraftAccounts(new Set(initialConfig.accountIds))
    setDraftDebitCardIds(new Set(initialConfig.debitCardIds))
    setStartDateYmd(initialConfig.startDateYmd)
    setActiveSection('kinds')
    setDraftExcludeCounterpartyText((initialConfig.excludeCounterpartyContains ?? []).join('\n'))
    setDraftExcludeNoteText((initialConfig.excludeNoteContains ?? []).join('\n'))
    setSaveError(null)
  }, [open, initialConfig])

  useEffect(() => {
    if (!open || !enableKindBadgeEditor) return
    setDraftKindBadges(() => {
      const next: Record<string, MercuryKindBadge> = {}
      for (const k of mergedKindChoices) {
        const prev = kindBadges[k]
        const color = normalizeHexColor(prev?.color ?? '') ?? defaultKindBadgeColor()
        next[k] = { nickname: (prev?.nickname ?? '').trim(), color }
      }
      return next
    })
  }, [open, enableKindBadgeEditor, kindBadges, mergedKindChoices])

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

  async function handleSave() {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateYmd.trim())
    if (!m) return
    setSaveError(null)
    const cfgPayload = {
      v: initialConfig.v,
      kinds: Array.from(draftKinds).sort(),
      accountIds: Array.from(draftAccounts).sort(),
      debitCardIds: Array.from(draftDebitCardIds).sort(),
      startDateYmd: startDateYmd.trim(),
      excludeCounterpartyContains: enableTextExclusionEditor
        ? normalizeExclusionLinesFromText(draftExcludeCounterpartyText)
        : (initialConfig.excludeCounterpartyContains ?? []),
      excludeNoteContains: enableTextExclusionEditor
        ? normalizeExclusionLinesFromText(draftExcludeNoteText)
        : (initialConfig.excludeNoteContains ?? []),
    }
    try {
      if (enableKindBadgeEditor && onSaveKindBadges) {
        const normalized: Record<string, MercuryKindBadge> = {}
        for (const [k, b] of Object.entries(draftKindBadges)) {
          const color = normalizeHexColor(b.color) ?? defaultKindBadgeColor()
          normalized[k] = { nickname: b.nickname.trim(), color }
        }
        await Promise.resolve(onSaveKindBadges(pruneKindBadgesToChoices(normalized, kindChoices)))
      }
      await Promise.resolve(onSave(cfgPayload))
      onClose()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
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
    exclusions: 'banking-sorting-config-tab-exclusions',
  } as const

  const panelIds = {
    kinds: 'banking-sorting-config-panel-kinds',
    accounts: 'banking-sorting-config-panel-accounts',
    debit: 'banking-sorting-config-panel-debit',
    exclusions: 'banking-sorting-config-panel-exclusions',
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
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          width:
            enableKindBadgeEditor || enableTextExclusionEditor
              ? 'min(600px, calc(100vw - 2rem))'
              : 'min(520px, calc(100vw - 2rem))',
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
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            {title ?? 'Sorting configuration'}
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
        <p id={descId} style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
          Empty <strong>Kinds</strong>, <strong>Accounts</strong>, or <strong>Debit cards</strong> lists mean <strong>all</strong>. Start date uses the
          transaction <strong>posted</strong> day (America/Chicago); oldest row must be on or after that day.
        </p>
        {contextNote && contextNoteId ? (
          <p id={contextNoteId} style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
            {contextNote}
          </p>
        ) : null}

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
          {enableTextExclusionEditor ? (
            <button
              type="button"
              role="tab"
              id={tabIds.exclusions}
              aria-selected={activeSection === 'exclusions'}
              aria-controls={panelIds.exclusions}
              tabIndex={activeSection === 'exclusions' ? 0 : -1}
              onClick={() => setActiveSection('exclusions')}
              style={pageUnderlineTabStyle(activeSection === 'exclusions')}
            >
              Exclusions
            </button>
          ) : null}
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
            <div
              style={
                enableKindBadgeEditor
                  ? { ...listBoxStyle, maxHeight: 'min(40vh, 320px)' }
                  : listBoxStyle
              }
            >
              {(enableKindBadgeEditor ? mergedKindChoices : kindChoices).length === 0 ? (
                <span style={{ color: '#6b7280' }}>No kinds loaded yet — open Ledger or reload transactions.</span>
              ) : enableKindBadgeEditor ? (
                mergedKindChoices.map((k) => {
                  const inSample = kindChoices.includes(k)
                  const badge = draftKindBadges[k] ?? { nickname: '', color: defaultKindBadgeColor() }
                  return (
                    <div
                      key={k}
                      style={{
                        marginBottom: '0.5rem',
                        paddingBottom: '0.45rem',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {inSample ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: '1 1 12rem', minWidth: 0 }}>
                            <input type="checkbox" checked={draftKinds.has(k)} onChange={() => toggleKind(k)} />
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', wordBreak: 'break-all' }} title={k}>
                              {formatMercuryKind(k)}
                            </span>
                          </label>
                        ) : (
                          <div style={{ flex: '1 1 12rem', minWidth: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }} title={k}>
                              {formatMercuryKind(k)}
                            </span>
                            <div style={{ marginTop: 2 }}>Not in current Mercury sample — badge entry drops on Save.</div>
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          marginTop: '0.35rem',
                          marginLeft: inSample ? '1.5rem' : 0,
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          Badge label
                          <input
                            type="text"
                            value={badge.nickname}
                            onChange={(e) =>
                              setDraftKindBadges((prev) => ({
                                ...prev,
                                [k]: { ...badge, nickname: e.target.value },
                              }))
                            }
                            placeholder="Optional"
                            style={{ padding: '4px 6px', fontSize: '0.8125rem', width: 'min(220px, 100%)' }}
                          />
                        </label>
                        <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          Color
                          <input
                            type="color"
                            value={normalizeHexColor(badge.color) ?? defaultKindBadgeColor()}
                            onChange={(e) => {
                              const v = normalizeHexColor(e.target.value) ?? defaultKindBadgeColor()
                              setDraftKindBadges((prev) => ({
                                ...prev,
                                [k]: { ...badge, color: v },
                              }))
                            }}
                            aria-label={`Badge color for ${k}`}
                            style={{ width: 36, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          />
                        </label>
                      </div>
                    </div>
                  )
                })
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

        {enableTextExclusionEditor && activeSection === 'exclusions' ? (
          <div
            role="tabpanel"
            id={panelIds.exclusions}
            aria-labelledby={tabIds.exclusions}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: '0.85rem', gap: '0.75rem' }}
          >
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
              Hide transactions when Mercury <strong>Counterparty name</strong> or internal <strong>Note</strong> contains any of these
              substrings (case-insensitive). One pattern per line. Max {BANKING_SORTING_MAX_EXCLUSION_PATTERNS} patterns per list, up to{' '}
              {BANKING_SORTING_MAX_EXCLUSION_STRING_LEN} characters each.
            </p>
            <div>
              <label
                htmlFor="banking-sorting-exclude-counterparty"
                style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}
              >
                Counterparty exclusions
              </label>
              <textarea
                id="banking-sorting-exclude-counterparty"
                value={draftExcludeCounterpartyText}
                onChange={(e) => setDraftExcludeCounterpartyText(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder="One substring per line"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.8125rem',
                  padding: '0.5rem 0.65rem',
                  borderRadius: 4,
                  border: '1px solid #e5e7eb',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '4.5rem',
                  background: '#fafafa',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="banking-sorting-exclude-note"
                style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}
              >
                Note exclusions
              </label>
              <textarea
                id="banking-sorting-exclude-note"
                value={draftExcludeNoteText}
                onChange={(e) => setDraftExcludeNoteText(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder="One substring per line"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.8125rem',
                  padding: '0.5rem 0.65rem',
                  borderRadius: 4,
                  border: '1px solid #e5e7eb',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '4.5rem',
                  background: '#fafafa',
                }}
              />
            </div>
          </div>
        ) : null}

        {saveError ? (
          <p role="alert" style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#b91c1c' }}>
            {saveError}
          </p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => void handleSave()}
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
