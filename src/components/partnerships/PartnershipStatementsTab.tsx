import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import { pendingOffsetSignedAmount } from '../../lib/partnerLedger/partnerLedgerJournal'
import { planStatementClose } from '../../lib/partnerLedger/statementCloseWeeks'

/**
 * Partnerships → Statements tab (PARTNERSHIPS_PLAN.md PR 3): the weekly
 * statement's office-side home. Close the previous Sun–Sat week (guarded by
 * generate_partner_statement — unapproved sessions / unreviewed jobs block
 * unless the logged override), then track the archive: hours, gross, both §9b
 * acknowledgment chips, and payments against each statement.
 *
 * Reads ride the dev's payroll-access RLS on the pay_stubs family — no extra
 * RPCs needed office-side. Fail-soft before the PR 3 migration is pushed.
 */

type StubRow = {
  id: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
  paid_at: string | null
}
type PendingOffsetRow = { id: string; type: string; amount: number; occurred_date: string; description: string | null }
type AckRow = { pay_stub_id: string; party: string; acknowledged_at: string }
type PaymentRow = { pay_stub_id: string; amount: number }

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PartnershipStatementsTab({
  partnershipId,
  personId,
  personName,
  weeklyStatementOn,
}: {
  partnershipId: string
  personId: string
  personName: string
  weeklyStatementOn: boolean
}) {
  const [stubs, setStubs] = useState<StubRow[] | null>(null)
  const [acks, setAcks] = useState<AckRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [pendingOffsets, setPendingOffsets] = useState<PendingOffsetRow[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [loadFailed, setLoadFailed] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [override, setOverride] = useState(false)
  const [genMessage, setGenMessage] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const closePlan = useMemo(
    () => planStatementClose((stubs ?? []).map((s) => s.period_start), getDefaultWeekRange().start),
    [stubs],
  )

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pay_stubs')
      .select('id, period_start, period_end, hours_total, gross_pay, paid_at')
      .eq('person_id', personId)
      .order('period_start', { ascending: false })
      .limit(30)
    if (error) {
      setLoadFailed(true)
      setStubs([])
      return
    }
    setLoadFailed(false)
    const rows = (data ?? []) as StubRow[]
    setStubs(rows)
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id)
      const [ackRes, payRes] = await Promise.all([
        supabase.from('statement_acknowledgments').select('pay_stub_id, party, acknowledged_at').in('pay_stub_id', ids),
        supabase.from('pay_stub_payments').select('pay_stub_id, amount').in('pay_stub_id', ids),
      ])
      setAcks((ackRes.data ?? []) as AckRow[])
      setPayments((payRes.data ?? []) as PaymentRow[])
    } else {
      setAcks([])
      setPayments([])
    }
    const pendRes = await supabase
      .from('person_offsets')
      .select('id, type, amount, occurred_date, description')
      .eq('person_id', personId)
      .is('pay_stub_id', null)
      .order('occurred_date', { ascending: false })
    setPendingOffsets(((pendRes.data ?? []) as PendingOffsetRow[]) || [])
    setExcluded(new Set())
  }, [personId])

  useEffect(() => {
    setStubs(null)
    void load()
  }, [load])

  async function generate(weekStart: string) {
    setGenerating(true)
    setGenError(null)
    setGenMessage(null)
    // Partial selection passes the kept ids; full selection omits the param so
    // the call also works against a pre-selection server (fail-soft window).
    const kept = pendingOffsets.filter((o) => !excluded.has(o.id)).map((o) => o.id)
    const { data, error } = await supabase.rpc('generate_partner_statement', {
      p_partnership_id: partnershipId,
      p_week_start: weekStart,
      p_override: override,
      ...(excluded.size > 0 ? { p_offset_ids: kept } : {}),
    })
    if (error) {
      setGenError(error.message)
    } else {
      const d = (data ?? {}) as Record<string, unknown>
      setGenMessage(
        d.already === true
          ? 'Statement for that week already exists.'
          : `Generated: ${Number(d.hours_total ?? 0).toFixed(1)} h · ${money(Number(d.gross_pay ?? 0))} gross` +
            (Number(d.offsets_left_pending ?? 0) > 0 ? ` · ${d.offsets_left_pending} offset(s) left pending` : '') +
            (d.override === true ? ' · generated with override (logged)' : ''),
      )
      await load()
    }
    setGenerating(false)
  }

  if (!weeklyStatementOn) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
        Weekly statements are turned off for this partnership — enable them on the Deal tab.
      </p>
    )
  }
  if (stubs == null) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }

  const ackFor = (stubId: string, party: string) => acks.find((a) => a.pay_stub_id === stubId && a.party === party)
  const paidFor = (stubId: string) => payments.filter((p) => p.pay_stub_id === stubId).reduce((s, p) => s + Number(p.amount || 0), 0)

  return (
    <div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', marginTop: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 650, fontSize: '0.875rem' }}>
              {closePlan.target ? `Close week of ${closePlan.target}` : <>Week of {closePlan.prevWeek} closed ✓</>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {closePlan.target ? (
                <>
                  Sun–Sat · builds the statement from {personName}’s approved hours at the Deal-tab rates, attaches
                  pending offsets, and stamps your acknowledgment
                </>
              ) : (
                <>next close opens Sunday {closePlan.nextOpensOn}</>
              )}
            </div>
          </div>
          {closePlan.target || closePlan.olderUncovered.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                override guard (logged)
              </label>
              {closePlan.target ? (
                <button
                  type="button"
                  onClick={() => void generate(closePlan.target!)}
                  disabled={generating}
                  style={{ font: 'inherit', fontSize: '0.85rem', fontWeight: 650, padding: '0.4rem 0.8rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'var(--surface)', cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
                >
                  {generating ? 'Generating…' : 'Generate statement'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {(closePlan.target || closePlan.olderUncovered.length > 0) && pendingOffsets.length > 0 ? (
          <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Charges to put on this statement
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                attaching {pendingOffsets.length - excluded.size} of {pendingOffsets.length}
              </span>
            </div>
            {pendingOffsets.map((o) => {
              const amt = pendingOffsetSignedAmount(o)
              const checked = !excluded.has(o.id)
              return (
                <label
                  key={o.id}
                  style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.25rem 0', fontSize: '0.8rem', cursor: 'pointer', opacity: checked ? 1 : 0.55 }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setExcluded((prev) => {
                        const next = new Set(prev)
                        if (next.has(o.id)) next.delete(o.id)
                        else next.add(o.id)
                        return next
                      })
                    }
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {o.description || o.type}
                    <span style={{ color: 'var(--text-muted)' }}> · {o.occurred_date}</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650, whiteSpace: 'nowrap', color: amt < 0 ? 'var(--text-red-600)' : '#16a34a' }}>
                    {amt < 0 ? '−' : '+'}{money(Math.abs(amt))}
                  </span>
                </label>
              )
            })}
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Unchecked charges stay pending for a later statement. A statement can’t deduct below zero — anything that
              doesn’t fit stays pending automatically.
            </div>
          </div>
        ) : null}
        {closePlan.olderUncovered.length > 0 ? (
          <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Earlier weeks without a statement — generate if hours were worked:
            <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: '0.4rem', verticalAlign: 'middle' }}>
              {closePlan.olderUncovered.map((week) => (
                <button
                  key={week}
                  type="button"
                  onClick={() => void generate(week)}
                  disabled={generating}
                  style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 650, padding: '0.15rem 0.5rem', borderRadius: 999, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
                >
                  {week}
                </button>
              ))}
            </span>
          </div>
        ) : null}
        {genError ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-red-600)', margin: '0.5rem 0 0' }}>
            {genError.includes('not allowed') || genError.includes('function') ? (
              <>The statement RPC isn’t in the database yet — run <code>supabase db push</code> for migration <code>20260820160000_partner_statements.sql</code>.</>
            ) : (
              genError
            )}
          </p>
        ) : null}
        {genMessage ? <p style={{ fontSize: '0.8rem', color: '#16a34a', margin: '0.5rem 0 0' }}>{genMessage}</p> : null}
      </div>

      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '1rem 0 0.25rem' }}>
        Statement archive
      </div>
      {loadFailed ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: 0 }}>
          Couldn’t load statements — if the PR 3 migration hasn’t been pushed, run <code>supabase db push</code>.
        </p>
      ) : stubs.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No statements yet.</p>
      ) : (
        stubs.map((s) => {
          const co = ackFor(s.id, 'company')
          const pa = ackFor(s.id, 'partner')
          const paid = paidFor(s.id)
          return (
            <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem 0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <b>Week {s.period_start} – {s.period_end}</b>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {Number(s.hours_total).toFixed(1)} h · gross {money(Number(s.gross_pay))}
                  {paid > 0 ? ` · paid ${money(paid)}` : ''}
                </div>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: co ? '#16a34a' : 'var(--text-muted)' }}>
                {co ? 'company ✓' : 'company —'}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: pa ? '#16a34a' : 'var(--text-amber-700)' }}>
                {pa ? 'partner ✓' : 'awaiting partner'}
              </span>
            </div>
          )
        })
      )}
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
        Each closing balance opens the next week — the chain is the ledger (see the Ledger tab). The partner views and
        acknowledges the same records from their dashboard (ships in the next PR).
      </p>
    </div>
  )
}
