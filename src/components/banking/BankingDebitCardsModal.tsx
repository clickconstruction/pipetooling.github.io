// Debit cards (v2.2750): one row per Mercury debit card — nickname, whether it
// is a person's card or a company card, and the person it belongs to. Replaces
// the separate "Debit card nicknames" and "User Card Link" modals; linking a
// person sets both the Tally user and the auto-assign user and backfills the
// card's past purchases. Reached from the Nicknames menu on Sorting and from
// the Wheels report (`?cards=<id>` opens on that card).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEBIT_CARD_ROLE_OPTIONS, loadDebitCardLinks, saveDebitCardPerson, saveDebitCardRole, type DebitCardLink, type DebitCardRole } from '../../lib/banking/debitCards'
import { SearchableSelect, isSelectableOption, type SearchableSelectOption } from '../SearchableSelect'

export type BankingDebitCardsModalProps = {
  open: boolean
  onClose: () => void
  debitCardIds: string[]
  nicknameByDebitCard: Record<string, string>
  roleByDebitCard: Record<string, DebitCardRole>
  savingNicknameId: string | null
  onSaveNickname: (mercuryDebitCardId: string, nickname: string) => Promise<boolean>
  onClearNickname: (mercuryDebitCardId: string) => Promise<boolean>
  /** Reload nicknames + roles after a role change. */
  onDirectoryChanged: () => Promise<void>
  usersOptions: SearchableSelectOption[]
  authUserId: string | null
  /** Called after a person link is saved or removed (Banking reloads allocations). */
  onLinksChanged?: () => void
  onOpenRecentTransactions?: (mercuryDebitCardId: string) => void
  /** When true, Escape should close the stacked recent-tx preview first, not this modal. */
  recentPreviewOpen?: boolean
  /** Card to scroll to and outline when the modal opens (a door from Wheels). */
  highlightCardId?: string | null
}

const smallBtn: CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.8125rem',
  borderRadius: 4,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  cursor: 'pointer',
  font: 'inherit',
}
const label: CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }

export function BankingDebitCardsModal({
  open,
  onClose,
  debitCardIds,
  nicknameByDebitCard,
  roleByDebitCard,
  savingNicknameId,
  onSaveNickname,
  onClearNickname,
  onDirectoryChanged,
  usersOptions,
  authUserId,
  onLinksChanged,
  onOpenRecentTransactions,
  recentPreviewOpen = false,
  highlightCardId = null,
}: BankingDebitCardsModalProps) {
  const { showToast } = useToastContext()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const touchedRef = useRef<Set<string>>(new Set())
  const wasOpenRef = useRef(false)
  const [links, setLinks] = useState<Record<string, DebitCardLink>>({})
  const [personDraft, setPersonDraft] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unlinked'>('all')
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      touchedRef.current.clear()
      setDrafts(Object.fromEntries(debitCardIds.map((id) => [id, nicknameByDebitCard[id] ?? ''])))
      setFilter('all')
    }
    wasOpenRef.current = open
  }, [open, debitCardIds, nicknameByDebitCard])

  useEffect(() => {
    if (!open) return
    setDrafts((prev) => {
      const next = { ...prev }
      let changed = false
      for (const id of debitCardIds) {
        if (touchedRef.current.has(id)) continue
        const s = nicknameByDebitCard[id] ?? ''
        if (prev[id] !== s) {
          next[id] = s
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [open, debitCardIds, nicknameByDebitCard])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadDebitCardLinks(debitCardIds)
      .then((l) => {
        if (cancelled) return
        setLinks(l)
        setPersonDraft(Object.fromEntries(debitCardIds.map((id) => [id, l[id]?.autoAssignUserId ?? l[id]?.userId ?? ''])))
      })
      .catch((e) => showToast(formatErrorMessage(e), 'error'))
    return () => {
      cancelled = true
    }
  }, [open, debitCardIds, showToast])

  useEffect(() => {
    if (!open || !highlightCardId) return
    const t = window.setTimeout(() => rowRefs.current[highlightCardId.toLowerCase()]?.scrollIntoView({ block: 'center' }), 150)
    return () => window.clearTimeout(t)
  }, [open, highlightCardId, debitCardIds.length])

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

  const userNameById = useMemo(() => new Map(usersOptions.filter(isSelectableOption).map((o) => [o.value, o.label])), [usersOptions])

  if (!open) return null

  const unlinked = debitCardIds.filter((id) => (roleByDebitCard[id] ?? 'person') === 'person' && !(links[id]?.autoAssignUserId ?? links[id]?.userId))
  const visible = filter === 'unlinked' ? unlinked : debitCardIds

  const savePerson = async (id: string) => {
    const userId = (personDraft[id] ?? '').trim() || null
    setBusyId(id)
    try {
      const n = await saveDebitCardPerson(id, userId, authUserId)
      setLinks((prev) => ({ ...prev, [id]: { userId, autoAssignUserId: userId } }))
      const who = userId ? (userNameById.get(userId) ?? 'that person') : null
      showToast(
        who
          ? `${nicknameByDebitCard[id] || formatMercuryDebitCardIdCompact(id)} → ${who}.${n > 0 ? ` ${n} past purchase${n === 1 ? '' : 's'} filled in.` : ''}`
          : 'Link removed. Purchases already attributed stay as they are.',
        'success',
      )
      onLinksChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const saveRole = async (id: string, role: DebitCardRole) => {
    if (!nicknameByDebitCard[id]) {
      showToast('Give the card a nickname first — the role is stored with it.', 'error')
      return
    }
    setBusyId(id)
    try {
      await saveDebitCardRole(id, role)
      await onDirectoryChanged()
      showToast(role === 'company' ? 'Marked as a company card — it will not count as anyone’s fuel.' : 'Marked as a person’s card.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const emptyPerson: SearchableSelectOption = { value: '', label: '— Nobody yet —' }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
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
        aria-labelledby="banking-debit-cards-modal-title"
        aria-describedby="banking-debit-cards-modal-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 8,
          width: 'min(1000px, calc(100vw - 2rem))',
          maxHeight: 'min(90vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem', flexShrink: 0 }}>
          <h2 id="banking-debit-cards-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Debit cards ({debitCardIds.length})
          </h2>
          <button type="button" onClick={onClose} style={{ ...smallBtn, padding: '0.45rem 0.85rem', fontSize: '0.875rem' }}>
            Close
          </button>
        </div>
        <p id="banking-debit-cards-modal-desc" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.6rem', flexShrink: 0 }}>
          Name each card, say whether it is a person's card or a company card, and link a person's card to its person. Linking fills the person in on the
          card's past purchases and every new one, so their fuel reaches Wheels and Review.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '0.6rem', flexShrink: 0, fontSize: '0.8125rem' }}>
          <button type="button" onClick={() => setFilter('all')} aria-pressed={filter === 'all'} style={{ ...smallBtn, fontWeight: filter === 'all' ? 700 : 500 }}>
            All
          </button>
          <button type="button" onClick={() => setFilter('unlinked')} aria-pressed={filter === 'unlinked'} style={{ ...smallBtn, fontWeight: filter === 'unlinked' ? 700 : 500 }}>
            Nobody yet ({unlinked.length})
          </button>
          <span style={{ color: 'var(--text-muted)' }}>Company cards never count as fuel.</span>
        </div>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {debitCardIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No debit card IDs yet — sync transactions that include debit card info, then Reload table.</p>
          ) : visible.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Every person's card has a person.</p>
          ) : (
            visible.map((id) => {
              const role = roleByDebitCard[id] ?? 'person'
              const link = links[id]
              const linkedName = link?.autoAssignUserId ? userNameById.get(link.autoAssignUserId) : link?.userId ? userNameById.get(link.userId) : null
              const highlighted = highlightCardId != null && highlightCardId.toLowerCase() === id
              const busy = busyId === id || savingNicknameId === id
              return (
                <div
                  key={id}
                  ref={(el) => {
                    rowRefs.current[id] = el
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(7rem, 9rem) minmax(160px, 1.4fr) minmax(150px, 1fr) minmax(180px, 1.4fr)',
                    gap: '0.6rem',
                    alignItems: 'end',
                    padding: '0.55rem 0.5rem',
                    marginBottom: 2,
                    borderRadius: 6,
                    border: `1px solid ${highlighted ? 'var(--text-link)' : 'var(--border-soft)'}`,
                    background: highlighted ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <button
                      type="button"
                      title={id}
                      aria-label="View recent transactions for this card"
                      disabled={!onOpenRecentTransactions}
                      onClick={() => onOpenRecentTransactions?.(id)}
                      style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: onOpenRecentTransactions ? 'var(--text-link)' : 'var(--text-base)', cursor: onOpenRecentTransactions ? 'pointer' : 'default', textDecoration: onOpenRecentTransactions ? 'underline' : 'none' }}
                    >
                      {formatMercuryDebitCardIdCompact(id)}
                    </button>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {role === 'company' ? '🏢 company card' : linkedName ? `👤 ${linkedName}` : 'nobody yet'}
                    </div>
                  </div>
                  <div>
                    <span style={label}>Nickname</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        value={drafts[id] ?? ''}
                        onChange={(e) => {
                          touchedRef.current.add(id)
                          setDrafts((d) => ({ ...d, [id]: e.target.value }))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void (async () => {
                              const ok = await onSaveNickname(id, drafts[id] ?? '')
                              if (ok) touchedRef.current.delete(id)
                            })()
                          }
                        }}
                        placeholder="e.g. Malachi 6783"
                        maxLength={120}
                        disabled={busy}
                        aria-label={`Nickname for card ${formatMercuryDebitCardIdCompact(id)}`}
                        style={{ flex: '1 1 auto', minWidth: 0, padding: '4px 8px', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }}
                      />
                      <button
                        type="button"
                        disabled={busy || (drafts[id] ?? '') === (nicknameByDebitCard[id] ?? '')}
                        onClick={() => {
                          void (async () => {
                            const ok = await onSaveNickname(id, drafts[id] ?? '')
                            if (ok) touchedRef.current.delete(id)
                          })()
                        }}
                        style={smallBtn}
                      >
                        Save
                      </button>
                      {nicknameByDebitCard[id] ? (
                        <button type="button" disabled={busy} onClick={() => void onClearNickname(id)} title="Remove the nickname (and the company-card mark, which lives with it)" style={{ ...smallBtn, color: 'var(--text-muted)' }}>
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <span style={label}>Card is</span>
                    <select
                      value={role}
                      onChange={(e) => void saveRole(id, e.target.value === 'company' ? 'company' : 'person')}
                      disabled={busy}
                      aria-label={`Role of card ${formatMercuryDebitCardIdCompact(id)}`}
                      title={DEBIT_CARD_ROLE_OPTIONS.find((o) => o.key === role)?.hint}
                      style={{ width: '100%', padding: '4px 6px', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }}
                    >
                      {DEBIT_CARD_ROLE_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span style={label}>Person</span>
                    {role === 'company' ? (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '5px 0' }}>Not a person's card.</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                          <SearchableSelect
                            value={personDraft[id] ?? ''}
                            onChange={(v) => setPersonDraft((d) => ({ ...d, [id]: v }))}
                            options={usersOptions}
                            emptyOption={emptyPerson}
                            placeholder="Pick a person…"
                            listAriaLabel={`Person for card ${formatMercuryDebitCardIdCompact(id)}`}
                            portalZIndex={1200}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={busy || (personDraft[id] ?? '') === (link?.autoAssignUserId ?? link?.userId ?? '')}
                          onClick={() => void savePerson(id)}
                          style={{ ...smallBtn, border: '1px solid #1d4ed8', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontWeight: 600 }}
                        >
                          {busyId === id ? 'Saving…' : 'Link'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
