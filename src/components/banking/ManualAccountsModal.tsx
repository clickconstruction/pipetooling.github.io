import { useCallback, useEffect, useState } from 'react'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

type ManualAccountRow = Database['public']['Functions']['list_manual_bank_accounts']['Returns'][number]

export type ManualAccountsModalProps = {
  open: boolean
  onClose: () => void
  /** Called after a rename/delete so the parent can refresh the Ledger (nicknames + rows). */
  onChanged: () => void
}

function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function ymd(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—'
}

export function ManualAccountsModal({ open, onClose, onChanged }: ManualAccountsModalProps) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<ManualAccountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await withSupabaseRetry(async () => supabase.rpc('list_manual_bank_accounts'), 'list manual bank accounts')
      const list = (data as ManualAccountRow[]) ?? []
      setRows(list)
      setDrafts(Object.fromEntries(list.map((r) => [r.mercury_account_id, r.name ?? ''])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load manual accounts')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
    else {
      setConfirmDeleteId(null)
      setBusyId(null)
    }
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busyId, onClose])

  const rename = useCallback(
    async (accountId: string) => {
      const name = (drafts[accountId] ?? '').trim()
      if (name === '') {
        showToast('Account name cannot be empty.', 'error')
        return
      }
      setBusyId(accountId)
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('manage-manual-account', {
          body: { action: 'rename', accountId, name },
        })
        if (fnErr) throw new Error(fnErr.message)
        const body = data as { error?: string } | null
        if (body && typeof body.error === 'string') throw new Error(body.error)
        showToast(`Renamed to “${name}”.`, 'success')
        await load()
        onChanged()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Rename failed', 'error')
      } finally {
        setBusyId(null)
      }
    },
    [drafts, load, onChanged, showToast],
  )

  const remove = useCallback(
    async (accountId: string) => {
      setBusyId(accountId)
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('manage-manual-account', {
          body: { action: 'delete', accountId },
        })
        if (fnErr) throw new Error(fnErr.message)
        const body = data as { error?: string; deleted?: number } | null
        if (body && typeof body.error === 'string') throw new Error(body.error)
        showToast(`Deleted account and ${body?.deleted ?? 0} transaction(s).`, 'success')
        setConfirmDeleteId(null)
        await load()
        onChanged()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Delete failed', 'error')
      } finally {
        setBusyId(null)
      }
    },
    [load, onChanged, showToast],
  )

  if (!open) return null

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busyId) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1260, padding: '1rem', boxSizing: 'border-box' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-accounts-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, maxWidth: 680, width: '100%', maxHeight: 'min(90vh, 680px)', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', padding: '1.25rem', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h2 id="manual-accounts-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
            Manual accounts
          </h2>
          <button type="button" onClick={onClose} disabled={!!busyId} style={{ padding: '0.4rem 0.85rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: busyId ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
            Close
          </button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-slate-600)', lineHeight: 1.5 }}>
          Accounts created by importing a CSV (closed / external accounts). Rename one, or delete it to remove the account
          and all of its imported transactions. Real Mercury accounts are not listed here.
        </p>

        {loading ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : error ? (
          <p role="alert" style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--bg-red-tint)', border: '1px solid #fecaca', color: 'var(--text-red-800)', fontSize: '0.8rem' }}>{error}</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No imported accounts yet. Use “Import transactions (CSV)…” in the Ledger Advanced menu.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {rows.map((r) => {
              const id = r.mercury_account_id
              const busy = busyId === id
              const confirming = confirmDeleteId === id
              return (
                <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.85rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      value={drafts[id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                      maxLength={120}
                      placeholder="Account name"
                      disabled={busy}
                      style={{ flex: '1 1 14rem', minWidth: 160, padding: '0.4rem 0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => void rename(id)}
                      disabled={busy || (drafts[id] ?? '').trim() === '' || (drafts[id] ?? '').trim() === (r.name ?? '')}
                      style={{ padding: '0.4rem 0.85rem', borderRadius: 6, border: 'none', background: busy ? '#94a3b8' : '#2563eb', color: 'white', fontWeight: 600, fontSize: '0.8125rem', cursor: busy ? 'not-allowed' : 'pointer' }}
                    >
                      {busy ? '…' : 'Save'}
                    </button>
                    {confirming ? (
                      <>
                        <button type="button" onClick={() => void remove(id)} disabled={busy} style={{ padding: '0.4rem 0.7rem', borderRadius: 6, border: 'none', background: '#b91c1c', color: 'white', fontWeight: 600, fontSize: '0.8125rem', cursor: busy ? 'not-allowed' : 'pointer' }}>
                          {busy ? 'Deleting…' : 'Confirm delete'}
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={busy} style={{ padding: '0.4rem 0.7rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(id)} disabled={busy} style={{ padding: '0.4rem 0.7rem', borderRadius: 6, border: '1px solid #fecaca', background: 'var(--surface)', color: 'var(--text-red-700)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                        Delete
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-slate-500)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem' }}>
                    <span><strong>{r.tx_count}</strong> tx</span>
                    <span>Net <strong style={{ color: r.net_total < 0 ? 'var(--text-red-700)' : '#047857' }}>{usd(r.net_total)}</strong></span>
                    <span>{ymd(r.oldest_posted)} → {ymd(r.newest_posted)}</span>
                  </div>
                  {confirming ? (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                      This permanently deletes the account and its {r.tx_count} imported transaction(s).
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
