import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  buildPartnerJournal,
  mergePendingIntoJournal,
  netPosition,
  summarizePendingOffsets,
  type JournalAdditionalLine,
  type JournalDeduction,
  type JournalPayment,
  type JournalPendingOffset,
  type JournalRow,
  type JournalStub,
} from '../../lib/partnerLedger/partnerLedgerJournal'

/**
 * Partnerships → Ledger tab (PARTNERSHIPS_PLAN.md PR 3): the append-only
 * journal behind the statements — every posting (labor, additions, deductions,
 * payouts) oldest-first with a running balance, plus offsets still pending.
 * Pure view over the pay_stubs family via the dev's payroll-access RLS; the
 * shaping lives in the partnerLedgerJournal kernel.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PartnershipLedgerTab({ personId }: { personId: string }) {
  const [rows, setRows] = useState<JournalRow[] | null>(null)
  const [balance, setBalance] = useState(0)
  const [pending, setPending] = useState<{ count: number; net: number }>({ count: 0, net: 0 })
  const [pendingRows, setPendingRows] = useState<JournalPendingOffset[]>([])
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const stubsRes = await supabase
      .from('pay_stubs')
      .select('id, period_start, period_end, hours_total, gross_pay')
      .eq('person_id', personId)
      .order('period_start', { ascending: true })
    if (stubsRes.error) {
      setFailed(true)
      setRows([])
      return
    }
    setFailed(false)
    const stubs = (stubsRes.data ?? []) as JournalStub[]
    const ids = stubs.map((s) => s.id)
    let additional: JournalAdditionalLine[] = []
    let deductions: JournalDeduction[] = []
    let payments: JournalPayment[] = []
    if (ids.length > 0) {
      const [aRes, dRes, pRes] = await Promise.all([
        supabase.from('pay_stub_additional_lines').select('pay_stub_id, description, line_total').in('pay_stub_id', ids),
        supabase.from('pay_stub_deductions').select('pay_stub_id, description, amount').in('pay_stub_id', ids),
        supabase.from('pay_stub_payments').select('pay_stub_id, amount, paid_at, memo').in('pay_stub_id', ids),
      ])
      additional = (aRes.data ?? []) as JournalAdditionalLine[]
      deductions = (dRes.data ?? []) as JournalDeduction[]
      payments = (pRes.data ?? []) as JournalPayment[]
    }
    const pendRes = await supabase
      .from('person_offsets')
      .select('type, amount, occurred_date, description')
      .eq('person_id', personId)
      .is('pay_stub_id', null)
    const journal = buildPartnerJournal({ stubs, additional, deductions, payments })
    setRows(journal.rows)
    setBalance(journal.balance)
    const pendList = ((pendRes.data ?? []) as JournalPendingOffset[]) || []
    setPending(summarizePendingOffsets(pendList))
    setPendingRows([...pendList].sort((a, b) => b.occurred_date.localeCompare(a.occurred_date)))
  }, [personId])

  useEffect(() => {
    setRows(null)
    void load()
  }, [load])

  if (rows == null) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }
  if (failed) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        Couldn’t load the ledger — check payroll access and that the PR 3 migration is pushed.
      </p>
    )
  }

  const net = netPosition(balance, pending.net)
  const displayRows = mergePendingIntoJournal(rows, pendingRows)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', margin: '0.25rem 0 0.5rem' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: net < 0 ? 'var(--text-red-600)' : undefined }}>
          {net < 0 ? '−' : ''}{money(net)}
        </span>
        {pending.count === 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>current balance (all postings − payouts)</span>
        ) : null}
      </div>

      {displayRows.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          Nothing posted yet — generate the first statement from the Statements tab.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['Date', 'Posting', 'Amount', 'Balance'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.5rem', borderBottom: '2px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Balance is computed oldest→newest; display newest-first so the
                  top row is today and its balance equals the headline. Pending
                  rows interleave by date but never carry a balance. */}
              {[...displayRows].reverse().map((r, i) =>
                r.kind === 'pending' ? (
                  <tr key={i}>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.date}</td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                      {r.label}
                      <span style={{ marginLeft: '0.45rem', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-amber-700)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.05rem 0.4rem', whiteSpace: 'nowrap' }}>
                        pending
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)', whiteSpace: 'nowrap', opacity: 0.85 }}>
                      {r.amount >= 0 ? '+' : '−'}{money(r.amount)}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>—</td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                      {r.label}
                      {r.detail ? <span style={{ color: 'var(--text-muted)' }}> · {r.detail}</span> : null}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)', whiteSpace: 'nowrap' }}>
                      {r.amount >= 0 ? '+' : '−'}{money(r.amount)}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {r.balance < 0 ? '−' : ''}{money(r.balance)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
        Newest first; each row’s balance is the running balance after that posting. Amber <b>pending</b> rows are
        charges waiting for the next statement — they sit at their date but move no balance until attached. Append-only:
        reversals are new rows, never edits. The weekly statement is a window over this journal.
      </p>
    </div>
  )
}
