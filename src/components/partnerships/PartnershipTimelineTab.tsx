import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import {
  buildPartnerJournal,
  type JournalAdditionalLine,
  type JournalDeduction,
  type JournalPayment,
  type JournalStub,
} from '../../lib/partnerLedger/partnerLedgerJournal'
import {
  buildPartnerTimeline,
  filterPartnerTimeline,
  type PartnerTimelineFilter,
  type PartnerTimelineRow,
  type TimelineEventInputs,
} from '../../lib/partnerLedger/partnerTimeline'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Partnerships → Timeline tab (owner-approved mockup): money, infractions,
 * and job/statement events in ONE newest-first stream, with filter chips and
 * a quick-add charge row. Sits BESIDE the Ledger tab (which stays the strict
 * money journal).
 *
 * Dev-only lens over existing records — quick-added charges are ordinary
 * person_offsets rows, so they appear in People → Offsets identically and
 * attach to the next generated statement like any other pending offset. NCNS
 * rows come from Write-ups (attendance_incidents), declines from the Sub
 * Board (step_commitments). The partner's own surfaces never render NCNS or
 * declines.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const MARK: Record<PartnerTimelineRow['kind'], { text: string; bg: string; fg: string }> = {
  labor: { text: '$', bg: 'var(--bg-subtle)', fg: '#16a34a' },
  addition: { text: '%', bg: 'var(--bg-subtle)', fg: '#16a34a' },
  deduction: { text: '!', bg: 'var(--bg-muted)', fg: 'var(--text-red-600)' },
  payout: { text: '→', bg: 'var(--bg-muted)', fg: 'var(--text-700)' },
  charge_pending: { text: '!', bg: 'var(--bg-muted)', fg: 'var(--text-red-600)' },
  ncns: { text: '⚠', bg: 'var(--bg-muted)', fg: 'var(--text-amber-700)' },
  decline: { text: '✕', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  job: { text: '✓', bg: 'var(--bg-subtle)', fg: 'var(--text-link)' },
  stmt: { text: '§', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
}

const FILTERS: [PartnerTimelineFilter, string][] = [
  ['all', 'All'],
  ['money', 'Money'],
  ['infractions', 'Infractions'],
  ['events', 'Jobs & statements'],
]

const CHARGE_TYPES = [
  ['backcharge', 'Back-charge'],
  ['damage', 'Damage'],
  ['utility_overage', 'Utility overage'],
] as const

export function PartnershipTimelineTab({
  personId,
  personName,
}: {
  personId: string
  personName: string
}) {
  const [rows, setRows] = useState<PartnerTimelineRow[] | null>(null)
  const [filter, setFilter] = useState<PartnerTimelineFilter>('all')
  const [failed, setFailed] = useState(false)
  const [addType, setAddType] = useState('backcharge')
  const [addAmount, setAddAmount] = useState('')
  const [addDate, setAddDate] = useState(() => todayYmdInAppTz())
  const [addDesc, setAddDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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
    let acks: { pay_stub_id: string; party: string; acknowledged_at: string }[] = []
    if (ids.length > 0) {
      const [aRes, dRes, pRes, ackRes] = await Promise.all([
        supabase.from('pay_stub_additional_lines').select('pay_stub_id, description, line_total').in('pay_stub_id', ids),
        supabase.from('pay_stub_deductions').select('pay_stub_id, description, amount').in('pay_stub_id', ids),
        supabase.from('pay_stub_payments').select('pay_stub_id, amount, paid_at, memo').in('pay_stub_id', ids),
        supabase.from('statement_acknowledgments').select('pay_stub_id, party, acknowledged_at').in('pay_stub_id', ids),
      ])
      additional = (aRes.data ?? []) as JournalAdditionalLine[]
      deductions = (dRes.data ?? []) as JournalDeduction[]
      payments = (pRes.data ?? []) as JournalPayment[]
      acks = (ackRes.data ?? []) as typeof acks
    }
    const [pendRes, personRes, jobsRes] = await Promise.all([
      supabase
        .from('person_offsets')
        .select('type, amount, occurred_date, description')
        .eq('person_id', personId)
        .is('pay_stub_id', null),
      supabase.from('people').select('account_user_id').eq('id', personId).single(),
      supabase
        .from('jobs_ledger')
        .select('hcp_number, click_number, job_name, partner_confirmed_at, service_types(name)')
        .eq('partner_person_id', personId)
        .not('partner_confirmed_at', 'is', null),
    ])
    const user = (personRes.data as { account_user_id: string | null } | null)?.account_user_id ?? null
    let ncns: TimelineEventInputs['ncns'] = []
    if (user) {
      const nRes = await supabase
        .from('attendance_incidents')
        .select('work_date, details')
        .eq('subject_user_id', user)
        .eq('incident_type', 'no_call_no_show')
        .order('work_date', { ascending: false })
        .limit(100)
      ncns = nRes.error ? [] : ((nRes.data ?? []) as TimelineEventInputs['ncns'])
    }
    const decRes = await supabase
      .from('step_commitments')
      .select('declined_at, decline_reason, amount')
      .eq('person_id', personId)
      .not('declined_at', 'is', null)
      .order('declined_at', { ascending: false })
      .limit(50)

    const journal = buildPartnerJournal({ stubs, additional, deductions, payments }).rows
    const events: TimelineEventInputs = {
      pendingCharges: (pendRes.data ?? []) as TimelineEventInputs['pendingCharges'],
      ncns,
      declines: decRes.error ? [] : ((decRes.data ?? []) as TimelineEventInputs['declines']),
      confirmedJobs: ((jobsRes.data ?? []) as { hcp_number: string | null; click_number: string | null; job_name: string | null; partner_confirmed_at: string | null; service_types: { name: string } | null }[]).map(
        (j) => ({
          label: j.hcp_number?.trim() || j.click_number?.trim() || j.job_name?.trim() || '—',
          confirmed_at: j.partner_confirmed_at,
          service_type_name: j.service_types?.name ?? null,
        }),
      ),
      statements: stubs.map((s) => ({
        period_start: s.period_start,
        period_end: s.period_end,
        partner_ack_at: acks.find((a) => a.pay_stub_id === s.id && a.party === 'partner')?.acknowledged_at ?? null,
        company_ack_at: acks.find((a) => a.pay_stub_id === s.id && a.party === 'company')?.acknowledged_at ?? null,
      })),
    }
    setRows(buildPartnerTimeline(journal, events))
  }, [personId])

  useEffect(() => {
    setRows(null)
    void load()
  }, [load])

  async function addCharge() {
    const amt = Number(addAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Amount must be a positive number')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('person_offsets')
            .insert({
              person_name: personName,
              person_id: personId,
              type: addType,
              amount: amt,
              description: addDesc.trim() || null,
              occurred_date: addDate,
            })
            .select('id')
            .single(),
        'add partner charge',
      )
      setAddAmount('')
      setAddDesc('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add the charge')
    } finally {
      setBusy(false)
    }
  }

  if (rows == null) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }
  if (failed) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        Couldn’t load the timeline — check payroll access and pushed migrations.
      </p>
    )
  }

  const visible = filterPartnerTimeline(rows, filter)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', margin: '0.25rem 0 0.5rem' }}>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              font: 'inherit',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.15rem 0.65rem',
              borderRadius: 999,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: filter === key ? '#2563eb' : 'var(--border)',
              background: filter === key ? '#2563eb' : 'var(--surface)',
              color: filter === key ? 'var(--surface)' : 'var(--text-700)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Quick-add charge — writes person_offsets, so it shows in People →
          Offsets identically and attaches to the next statement. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', padding: '0.45rem 0 0.6rem', borderBottom: '1px solid var(--border)' }}>
        <select value={addType} onChange={(e) => setAddType(e.target.value)} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.28rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}>
          {CHARGE_TYPES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <input type="number" inputMode="decimal" placeholder="0.00" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.28rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', width: '6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
        <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.28rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
        <input type="text" placeholder='e.g. "No-show 8/19 — return trip, Job 774"' value={addDesc} onChange={(e) => setAddDesc(e.target.value)} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.28rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', flex: '1 1 220px', minWidth: 0 }} />
        <button type="button" disabled={busy} onClick={() => void addCharge()} style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.3rem 0.7rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'var(--surface)', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          Add charge
        </button>
      </div>
      {err ? <p style={{ fontSize: '0.75rem', color: 'var(--text-red-600)', margin: '0.35rem 0 0' }}>{err}</p> : null}

      {visible.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>Nothing here yet for this filter.</p>
      ) : (
        visible.map((r, i) => {
          const m = MARK[r.kind]
          const pill = r.trade ? buildServiceTypeTradePill(r.trade) : null
          return (
            <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.45rem 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', width: '4.6rem', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '0.15rem', fontVariantNumeric: 'tabular-nums' }}>{r.date}</span>
              <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, background: m.bg, color: m.fg }} aria-hidden="true">
                {m.text}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: 'var(--text-700)' }}>
                {pill ? <span style={{ ...pill.style, marginTop: 0, marginRight: '0.4rem', verticalAlign: '1px' }}>{pill.label}</span> : null}
                {r.label}
                {r.sub ? <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.sub}</span> : null}
              </span>
              {r.amount != null ? (
                <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontWeight: 650, fontSize: '0.84rem', color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)' }}>
                  {r.amount >= 0 ? '+' : '−'}
                  {money(r.amount)}
                </span>
              ) : null}
              <span style={{ flex: 'none', width: '5.2rem', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {r.balance != null ? `${r.balance < 0 ? '−' : ''}${money(r.balance)}` : ''}
              </span>
            </div>
          )
        })
      )}
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
        Newest first. Money rows carry the running balance; infractions and events sit inline without touching it.
        Dev-only: {personName}’s own view never shows NCNS or declines — charges reach them only as statement
        deductions. Log new NCNS in People → Write-ups; declines record automatically from dispatch.
      </p>
    </div>
  )
}
