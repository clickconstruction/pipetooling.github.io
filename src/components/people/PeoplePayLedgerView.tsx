import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { JournalRow } from '../../lib/partnerLedger/partnerLedgerJournal'
import { shortDate } from '../../lib/partnerLedger/partnerLedgerFormat'
import {
  buildAllPersonLedgers,
  buildPeopleLedgerRoster,
  ledgerEquationTerms,
  offsetTypeLabel,
  personKey,
  type LedgerOffset,
  type PersonLedger,
  type RosterGroup,
} from '../../lib/people/personLedger'
import type { PayStubPaymentRow } from '../../lib/payStubPayments'
import type { PayStubAdditionalLineRow, PayStubDeductionRow } from '../../lib/payStubDeductions'
import { AmountSmallCents } from '../AmountSmallCents'
import { PersonOffsetFormModal, type PersonOffsetEditingRow, type PersonOffsetInitialDraft } from '../pay/PersonOffsetFormModal'
import type { PayStubRow } from './PeoplePayStubsTab'

/**
 * People → Payroll → Ledger (v2.2168, dev-only prototype).
 *
 * Two levels: a roster of everyone on payroll ranked by what we owe them /
 * what they owe us (with a caption that says why), and — for the selected
 * person — one dated journal with a running balance: labor, payouts,
 * charges, credits, deductions, additions, all on the day they happened.
 * Same frame as the partnership Full ledger; same sign convention (+ = we owe
 * them). Math lives in src/lib/people/personLedger.ts.
 */

export type PeoplePayLedgerViewProps = {
  payStubs: PayStubRow[]
  payStubPaymentsByStubId: Record<string, PayStubPaymentRow[]>
  payStubDeductionsByStubId: Record<string, PayStubDeductionRow[]>
  payStubAdditionalByStubId: Record<string, PayStubAdditionalLineRow[]>
  /** Open the stub in the in-app viewer (labor row drill-in). */
  onViewStub: (stub: PayStubRow) => void
  /** Open the parent-owned Record-payment modal (unpaid / partial labor rows). */
  onRecordPayment: (stub: PayStubRow) => void
  onError: (msg: string | null) => void
  /** Parent-owned pay-stub data layer — the Reports tab loads it on mount; so does this view. */
  loadPayStubs: () => Promise<unknown>
}

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const moneyWhole = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
/** Small-cents money (v2.2252) for numeric display spots; the string `money()` above stays for prose sentences. */
const MoneySC = ({ n }: { n: number }) => <AmountSmallCents value={Math.abs(n)} />
const SignedBalanceSC = ({ n }: { n: number }) =>
  n > 0.005 ? <>+<MoneySC n={n} /></> : n < -0.005 ? <>−<MoneySC n={n} /></> : <MoneySC n={0} />
const balanceColor = (n: number) => (n > 0.005 ? '#16a34a' : n < -0.005 ? 'var(--text-red-600)' : 'var(--text-muted)')
const balanceWords = (name: string, n: number) => (n > 0.005 ? `we owe ${name}` : n < -0.005 ? `${name} owes us` : 'even')
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ymd: string) => {
  const m = /^(\d{4})-(\d{2})/.exec(ymd)
  return m ? `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : ymd
}

type RowKind = 'labor' | 'payout' | 'charge' | 'credit' | 'deduction' | 'addition'
function rowKind(r: JournalRow): RowKind {
  if (r.offset_id) return r.amount >= 0 ? 'credit' : 'charge'
  return r.kind
}
const KIND_LABEL: Record<RowKind, string> = { labor: 'Labor', payout: 'Paid out', charge: 'Charges', credit: 'Credits', deduction: 'Deductions', addition: 'Additions' }
const KIND_PILL: Record<RowKind, { bg: string; fg: string }> = {
  labor: { bg: 'rgba(37,99,235,0.14)', fg: 'var(--text-link)' },
  payout: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  charge: { bg: 'rgba(220,38,38,0.12)', fg: 'var(--text-red-600)' },
  credit: { bg: 'rgba(22,163,74,0.14)', fg: '#16a34a' },
  deduction: { bg: 'rgba(245,158,11,0.14)', fg: 'var(--text-amber-700)' },
  addition: { bg: 'rgba(22,163,74,0.14)', fg: '#16a34a' },
}

const ROW_CAP = 60

export default function PeoplePayLedgerView({ payStubs, payStubPaymentsByStubId, payStubDeductionsByStubId, payStubAdditionalByStubId, onViewStub, onRecordPayment, onError, loadPayStubs }: PeoplePayLedgerViewProps) {
  const isMobile = useIsMobile()
  const nowYear = new Date().getFullYear()
  const [searchParams, setSearchParams] = useSearchParams()
  const [offsets, setOffsets] = useState<LedgerOffset[] | null>(null)
  const [stubsLoaded, setStubsLoaded] = useState(false)
  const [rosterFilter, setRosterFilter] = useState<'all' | RosterGroup>('all')
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<RowKind | 'all'>('all')
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [offsetModal, setOffsetModal] = useState<{ editing: PersonOffsetEditingRow | null; draft: PersonOffsetInitialDraft | null } | null>(null)

  const loadOffsets = useCallback(async () => {
    try {
      const data = await withSupabaseRetry(
        async () => supabase.from('person_offsets').select('id, person_name, type, amount, occurred_date, description, pay_stub_id').order('occurred_date', { ascending: true }),
        'load person offsets for the payroll ledger',
      )
      setOffsets((data ?? []) as LedgerOffset[])
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load offsets')
      setOffsets([])
    }
  }, [onError])
  useEffect(() => {
    void loadOffsets()
  }, [loadOffsets])
  useEffect(() => {
    let alive = true
    void loadPayStubs().finally(() => {
      if (alive) setStubsLoaded(true)
    })
    return () => {
      alive = false
    }
    // mount-only, same as the Reports tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const loading = offsets == null || !stubsLoaded

  const ledgers = useMemo(() => {
    if (!offsets) return []
    const payments = Object.values(payStubPaymentsByStubId).flat()
    const deductions = Object.values(payStubDeductionsByStubId).flat()
    const additional = Object.values(payStubAdditionalByStubId).flat()
    return buildAllPersonLedgers({ stubs: payStubs, payments, deductions, additional, offsets })
  }, [offsets, payStubs, payStubPaymentsByStubId, payStubDeductionsByStubId, payStubAdditionalByStubId])
  const roster = useMemo(() => buildPeopleLedgerRoster(ledgers, moneyWhole), [ledgers])
  const ledgerByKey = useMemo(() => new Map(ledgers.map((l) => [l.key, l])), [ledgers])
  const stubById = useMemo(() => new Map(payStubs.map((s) => [s.id, s])), [payStubs])

  const selectedKey = searchParams.get('person') ? personKey(searchParams.get('person') ?? '') : null
  const selected: PersonLedger | null = selectedKey ? (ledgerByKey.get(selectedKey) ?? null) : null
  const select = (key: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (key) next.set('person', key)
    else next.delete('person')
    setSearchParams(next, { replace: true })
    setKindFilter('all')
    setUnpaidOnly(false)
    setShowAll(false)
  }

  const rosterRows = roster.rows.filter((r) => (rosterFilter === 'all' || r.group === rosterFilter) && (!search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())))

  // Journal rows for the selected person, newest first, filtered.
  const journalRows = useMemo(() => {
    if (!selected) return []
    const rows = [...selected.rows].reverse()
    return rows.filter((r) => {
      const k = rowKind(r)
      if (kindFilter !== 'all' && k !== kindFilter) return false
      if (unpaidOnly) {
        if (k !== 'labor' || !r.pay_stub_id) return false
        const st = selected.stubPay.get(r.pay_stub_id)
        return !!st && st.state !== 'paid'
      }
      return true
    })
  }, [selected, kindFilter, unpaidOnly])
  const visibleRows = showAll ? journalRows : journalRows.slice(0, ROW_CAP)

  /** Pill = the kind (Labor / Paid out / Back-charge / Damage / Credit / Deduction / Addition); label = the specifics. */
  const pillText = (r: JournalRow): string => {
    const k = rowKind(r)
    if ((k === 'charge' || k === 'credit') && r.offset_id) {
      const o = selected?.offsetsById.get(r.offset_id)
      if (o) return offsetTypeLabel(o.type)
    }
    return KIND_LABEL[k].replace(/s$/, '')
  }
  const rowLabel = (r: JournalRow): { main: string; sub: string | null; tag: { text: string; color: string } | null } => {
    const k = rowKind(r)
    if (k === 'labor' && r.pay_stub_id) {
      const s = stubById.get(r.pay_stub_id)
      const st = selected?.stubPay.get(r.pay_stub_id)
      const main = `${(r.hours ?? s?.hours_total ?? 0).toFixed(2)} h`
      const sub = s ? `week of ${shortDate(s.period_start, nowYear)}` : null
      const tag = st
        ? st.state === 'unpaid'
          ? { text: 'unpaid', color: 'var(--text-amber-700)' }
          : st.state === 'partial'
            ? { text: `partial · ${money(st.remaining)} left`, color: 'var(--text-amber-700)' }
            : { text: 'paid', color: 'var(--text-muted)' }
        : null
      return { main, sub, tag }
    }
    if (k === 'payout') return { main: r.detail?.trim() || 'Payment', sub: null, tag: null }
    return { main: r.label, sub: r.detail, tag: null }
  }

  const onRowClick = (r: JournalRow) => {
    const k = rowKind(r)
    if (k === 'labor' && r.pay_stub_id) {
      const s = stubById.get(r.pay_stub_id)
      if (s) onViewStub(s)
      return
    }
    if ((k === 'charge' || k === 'credit') && r.offset_id && selected) {
      const o = selected.offsetsById.get(r.offset_id)
      if (o) setOffsetModal({ editing: { id: o.id, person_name: o.person_name, type: o.type, amount: o.amount, description: o.description, occurred_date: o.occurred_date }, draft: null })
    }
  }
  const openCreate = (type: 'backcharge' | 'employee_credit') => {
    if (!selected) return
    setOffsetModal({ editing: null, draft: { personName: selected.name, type, amount: '', description: '', occurredDate: new Date().toLocaleDateString('en-CA') } })
  }

  const rosterPanel = (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 0.85rem', alignSelf: 'start', position: isMobile ? undefined : 'sticky', top: isMobile ? undefined : '0.5rem', maxHeight: isMobile ? undefined : 'calc(100vh - 1rem)', overflowY: isMobile ? undefined : 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <b style={{ fontSize: '0.95rem' }}>Balances</b>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{roster.rows.length} people</span>
      </div>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        We owe <b style={{ color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}><MoneySC n={roster.totals.oweAmount} /></b> across {roster.totals.oweCount} · owed to us{' '}
        <b style={{ color: 'var(--text-red-600)', fontVariantNumeric: 'tabular-nums' }}><MoneySC n={roster.totals.owedAmount} /></b> across {roster.totals.owedCount} · {roster.totals.evenCount} even
      </p>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
        {(
          [
            ['all', `All ${roster.rows.length}`],
            ['owe', `We owe ${roster.totals.oweCount}`],
            ['owed', `Owes us ${roster.totals.owedCount}`],
            ['even', `Even ${roster.totals.evenCount}`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setRosterFilter(v)}
            aria-pressed={rosterFilter === v}
            style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 999, border: '1px solid var(--border)', background: rosterFilter === v ? 'var(--bg-muted)' : 'transparent', color: rosterFilter === v ? 'var(--text-strong)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search people…"
        aria-label="Search people"
        style={{ width: '100%', font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', marginBottom: '0.4rem' }}
      />
      {loading ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : rosterRows.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No one matches.</p>
      ) : (
        (['owe', 'owed', 'even'] as RosterGroup[]).map((g) => {
          const rows = rosterRows.filter((r) => r.group === g)
          if (rows.length === 0) return null
          return (
            <Fragment key={g}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, margin: '0.6rem 0.3rem 0.15rem' }}>
                {g === 'owe' ? 'We owe' : g === 'owed' ? 'Owes us' : 'Even'}
              </div>
              {rows.map((r) => {
                const sel = r.key === selectedKey
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => select(r.key)}
                    aria-pressed={sel}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', width: '100%', textAlign: 'left', font: 'inherit', padding: '0.45rem 0.5rem', borderRadius: 8, border: 'none', borderBottom: sel ? '1px solid transparent' : '1px solid var(--border)', background: sel ? 'var(--bg-muted)' : 'transparent', color: 'var(--text)', cursor: 'pointer' }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.name}</span>
                      <span title={r.caption} style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.caption}</span>
                    </span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: balanceColor(r.balance) }}><SignedBalanceSC n={r.balance} /></span>
                      {r.lastPostingDate ? <span style={{ display: 'block', fontSize: '0.64rem', color: 'var(--text-muted)' }}>{shortDate(r.lastPostingDate, nowYear)}</span> : null}
                    </span>
                  </button>
                )
              })}
            </Fragment>
          )
        })
      )}
    </div>
  )

  const journalPanel = selected ? (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.85rem 1rem', minWidth: 0 }}>
      {isMobile ? (
        <button type="button" onClick={() => select(null)} style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', marginBottom: '0.4rem' }}>
          ‹ All balances
        </button>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selected.name}</h3>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {selected.counts.stubs} stub{selected.counts.stubs === 1 ? '' : 's'}
            {selected.firstPeriodStart ? ` · ${shortDate(selected.firstPeriodStart, nowYear)} → ${shortDate(selected.lastPeriodStart ?? selected.firstPeriodStart, nowYear)}` : ''}
            {' · '}
            {selected.counts.offsets} offset{selected.counts.offsets === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: balanceColor(selected.balance) }}><SignedBalanceSC n={selected.balance} /></div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{balanceWords(selected.name, selected.balance)}</div>
        </div>
      </div>

      {/* The equation: how the balance is built, zero terms dropped. */}
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem', margin: '0.6rem 0', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {ledgerEquationTerms(selected).map((t, i) => (
          <span key={t.label}>
            {i === 0 ? (t.sign === '−' ? '− ' : '') : ` ${t.sign} `}
            {t.label} <b style={{ color: 'var(--text)' }}><MoneySC n={t.amount} /></b>
          </span>
        ))}
        {' = '}
        <b style={{ color: balanceColor(selected.balance) }}><SignedBalanceSC n={selected.balance} /></b>
      </div>

      {selected.unpaid.count > 0 || selected.unpaid.partialCount > 0 ? (
        <div style={{ fontSize: '0.74rem', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: 'var(--text-amber-700)', borderRadius: 8, padding: '0.4rem 0.6rem', marginBottom: '0.6rem' }}>
          {selected.unpaid.count > 0 ? `${selected.unpaid.count} stub${selected.unpaid.count === 1 ? '' : 's'} unpaid · ${money(selected.unpaid.amount)}` : ''}
          {selected.unpaid.count > 0 && selected.unpaid.partialCount > 0 ? ' · ' : ''}
          {selected.unpaid.partialCount > 0 ? `${selected.unpaid.partialCount} partially paid · ${money(selected.unpaid.partialRemaining)} remaining` : ''}
          {selected.unpaid.oldestPeriodStart ? ` · oldest week of ${shortDate(selected.unpaid.oldestPeriodStart, nowYear)}` : ''}
          {(() => {
            // The "so what": where the balance lands once the open stubs are paid.
            const after = Math.round((selected.balance - selected.unpaid.amount - selected.unpaid.partialRemaining) * 100) / 100
            if (selected.balance < -0.005) return ` — paying them would leave ${selected.name} owing ${money(after)}`
            if (after > 0.005) return ` — paying them would still leave us owing ${money(after)}`
            return ' — paying them settles up'
          })()}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <button type="button" onClick={() => openCreate('backcharge')} style={{ font: 'inherit', fontSize: '0.76rem', fontWeight: 650, padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}>
          + Charge
        </button>
        <button type="button" onClick={() => openCreate('employee_credit')} style={{ font: 'inherit', fontSize: '0.76rem', fontWeight: 650, padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}>
          + Credit
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {(['all', 'labor', 'payout', 'charge', 'credit', 'deduction', 'addition'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            aria-pressed={kindFilter === k}
            style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 999, border: '1px solid var(--border)', background: kindFilter === k ? 'var(--bg-muted)' : 'transparent', color: kindFilter === k ? 'var(--text-strong)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            {k === 'all' ? 'All' : KIND_LABEL[k]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setUnpaidOnly((v) => !v)}
          aria-pressed={unpaidOnly}
          style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 999, border: '1px solid var(--border)', background: unpaidOnly ? 'rgba(245,158,11,0.14)' : 'transparent', color: unpaidOnly ? 'var(--text-amber-700)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          Unpaid only
        </button>
      </div>

      {journalRows.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nothing posted{kindFilter !== 'all' || unpaidOnly ? ' for this filter' : ' yet'}.</p>
      ) : isMobile ? (
        <div>
          {visibleRows.map((r, i) => {
            const k = rowKind(r)
            const { main, sub, tag } = rowLabel(r)
            const prev = visibleRows[i - 1]
            const newMonth = !prev || monthLabel(prev.date) !== monthLabel(r.date)
            const clickable = k === 'labor' || k === 'charge' || k === 'credit'
            return (
              <Fragment key={i}>
                {newMonth ? <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0.5rem 0 0.15rem' }}>{monthLabel(r.date)}</div> : null}
                <div role={clickable ? 'button' : undefined} onClick={clickable ? () => onRowClick(r) : undefined} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', cursor: clickable ? 'pointer' : 'default' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{shortDate(r.date, nowYear)}</span>
                    <span style={{ display: 'block' }}>
                      <span style={{ display: 'inline-block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0.35rem', borderRadius: 4, marginRight: '0.35rem', background: KIND_PILL[k].bg, color: KIND_PILL[k].fg }}>{pillText(r)}</span>
                      {main}
                      {sub ? <span style={{ color: 'var(--text-muted)' }}> · {sub}</span> : null}
                      {tag ? <span style={{ color: tag.color }}> · {tag.text}</span> : null}
                      {tag && tag.text !== 'paid' && r.pay_stub_id ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); const s = stubById.get(r.pay_stub_id!); if (s) onRecordPayment(s) }} style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 650, marginLeft: '0.4rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}>record payment</button>
                      ) : null}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ display: 'block', fontWeight: 600, color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)' }}>{r.amount >= 0 ? '+' : '−'}<MoneySC n={r.amount} /></span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>bal <SignedBalanceSC n={r.balance} /></span>
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                {['Date', 'Posting', 'Amount', 'Balance'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.3rem 0.4rem', borderBottom: '2px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                const k = rowKind(r)
                const { main, sub, tag } = rowLabel(r)
                const prev = visibleRows[i - 1]
                const newMonth = !prev || monthLabel(prev.date) !== monthLabel(r.date)
                const clickable = k === 'labor' || k === 'charge' || k === 'credit'
                const unpaidRow = tag != null && tag.text !== 'paid'
                return (
                  <Fragment key={i}>
                    {newMonth ? (
                      <tr>
                        <td colSpan={4} style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0.45rem 0.4rem 0.1rem', background: 'var(--bg-muted)' }}>{monthLabel(r.date)}</td>
                      </tr>
                    ) : null}
                    <tr
                      onClick={clickable ? () => onRowClick(r) : undefined}
                      title={clickable ? (k === 'labor' ? 'Open this stub' : 'Edit this offset') : undefined}
                      style={{ cursor: clickable ? 'pointer' : 'default', background: unpaidRow ? 'rgba(245,158,11,0.06)' : undefined }}
                    >
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{shortDate(r.date, nowYear)}</td>
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0.35rem', borderRadius: 4, marginRight: '0.4rem', verticalAlign: '1px', background: KIND_PILL[k].bg, color: KIND_PILL[k].fg }}>{pillText(r)}</span>
                        {main}
                        {sub ? <span style={{ color: 'var(--text-muted)' }}> · {sub}</span> : null}
                        {tag ? <span style={{ color: tag.color }}> · {tag.text}</span> : null}
                        {tag && tag.text !== 'paid' && r.pay_stub_id ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); const s = stubById.get(r.pay_stub_id!); if (s) onRecordPayment(s) }} style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 650, marginLeft: '0.5rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}>record payment</button>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap', color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)' }}>
                        {r.amount >= 0 ? '+' : '−'}<MoneySC n={r.amount} />
                      </td>
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        <SignedBalanceSC n={r.balance} />
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {journalRows.length > ROW_CAP && !showAll ? (
        <button type="button" onClick={() => setShowAll(true)} style={{ display: 'block', margin: '0.5rem auto 0', font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}>
          Show all {journalRows.length} rows
        </button>
      ) : null}
      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
        Newest first. Everything books on the day it happened — labor on the stub's week end, payouts when paid, charges and credits on their date. Click a labor row to open the stub; click a charge or credit to edit it.
      </p>
    </div>
  ) : (
    <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'start' }}>
      Pick a person to see their ledger — every stub, payout, charge and credit, dated, with the running balance.
    </div>
  )

  return (
    <section>
      <div style={{ marginBottom: '0.6rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Ledger</h2>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '62ch' }}>
          What we owe each person on payroll, and why — one dated journal per person with a running balance. <b>+</b> means we owe them, <b>−</b> means they owe us.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px minmax(0, 1fr)', gap: '0.9rem', alignItems: 'start' }}>
        {isMobile && selected ? null : rosterPanel}
        {isMobile && !selected ? null : journalPanel}
      </div>
      {offsetModal ? (
        <PersonOffsetFormModal
          open
          zIndex={1150}
          editingOffset={offsetModal.editing}
          initialCreateDraft={offsetModal.draft}
          personNameOptions={roster.rows.map((r) => r.name)}
          onClose={() => setOffsetModal(null)}
          onSaved={() => {
            setOffsetModal(null)
            void loadOffsets()
          }}
          onError={(m) => onError(m)}
        />
      ) : null}
    </section>
  )
}
