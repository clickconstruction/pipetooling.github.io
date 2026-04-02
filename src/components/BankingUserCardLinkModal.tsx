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
}

export function BankingUserCardLinkModal({
  open,
  onClose,
  debitCardIds,
  nicknameByDebitCard,
  usersOptions,
  authUserId,
  onSaved,
}: BankingUserCardLinkModalProps) {
  const { showToast } = useToastContext()
  const [userIdByCard, setUserIdByCard] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [savingCardId, setSavingCardId] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    if (debitCardIds.length === 0) {
      setUserIdByCard({})
      setLoaded(true)
      return
    }
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_debit_card_user_links')
            .select('mercury_debit_card_id, user_id')
            .in('mercury_debit_card_id', debitCardIds),
        'load mercury debit card user links',
      )
      const next: Record<string, string> = {}
      for (const id of debitCardIds) next[id] = ''
      for (const r of rows ?? []) {
        if (r.mercury_debit_card_id && r.user_id) next[r.mercury_debit_card_id] = r.user_id
      }
      setUserIdByCard(next)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load card links.', 'error')
      setUserIdByCard(Object.fromEntries(debitCardIds.map((id) => [id, ''])))
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
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  async function saveCard(mercuryDebitCardId: string) {
    const userId = userIdByCard[mercuryDebitCardId] ?? ''
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
                .update({ user_id: userId, updated_at: now })
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
              }),
            'insert debit card user link',
          )
        }
        showToast('Card link saved.', 'success')
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
          background: 'white',
          borderRadius: 8,
          width: 'min(720px, calc(100vw - 2rem))',
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
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          Map each company debit card (from Mercury transaction payloads) to a user so they can see matching transactions on Job Tally. One
          card maps to one user.
        </p>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {!loaded ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p>
          ) : debitCardIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
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
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.65rem',
                    paddingBottom: '0.65rem',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ flex: '0 1 12rem', minWidth: 0 }}>
                    <div
                      title={cardId}
                      style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#0f172a', fontWeight: 600 }}
                    >
                      {formatMercuryDebitCardIdCompact(cardId)}
                    </div>
                    {nick ? (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{nick}</div>
                    ) : null}
                  </div>
                  <div style={{ flex: '2 1 14rem', minWidth: 160 }}>
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
                  <button
                    type="button"
                    disabled={savingCardId === cardId}
                    onClick={() => void saveCard(cardId)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: 4,
                      border: '1px solid #1d4ed8',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      cursor: savingCardId === cardId ? 'wait' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      flexShrink: 0,
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
