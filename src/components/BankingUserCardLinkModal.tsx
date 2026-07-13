import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import { formatMercuryDebitCardIdCompact } from '../lib/mercuryRawDebitCard'
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect'

export type BankingUserCardLinkModalProps = {
  open: boolean
  onClose: () => void
  debitCardIds: string[]
  nicknameByDebitCard: Record<string, string>
  usersOptions: SearchableSelectOption[]
  authUserId: string | null
  onSaved?: () => void
  onOpenRecentTransactions?: (mercuryDebitCardId: string) => void
  /** When true, Escape should close the stacked recent-tx preview first, not this modal. */
  recentPreviewOpen?: boolean
}

export function BankingUserCardLinkModal({
  open,
  onClose,
  debitCardIds,
  nicknameByDebitCard,
  usersOptions,
  authUserId,
  onSaved,
  onOpenRecentTransactions,
  recentPreviewOpen = false,
}: BankingUserCardLinkModalProps) {
  const { showToast } = useToastContext()
  const [userIdByCard, setUserIdByCard] = useState<Record<string, string>>({})
  const [autoAssignUserIdByCard, setAutoAssignUserIdByCard] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [savingCardId, setSavingCardId] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    if (debitCardIds.length === 0) {
      setUserIdByCard({})
      setAutoAssignUserIdByCard({})
      setLoaded(true)
      return
    }
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_debit_card_user_links')
            .select('mercury_debit_card_id, user_id, auto_assign_user_id')
            .in('mercury_debit_card_id', debitCardIds),
        'load mercury debit card user links',
      )
      const nextUser: Record<string, string> = {}
      const nextAuto: Record<string, string> = {}
      for (const id of debitCardIds) {
        nextUser[id] = ''
        nextAuto[id] = ''
      }
      for (const r of rows ?? []) {
        if (r.mercury_debit_card_id && r.user_id) nextUser[r.mercury_debit_card_id] = r.user_id
        if (r.mercury_debit_card_id && r.auto_assign_user_id) {
          nextAuto[r.mercury_debit_card_id] = r.auto_assign_user_id
        }
      }
      setUserIdByCard(nextUser)
      setAutoAssignUserIdByCard(nextAuto)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load card links.', 'error')
      setUserIdByCard(Object.fromEntries(debitCardIds.map((id) => [id, ''])))
      setAutoAssignUserIdByCard(Object.fromEntries(debitCardIds.map((id) => [id, ''])))
    } finally {
      setLoaded(true)
    }
  }, [debitCardIds, showToast])

  useEffect(() => {
    if (!open) {
      setLoaded(false)
      return
    }
    setLoaded(false)
    void loadLinks()
  }, [open, loadLinks])

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

  async function saveCard(mercuryDebitCardId: string) {
    const userId = userIdByCard[mercuryDebitCardId] ?? ''
    const autoRaw = (autoAssignUserIdByCard[mercuryDebitCardId] ?? '').trim()
    const autoAssignUserId = autoRaw === '' ? null : autoRaw
    setSavingCardId(mercuryDebitCardId)
    try {
      if (userId === '') {
        await withSupabaseRetry(
          async () =>
            supabase.from('mercury_debit_card_user_links').delete().eq('mercury_debit_card_id', mercuryDebitCardId),
          'delete debit card user link',
        )
        showToast('Card link removed.', 'success')
      } else {
        const existing = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_debit_card_user_links')
              .select('mercury_debit_card_id')
              .eq('mercury_debit_card_id', mercuryDebitCardId)
              .maybeSingle(),
          'check debit card user link',
        )
        const now = new Date().toISOString()
        if (existing) {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('mercury_debit_card_user_links')
                .update({
                  user_id: userId,
                  updated_at: now,
                  auto_assign_user_id: autoAssignUserId,
                })
                .eq('mercury_debit_card_id', mercuryDebitCardId),
            'update debit card user link',
          )
        } else {
          if (!authUserId) throw new Error('Not signed in.')
          await withSupabaseRetry(
            async () =>
              supabase.from('mercury_debit_card_user_links').insert({
                mercury_debit_card_id: mercuryDebitCardId,
                user_id: userId,
                created_by: authUserId,
                updated_at: now,
                auto_assign_user_id: autoAssignUserId,
              }),
            'insert debit card user link',
          )
        }
        showToast('Card link saved.', 'success')

        if (autoAssignUserId !== null) {
          try {
            const backfillCount = await withSupabaseRetry(
              async () =>
                supabase.rpc('backfill_mercury_auto_attributions_for_debit_card', {
                  p_mercury_debit_card_id: mercuryDebitCardId,
                }),
              'backfill mercury auto attributions',
            )
            if (typeof backfillCount === 'number' && backfillCount > 0) {
              showToast(`Auto-assigned user on ${backfillCount} existing transaction(s).`, 'success')
            }
          } catch (be) {
            showToast(be instanceof Error ? be.message : 'Backfill failed.', 'error')
          }
        }
      }
      onSaved?.()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save card link.', 'error')
    } finally {
      setSavingCardId(null)
    }
  }

  if (!open) return null

  const emptyUser: SearchableSelectOption = { value: '', label: '— Unassigned —' }
  const emptyAuto: SearchableSelectOption = { value: '', label: '— None —' }

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
        aria-labelledby="banking-user-card-link-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(960px, calc(100vw - 2rem))',
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
          <h2 id="banking-user-card-link-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            User Card Link
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
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          Map each company debit card (from Mercury transaction payloads) to a user so they can see matching transactions on Job
          Tally. One card maps to one user. Auto-assign user uses the same list as Tally user and sets Banking user attribution
          (user_id) on matching transactions (existing unattributed rows when you save; new syncs apply automatically). Clearing
          auto-assign does not remove attributions already saved.
        </p>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {!loaded ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
          ) : debitCardIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No debit card IDs yet — sync transactions that include debit card info, then Reload table.
            </p>
          ) : (
            debitCardIds.map((cardId) => {
              const nick = nicknameByDebitCard[cardId]
              return (
                <div
                  key={cardId}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    marginBottom: '0.65rem',
                    paddingBottom: '0.65rem',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ flex: '0 1 12rem', minWidth: 0 }}>
                    <button
                      type="button"
                      title={cardId}
                      aria-label="View recent transactions for this card"
                      disabled={!onOpenRecentTransactions}
                      onClick={() => onOpenRecentTransactions?.(cardId)}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'block',
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        color: onOpenRecentTransactions ? 'var(--text-blue-700)' : 'var(--text-slate-900)',
                        cursor: onOpenRecentTransactions ? 'pointer' : 'default',
                        textDecoration: onOpenRecentTransactions ? 'underline' : 'none',
                        textAlign: 'left',
                      }}
                    >
                      {formatMercuryDebitCardIdCompact(cardId)}
                    </button>
                    {nick ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-500)', marginTop: 2 }}>{nick}</div>
                    ) : null}
                  </div>
                  <div style={{ flex: '1.5 1 11rem', minWidth: 140 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-slate-500)', marginBottom: 2 }}>Tally user</label>
                    <SearchableSelect
                      value={userIdByCard[cardId] ?? ''}
                      onChange={(v) => setUserIdByCard((d) => ({ ...d, [cardId]: v }))}
                      options={usersOptions}
                      emptyOption={emptyUser}
                      placeholder="Select user…"
                      listAriaLabel="User for card"
                      portalZIndex={1200}
                    />
                  </div>
                  <div style={{ flex: '1.5 1 11rem', minWidth: 140 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-slate-500)', marginBottom: 2 }}>Auto-assign user</label>
                    <SearchableSelect
                      value={autoAssignUserIdByCard[cardId] ?? ''}
                      onChange={(v) => setAutoAssignUserIdByCard((d) => ({ ...d, [cardId]: v }))}
                      options={usersOptions}
                      emptyOption={emptyAuto}
                      placeholder="Optional…"
                      listAriaLabel="Auto-assign user for card"
                      portalZIndex={1200}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingCardId === cardId}
                    onClick={() => void saveCard(cardId)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: 4,
                      border: '1px solid #1d4ed8',
                      background: 'var(--bg-blue-tint)',
                      color: 'var(--text-blue-700)',
                      cursor: savingCardId === cardId ? 'wait' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      flexShrink: 0,
                      marginBottom: 1,
                    }}
                  >
                    {savingCardId === cardId ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
