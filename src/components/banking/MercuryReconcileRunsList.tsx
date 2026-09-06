/**
 * T5-06 (Tier 5 X4): "Last reconciled" — the receipts of past `mercury-reconcile` runs, newest
 * first, so "did the books match the bank on Friday?" has an answer after the tab closes.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { receiptVerdict } from '../../../supabase/functions/_shared/reconcileReceipt'

export type ReconcileRunRow = {
  id: string
  ran_at: string
  ran_by: string | null
  months_back: number
  accounts_checked: number
  statement_lines: number
  statement_lines_present: number
  months_with_missing: number
  current_within_epsilon: boolean | null
  scope: string
}

const RUNS_TO_SHOW = 10

export function MercuryReconcileRunsList({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<ReconcileRunRow[] | null>(null)
  const [userNames, setUserNames] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('mercury_reconcile_runs')
      .select('id, ran_at, ran_by, months_back, accounts_checked, statement_lines, statement_lines_present, months_with_missing, current_within_epsilon, scope')
      .order('ran_at', { ascending: false })
      .limit(RUNS_TO_SHOW)
    // A missing table (migration not pushed yet) reads as an empty list, not an error banner.
    const list = error ? [] : ((data ?? []) as ReconcileRunRow[])
    setRows(list)
    const ids = [...new Set(list.map((r) => r.ran_by).filter((id): id is string => !!id))]
    if (ids.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids)
      setUserNames(new Map(((users ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, (u.name ?? '').trim() || '—'])))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (rows === null) return null
  return (
    <section aria-label="Last reconciled" style={{ marginTop: '1.25rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.4rem' }}>Last reconciled</h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No saved runs yet — the next check leaves a receipt here.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.3rem 0.5rem', fontWeight: 600 }}>Run</th>
              <th style={{ padding: '0.3rem 0.5rem', fontWeight: 600 }}>Window</th>
              <th style={{ padding: '0.3rem 0.5rem', fontWeight: 600 }}>Result</th>
              <th style={{ padding: '0.3rem 0.5rem', fontWeight: 600 }}>By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = receiptVerdict({ statementLines: r.statement_lines, statementLinesPresent: r.statement_lines_present, currentWithinEpsilon: r.current_within_epsilon })
              const open = openId === r.id
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(r.ran_at).toLocaleString()}</td>
                  <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>
                    {r.months_back} mo · {r.accounts_checked} acct{r.accounts_checked === 1 ? '' : 's'}
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : r.id)}
                      aria-expanded={open}
                      title={open ? 'Hide the scope' : 'Show what this run compared'}
                      style={{ font: 'inherit', fontWeight: 600, color: v.ok ? 'var(--text-green-700)' : 'var(--text-amber-800)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      {v.ok ? '✓' : '⚠'} {v.label}
                    </button>
                    {open ? <div style={{ marginTop: '0.25rem', color: 'var(--text-700)', maxWidth: '70ch' }}>{r.scope}</div> : null}
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>{(r.ran_by && userNames.get(r.ran_by)) || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
