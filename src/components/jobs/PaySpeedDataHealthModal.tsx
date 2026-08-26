import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdSlash } from '../../lib/jobs/paySpeedsBreakdown'
import { billedAtIsoFromYmd } from '../../lib/jobs/billDateEntry'
import InlineBillDateEditor, { AddBillDateButton } from './InlineBillDateEditor'
import {
  filterBills,
  filterTxns,
  lensCounts,
  isBilledAfterPaid,
  missingInfoLabel,
  parsePaymentLineItemsBulk,
  parsePaySpeedTransactions,
  type DataHealthLens,
  type PaymentLineItems,
  type PaySpeedTransactions,
  type PaySpeedTxn,
} from '../../lib/jobs/paySpeedTransactions'

/**
 * The Data health drill-down (owner-approved mockup, v2.2290; declutter round
 * v2.2316): opened by clicking the strip in Pay speeds. Lists every 12-month
 * payment behind the strip's counts — filter pills per bucket + the
 * undated-bills backlog, search across customer / job / address. Rows show the
 * billed → paid pair the medians measure (column-labeled once, sent date on
 * hover), run two lines so the address is never truncated, and a missing bill
 * date is typed right into the row (MM/DD/YY, field hugs the text). Actions:
 * exclude from the pay-speed math (auditable; "Include again" undoes) or open
 * the job.
 */

const STATUS_CHIP: Record<PaySpeedTxn['status'], { bg: string; fg: string; label: (t: PaySpeedTxn) => string }> = {
  measurable: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', label: (t) => (t.gapDays != null ? `+${t.gapDays}d` : 'measurable') },
  unlinked: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', label: (t) => missingInfoLabel(t) },
  quarantined: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)', label: () => 'quarantined' },
  excluded: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', label: () => 'excluded' },
}

const LENSES: { key: DataHealthLens; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'measurable', label: 'Measurable' },
  { key: 'unlinked', label: 'Missing info' },
  { key: 'quarantined', label: 'Quarantined' },
  { key: 'excluded', label: 'Excluded' },
  { key: 'undated', label: 'Undated bills' },
]

export default function PaySpeedDataHealthModal({
  onClose,
  onOpenJobDetail,
  onOpenJobStacked,
  canExclude,
  isDev = false,
  onChanged,
}: {
  onClose: () => void
  /** Open a row's job detail (closes the modal stack upstream). */
  onOpenJobDetail?: (jobId: string) => void
  /**
   * Preferred (v2.2311): open the job's Bill tab STACKED ABOVE this modal —
   * the drill-down stays put (filters/search/scroll intact) and `onSaved`
   * refreshes the list + medians after any save inside the job.
   */
  onOpenJobStacked?: (jobId: string, onSaved: () => void) => void
  /** Devs + master techs can exclude/include and type missing bill dates; everyone else just reads. */
  canExclude: boolean
  /** Devs only: the ⚙ No Count Date setting (v2.2303). */
  isDev?: boolean
  /** Fired after an exclude/include or bill-date save lands so the medians refresh live. */
  onChanged?: () => void
}) {
  const { user: authUser, profileName } = useAuth()
  const [data, setData] = useState<PaySpeedTransactions | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [lens, setLens] = useState<DataHealthLens>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [gearOpen, setGearOpen] = useState(false)
  // Line items are always expanded (v2.2315): fetched in bulk (chunks of
  // 150) right after the list loads, rendered under every row as they land.
  const [lineItemsById, setLineItemsById] = useState<Record<string, PaymentLineItems>>({})
  const [lineItemsLoaded, setLineItemsLoaded] = useState(false)
  const [noCountDraft, setNoCountDraft] = useState('')
  const [savingNoCount, setSavingNoCount] = useState(false)
  // Inline bill-date editor (v2.2316), keyed by invoice id (works on payment
  // rows and undated-bill rows alike).
  const [dateEditId, setDateEditId] = useState<string | null>(null)
  const [savingDate, setSavingDate] = useState(false)

  async function load() {
    try {
      const { data: raw } = await supabase.rpc('get_pay_speed_transactions' as never)
      const parsed = parsePaySpeedTransactions(raw as unknown)
      setData(parsed)
      if (parsed) void loadLineItems(parsed.payments.map((t) => t.paymentId))
    } catch {
      setData(null)
    }
    setLoaded(true)
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => (data ? lensCounts(data) : null), [data])
  const txns = useMemo(() => (data ? filterTxns(data, lens, query) : []), [data, lens, query])
  const bills = useMemo(() => (data && lens === 'undated' ? filterBills(data, query) : []), [data, lens, query])


  async function saveNoCountDate(value: string | null) {
    if (!isDev || savingNoCount) return
    setSavingNoCount(true)
    const { error } =
      value == null
        ? await supabase.from('app_settings').delete().eq('key', 'pay_speed_no_count_date_v1')
        : await supabase
            .from('app_settings')
            .upsert({ key: 'pay_speed_no_count_date_v1', value_text: value }, { onConflict: 'key' })
    if (!error) {
      setGearOpen(false)
      await load()
      onChanged?.()
    }
    setSavingNoCount(false)
  }


  async function loadLineItems(paymentIds: string[]) {
    setLineItemsLoaded(false)
    for (let i = 0; i < paymentIds.length; i += 150) {
      const chunk = paymentIds.slice(i, i + 150)
      try {
        const { data: raw } = await supabase.rpc('get_payment_line_items_bulk' as never, { p_payment_ids: chunk } as never)
        const parsed = parsePaymentLineItemsBulk(raw as unknown)
        setLineItemsById((prev) => ({ ...prev, ...parsed }))
      } catch {
        // fail-soft: rows without data show a quiet placeholder
      }
    }
    setLineItemsLoaded(true)
  }

  function openJob(jobId: string) {
    if (onOpenJobStacked) {
      onOpenJobStacked(jobId, () => {
        void load()
        onChanged?.()
      })
    } else {
      onOpenJobDetail?.(jobId)
    }
  }

  async function toggleExclusion(t: PaySpeedTxn) {
    if (!canExclude || busyId != null) return
    setBusyId(t.paymentId)
    const q = supabase.from('pay_speed_exclusions' as never)
    const { error } =
      t.status === 'excluded'
        ? await q.delete().eq('payment_id', t.paymentId)
        : await q.insert({ payment_id: t.paymentId, excluded_by: authUser?.id ?? null, excluded_by_name: profileName || '' } as never)
    if (!error) {
      await load()
      onChanged?.()
    }
    setBusyId(null)
  }

  async function saveBillDate(invoiceId: string, ymd: string) {
    if (savingDate) return
    setSavingDate(true)
    const { error } = await supabase
      .from('jobs_ledger_invoices')
      .update({ billed_at: billedAtIsoFromYmd(ymd) })
      .eq('id', invoiceId)
    if (!error) {
      setDateEditId(null)
      await load()
      onChanged?.()
    }
    setSavingDate(false)
  }

  const pillStyle = (active: boolean): CSSProperties => ({
    border: `1px solid ${active ? 'var(--text-link)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-link)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-muted)',
    borderRadius: 9999,
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.18rem 0.65rem',
    cursor: 'pointer',
    fontVariantNumeric: 'tabular-nums',
  })
  const actStyle: CSSProperties = {
    border: 'none',
    background: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginTop: '0.1rem',
  }
  const chipStyle = (bg: string, fg: string): CSSProperties => ({
    fontSize: '0.64rem',
    fontWeight: 700,
    borderRadius: 9999,
    padding: '0 6px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    marginTop: '0.15rem',
    background: bg,
    color: fg,
  })

  function jobCell(customerName: string | null, jobName: string | null, address: string | null) {
    return (
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {customerName ? <span style={{ fontWeight: 650 }}>{customerName}</span> : <span style={{ color: 'var(--text-muted)' }}>no customer</span>}
          {jobName && <span style={{ color: 'var(--text-muted)' }}>{' · '}{jobName}</span>}
        </span>
        {address && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{address}</span>}
      </span>
    )
  }

  // Editor + button are the shared components (v2.2326) — same UI in the
  // Quickfill Missing bill dates station.
  function dateEditor(invoiceId: string) {
    return (
      <InlineBillDateEditor
        saving={savingDate}
        onSave={(ymd) => void saveBillDate(invoiceId, ymd)}
        onCancel={() => setDateEditId(null)}
      />
    )
  }

  function addDateButton(invoiceId: string) {
    return (
      <AddBillDateButton
        onClick={() => setDateEditId(invoiceId)}
        title="Type the bill date right here — the row becomes measurable on save"
      />
    )
  }

  const colHeadStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.55rem',
    padding: '0 0.45rem 0.25rem',
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Data health transactions"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          width: 'min(680px, calc(100vw - 1rem))',
          maxHeight: 'min(88vh, 900px)',
          overflowY: 'auto',
          padding: '1rem 1.1rem 1.1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Data health — the payments behind the numbers</h2>
          {isDev && (
            <button
              type="button"
              aria-label="Data health settings"
              aria-expanded={gearOpen}
              onClick={() => {
                setNoCountDraft(data?.noCountDate ?? '')
                setGearOpen((o) => !o)
              }}
              title="No Count Date and other dev settings"
              style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '0.95rem', cursor: 'pointer', lineHeight: 1, padding: '0.15rem' }}
            >
              ⚙
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close data health transactions"
            style={{ marginLeft: isDev ? 0 : 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', lineHeight: 1, padding: '0.15rem' }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: '0.3rem 0 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>
          Every recorded payment from the last 12 months. Excluding one drops it from the medians and the counts;
          opening the job is where dates and bill links get fixed.
        </p>

        {gearOpen && isDev && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-muted)',
              padding: '0.5rem 0.7rem',
              marginBottom: '0.7rem',
              fontSize: '0.78rem',
            }}
          >
            <span style={{ fontWeight: 650 }}>No Count Date</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
              payments received before this date don't count — anywhere
            </span>
            <input
              type="date"
              value={noCountDraft}
              onChange={(e) => setNoCountDraft(e.target.value)}
              aria-label="No Count Date"
              style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.25rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
            />
            <button
              type="button"
              disabled={savingNoCount || noCountDraft === ''}
              onClick={() => void saveNoCountDate(noCountDraft)}
              style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 650, padding: '0.25rem 0.7rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', opacity: savingNoCount || noCountDraft === '' ? 0.5 : 1 }}
            >
              {savingNoCount ? 'Saving…' : 'Save'}
            </button>
            {data?.noCountDate && (
              <button
                type="button"
                disabled={savingNoCount}
                onClick={() => void saveNoCountDate(null)}
                style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}
              >
                Clear — count everything
              </button>
            )}
          </div>
        )}

        {data?.noCountDate && !gearOpen && (
          <p style={{ margin: '-0.3rem 0 0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Not counting payments received before <b style={{ color: 'var(--text-700)' }}>{data.noCountDate}</b>
            {isDev ? ' — change it under ⚙' : ''}.
          </p>
        )}

        {!loaded ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : data == null ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            The transaction lookup isn’t available yet — reload once the update is live.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.55rem' }}>
              {LENSES.map((l) => (
                <button key={l.key} type="button" aria-pressed={lens === l.key} onClick={() => setLens(l.key)} style={pillStyle(lens === l.key)}>
                  {l.label} · {counts![l.key]}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer, job, or address…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                font: 'inherit',
                fontSize: '0.8rem',
                padding: '0.35rem 0.55rem',
                border: '1px solid var(--border)',
                borderRadius: 7,
                background: 'var(--surface)',
                color: 'inherit',
                marginBottom: '0.55rem',
              }}
            />

            {lens !== 'undated' ? (
              txns.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nothing matches.</p>
              ) : (
                <>
                <div style={colHeadStyle}>
                  <span style={{ width: '8.6em', flexShrink: 0 }}>billed → paid</span>
                  <span style={{ width: '4.6em', textAlign: 'right', flexShrink: 0 }}>amount</span>
                </div>
                {txns.map((t, i) => {
                  const chip = STATUS_CHIP[t.status]
                  const li = lineItemsById[t.paymentId]
                  const editing = t.invoiceId != null && dateEditId === t.invoiceId
                  const badDate = isBilledAfterPaid(t)
                  // Fixable in place: no date at all, or a provably wrong one (v2.2337).
                  const canAddDate = canExclude && t.invoiceId != null && (t.billedYmd == null || badDate)
                  const hoverDates = t.billedYmd
                    ? `Billed ${formatYmdSlash(t.billedYmd)} → paid ${formatYmdSlash(t.paidYmd)}${t.sentYmd ? ` · sent ${formatYmdSlash(t.sentYmd)}` : ''}${badDate ? ' — the recorded bill date is after the payment, so it can’t be right' : ''}`
                    : `Received ${formatYmdSlash(t.paidYmd)}${t.sentYmd ? ` · sent ${formatYmdSlash(t.sentYmd)}` : ''} — no bill date to measure from`
                  return (
                    <div key={t.paymentId}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.55rem',
                        padding: '0.4rem 0.45rem',
                        borderRadius: '6px 6px 0 0',
                        fontSize: '0.76rem',
                        background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                        opacity: t.status === 'excluded' ? 0.6 : 1,
                      }}
                    >
                      <span
                        title={hoverDates}
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: 'var(--text-700)',
                          // The add-date button (and the open editor) outgrow the fixed
                          // column — size those rows to content so the paid date never
                          // slides under the amount.
                          width: editing || canAddDate ? 'auto' : '8.6em',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {editing ? (
                          <>{dateEditor(t.invoiceId!)}<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> → {formatYmdSlash(t.paidYmd)}</span></>
                        ) : canAddDate ? (
                          <>{addDateButton(t.invoiceId!)}<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> → {formatYmdSlash(t.paidYmd)}</span></>
                        ) : t.billedYmd ? (
                          <>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{formatYmdSlash(t.billedYmd)} → </span>
                            {formatYmdSlash(t.paidYmd)}
                          </>
                        ) : (
                          <>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>— → </span>
                            {formatYmdSlash(t.paidYmd)}
                          </>
                        )}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, width: '4.6em', textAlign: 'right', flexShrink: 0 }}>
                        {formatUsdNoCents(t.amount)}
                      </span>
                      {jobCell(t.customerName, t.jobName, t.address)}
                      <span style={chipStyle(chip.bg, chip.fg)}>{chip.label(t)}</span>
                      {canExclude && (
                        <button
                          type="button"
                          disabled={busyId === t.paymentId}
                          onClick={(e) => {
                            e.stopPropagation()
                            void toggleExclusion(t)
                          }}
                          title={t.status === 'excluded' ? 'Put this payment back into the pay-speed math' : 'Drop this payment from the pay-speed math (you can always include it again)'}
                          style={{ ...actStyle, color: t.status === 'excluded' ? 'var(--text-link)' : 'var(--text-muted)' }}
                        >
                          {busyId === t.paymentId ? '…' : t.status === 'excluded' ? 'Include again' : 'Exclude'}
                        </button>
                      )}
                      {t.jobId && (onOpenJobStacked || onOpenJobDetail) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openJob(t.jobId!)
                          }}
                          style={{ ...actStyle, color: 'var(--text-link)' }}
                        >
                          Open job ›
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 8px 8px',
                        padding: '0.35rem 0.7rem 0.45rem 2rem',
                        fontSize: '0.74rem',
                        marginBottom: '0.35rem',
                        color: 'var(--text-700)',
                      }}
                    >
                      {li === undefined ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                          {lineItemsLoaded ? 'Line items aren’t available for this payment.' : 'Loading line items…'}
                        </div>
                      ) : (
                        <>
                          {!li.linked && li.items.length > 0 && (
                            <div style={{ fontSize: '0.62rem', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'right' }}>
                              job’s items — payment isn’t on a bill
                            </div>
                          )}
                          {li.items.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}>No line items recorded.</div>
                          ) : (
                            li.items.map((it, j) => {
                              // With a single item whose amount IS the bill total, the
                              // label rides the item's own line (v2.2316); mismatched or
                              // multi-item bills keep a separate total line below.
                              const inlineTotal =
                                li.linked && li.billAmount != null && li.items.length === 1 && it.amount === li.billAmount
                              return (
                                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.1rem 0' }}>
                                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {it.name}
                                    {it.count !== 1 ? <span style={{ color: 'var(--text-muted)' }}> × {it.count}</span> : null}
                                    {it.description ? <span style={{ color: 'var(--text-muted)' }}> — {it.description}</span> : null}
                                  </span>
                                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>
                                    {inlineTotal && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginRight: '0.35rem' }}>bill total</span>}
                                    {it.amount != null ? formatUsdNoCents(it.amount) : '—'}
                                  </span>
                                </div>
                              )
                            })
                          )}
                          {li.linked &&
                            li.billAmount != null &&
                            (li.items.length >= 2 || (li.items.length === 1 && li.items[0]!.amount !== li.billAmount)) && (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'flex-end',
                                  alignItems: 'baseline',
                                  gap: '0.45rem',
                                  borderTop: '1px solid var(--border)',
                                  marginTop: '0.25rem',
                                  paddingTop: '0.2rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                <span>bill total</span>
                                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-700)' }}>
                                  {formatUsdNoCents(li.billAmount)}
                                </span>
                              </div>
                            )}
                        </>
                      )}
                    </div>
                    </div>
                  )
                })}
                </>
              )
            ) : bills.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nothing matches.</p>
            ) : (
              bills.map((b, i) => (
                <div
                  key={b.invoiceId}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.55rem',
                    padding: '0.4rem 0.45rem',
                    borderRadius: 6,
                    fontSize: '0.76rem',
                    background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                  }}
                >
                  {canExclude && (
                    <span style={{ flexShrink: 0 }}>
                      {dateEditId === b.invoiceId ? dateEditor(b.invoiceId) : addDateButton(b.invoiceId)}
                    </span>
                  )}
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, width: '4.6em', textAlign: 'right', flexShrink: 0 }}>
                    {formatUsdNoCents(b.amount)}
                  </span>
                  {jobCell(b.customerName, b.jobName, b.address)}
                  <span style={chipStyle('var(--bg-amber-tint)', 'var(--text-amber-800)')}>no bill date</span>
                  {b.jobId && (onOpenJobStacked || onOpenJobDetail) && (
                    <button type="button" onClick={() => openJob(b.jobId!)} style={{ ...actStyle, color: 'var(--text-link)' }}>
                      Open job ›
                    </button>
                  )}
                </div>
              ))
            )}

            <p
              style={{
                marginTop: '0.7rem',
                marginBottom: 0,
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.5rem',
              }}
            >
              Missing info means a payment can’t feed the medians yet — it’s not on a bill, or its bill has no date
              (type the date right in the row to fix that one). Excluded payments are remembered (who and when) and can
              always be included again. Quarantined rows are import-era same-day pairs, out of the math until a
              verified date replaces them. Undated bills are the all-time backlog of billed/paid bills with no bill
              date.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
