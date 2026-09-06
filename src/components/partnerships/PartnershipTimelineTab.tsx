import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { balanceBridgeText, balanceConventionTitle, officeBalanceWords, partnerStubsToPostedJournal } from '../../lib/partnerLedger/partnerBalance'
import { useOfficePartnerLedger } from '../../hooks/useOfficePartnerLedger'
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
 *
 * Money rows come from the SAME `get_partner_ledger_as` payload the Ledger tab
 * and the partner's statement read (useOfficePartnerLedger) — one journal.
 * The running column here is the statement-posted chain; the headline says
 * who owes whom and how the pending charges bridge it to the Ledger's number.
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
  partnershipId,
  personId,
  personName,
}: {
  partnershipId: string
  personId: string
  personName: string
}) {
  const ledger = useOfficePartnerLedger(partnershipId, personId)
  const [events, setEvents] = useState<Omit<TimelineEventInputs, 'pendingCharges' | 'statements'> | null>(null)
  const [filter, setFilter] = useState<PartnerTimelineFilter>('all')
  const [failed, setFailed] = useState(false)
  const [addType, setAddType] = useState('backcharge')
  const [addAmount, setAddAmount] = useState('')
  const [addDate, setAddDate] = useState(() => todayYmdInAppTz())
  const [addDesc, setAddDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Accountability trails (NCNS, declines, confirmed jobs) — the office-only
  // side of the stream; money and statements ride the shared payload.
  const loadEvents = useCallback(async () => {
    const [personRes, jobsRes, decRes] = await Promise.all([
      supabase.from('people').select('account_user_id').eq('id', personId).single(),
      supabase
        .from('jobs_ledger')
        .select('hcp_number, click_number, job_name, partner_confirmed_at, service_types(name)')
        .eq('partner_person_id', personId)
        .not('partner_confirmed_at', 'is', null),
      supabase
        .from('step_commitments')
        .select('declined_at, decline_reason, amount')
        .eq('person_id', personId)
        .not('declined_at', 'is', null)
        .order('declined_at', { ascending: false })
        .limit(50),
    ])
    if (personRes.error && jobsRes.error && decRes.error) {
      setFailed(true)
      setEvents({ ncns: [], declines: [], confirmedJobs: [] })
      return
    }
    setFailed(false)
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
    setEvents({
      ncns,
      declines: decRes.error ? [] : ((decRes.data ?? []) as TimelineEventInputs['declines']),
      confirmedJobs: ((jobsRes.data ?? []) as { hcp_number: string | null; click_number: string | null; job_name: string | null; partner_confirmed_at: string | null; service_types: { name: string } | null }[]).map(
        (j) => ({
          label: j.hcp_number?.trim() || j.click_number?.trim() || j.job_name?.trim() || '—',
          confirmed_at: j.partner_confirmed_at,
          service_type_name: j.service_types?.name ?? null,
        }),
      ),
    })
  }, [personId])

  useEffect(() => {
    setEvents(null)
    void loadEvents()
  }, [loadEvents])

  const rows = useMemo<PartnerTimelineRow[] | null>(() => {
    if (ledger.status !== 'ok' || events == null) return null
    const journal = partnerStubsToPostedJournal(ledger.stubs).rows
    return buildPartnerTimeline(journal, {
      ...events,
      pendingCharges: ledger.pending,
      statements: ledger.stubs.map((s) => ({
        period_start: s.period_start,
        period_end: s.period_end,
        partner_ack_at: s.partner_ack_at,
        company_ack_at: s.company_ack_at,
      })),
    })
  }, [ledger.status, ledger.stubs, ledger.pending, events])

  const { reload } = ledger
  const load = useCallback(async () => {
    await Promise.all([reload(), loadEvents()])
  }, [reload, loadEvents])

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

  if (ledger.status === 'failed' || failed) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        Couldn’t load the timeline — check dev access and pushed migrations.
      </p>
    )
  }
  if (rows == null) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }
  if (!ledger.exists) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
        This partnership is paused or ended, so its money is hidden — the same nothing {personName} sees. Set it back
        to active on the Deal tab to read it.
      </p>
    )
  }

  const visible = filterPartnerTimeline(rows, filter)
  const posted = ledger.split.postedBalance

  return (
    <div>
      {/* Who owes whom, in words — the running column below is the
          statement-posted chain; the caption bridges it to the Ledger tab. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', margin: '0.25rem 0 0.5rem' }}>
        <span
          title={balanceConventionTitle(personName)}
          style={{ fontSize: '1.4rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: posted < 0 ? 'var(--text-red-600)' : undefined }}
        >
          {posted < 0 ? '−' : ''}{money(posted)}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 650, color: posted < 0 ? 'var(--text-red-600)' : posted > 0 ? '#16a34a' : 'var(--text-muted)' }}>
          {officeBalanceWords(posted, personName)}
        </span>
        <span title={balanceConventionTitle(personName)} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {ledger.split.pendingCount === 0
            ? 'posted balance · nothing pending, so the Ledger tab says the same'
            : balanceBridgeText(ledger.split, personName)}
        </span>
      </div>
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
        Newest first. Money rows carry the running balance of what statements have posted (+ we owe {personName}, − {personName} owes us);
        pending charges sit inline without touching it until a statement attaches them. Infractions and events never move it.
        Dev-only: {personName}’s own view never shows NCNS or declines — charges reach them only as statement
        deductions. Log new NCNS in People → Write-ups; declines record automatically from dispatch.
      </p>
    </div>
  )
}
