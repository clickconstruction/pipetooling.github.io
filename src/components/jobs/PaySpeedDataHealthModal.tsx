import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdSlash } from '../../lib/jobs/paySpeedsBreakdown'
import {
  filterBills,
  filterTxns,
  lensCounts,
  parsePaymentLineItems,
  parsePaySpeedTransactions,
  type DataHealthLens,
  type PaymentLineItems,
  type PaySpeedTransactions,
  type PaySpeedTxn,
} from '../../lib/jobs/paySpeedTransactions'

/**
 * The Data health drill-down (owner-approved mockup, v2.2290): opened by
 * clicking the strip in Pay speeds. Lists every 12-month payment behind the
 * strip's counts — filter pills per bucket + the undated-bills backlog,
 * search across customer / job / address — with two actions per row:
 * exclude it from the pay-speed math (auditable toggle; "Include again" is
 * the undo) or open its job to actually fix dates and links.
 */

const STATUS_CHIP: Record<PaySpeedTxn['status'], { bg: string; fg: string; label: (t: PaySpeedTxn) => string }> = {
  measurable: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', label: (t) => (t.gapDays != null ? `+${t.gapDays}d` : 'measurable') },
  unlinked: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', label: () => 'unlinked' },
  quarantined: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)', label: () => 'quarantined' },
  excluded: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', label: () => 'excluded' },
}

const LENSES: { key: DataHealthLens; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'measurable', label: 'Measurable' },
  { key: 'unlinked', label: 'Unlinked' },
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
  /** Devs + master techs can exclude/include; everyone else just reads. */
  canExclude: boolean
  /** Devs only: the ⚙ No Count Date setting (v2.2303). */
  isDev?: boolean
  /** Fired after an exclude/include lands so the medians refresh live. */
  onChanged?: () => void
}) {
  const { user: authUser, profileName } = useAuth()
  const [data, setData] = useState<PaySpeedTransactions | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [lens, setLens] = useState<DataHealthLens>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [gearOpen, setGearOpen] = useState(false)
  // Row expansion (v2.2309): tap a payment → the line items it paid for,
  // lazy-loaded once per payment and cached for the session.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lineItemsById, setLineItemsById] = useState<Record<string, PaymentLineItems | null | 'loading'>>({})
  const [noCountDraft, setNoCountDraft] = useState('')
  const [savingNoCount, setSavingNoCount] = useState(false)

  async function load() {
    try {
      const { data: raw } = await supabase.rpc('get_pay_speed_transactions' as never)
      setData(parsePaySpeedTransactions(raw as unknown))
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


  function toggleLineItems(paymentId: string) {
    setExpandedId((prev) => (prev === paymentId ? null : paymentId))
    if (lineItemsById[paymentId] === undefined) {
      setLineItemsById((prev) => ({ ...prev, [paymentId]: 'loading' }))
      void (async () => {
        try {
          const { data: raw } = await supabase.rpc('get_payment_line_items' as never, { p_payment_id: paymentId } as never)
          setLineItemsById((prev) => ({ ...prev, [paymentId]: parsePaymentLineItems(raw as unknown) }))
        } catch {
          setLineItemsById((prev) => ({ ...prev, [paymentId]: null }))
        }
      })()
    }
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
  }

  function jobCell(customerName: string | null, jobName: string | null, address: string | null) {
    return (
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {customerName ? <span style={{ fontWeight: 650 }}>{customerName}</span> : <span style={{ color: 'var(--text-muted)' }}>no customer</span>}
        {(jobName || address) && (
          <span style={{ color: 'var(--text-muted)' }}>
            {' · '}
            {[jobName, address].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    )
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
          opening the job is where dates and invoice links get fixed.
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
                txns.map((t, i) => {
                  const chip = STATUS_CHIP[t.status]
                  const expanded = expandedId === t.paymentId
                  const li = lineItemsById[t.paymentId]
                  return (
                    <div key={t.paymentId}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      title={expanded ? 'Hide the line items behind this payment' : 'Show the line items behind this payment'}
                      onClick={() => toggleLineItems(t.paymentId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleLineItems(t.paymentId)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        padding: '0.4rem 0.45rem',
                        borderRadius: expanded ? '6px 6px 0 0' : 6,
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                        background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                        opacity: t.status === 'excluded' ? 0.6 : 1,
                      }}
                    >
                      <span
                        title={t.sentYmd ? `Sent ${formatYmdSlash(t.sentYmd)} → received ${formatYmdSlash(t.paidYmd)}` : `Received ${formatYmdSlash(t.paidYmd)} — no sent date recorded`}
                        style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-700)', width: t.sentYmd ? '8.2em' : '3.4em', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {t.sentYmd ? (
                          <>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{formatYmdSlash(t.sentYmd)} → </span>
                            {formatYmdSlash(t.paidYmd)}
                          </>
                        ) : (
                          formatYmdSlash(t.paidYmd)
                        )}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, width: '4.6em', textAlign: 'right', flexShrink: 0 }}>
                        {formatUsdNoCents(t.amount)}
                      </span>
                      {jobCell(t.customerName, t.jobName, t.address)}
                      <span
                        title={t.billedYmd ? `Billed ${formatYmdSlash(t.billedYmd)} → paid ${formatYmdSlash(t.paidYmd)}` : undefined}
                        style={{ fontSize: '0.64rem', fontWeight: 700, borderRadius: 9999, padding: '0 6px', flexShrink: 0, background: chip.bg, color: chip.fg }}
                      >
                        {chip.label(t)}
                      </span>
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
                    {expanded && (
                      <div
                        style={{
                          border: '1px solid var(--border)',
                          borderTop: 'none',
                          borderRadius: '0 0 8px 8px',
                          padding: '0.45rem 0.7rem 0.55rem 2rem',
                          fontSize: '0.74rem',
                          marginBottom: '0.3rem',
                          color: 'var(--text-700)',
                        }}
                      >
                        {li === 'loading' || li === undefined ? (
                          <span style={{ color: 'var(--text-muted)' }}>Loading line items…</span>
                        ) : li == null ? (
                          <span style={{ color: 'var(--text-muted)' }}>Line items aren’t available for this payment.</span>
                        ) : (
                          <>
                            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                              {li.linked ? 'What this bill charged' : "Not applied to a bill — the job's line items, for context"}
                            </div>
                            {li.items.length === 0 ? (
                              <span style={{ color: 'var(--text-muted)' }}>No line items recorded{li.linked ? ' on this bill' : ' on this job'}.</span>
                            ) : (
                              li.items.map((it, j) => (
                                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.1rem 0' }}>
                                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {it.name}
                                    {it.count !== 1 ? <span style={{ color: 'var(--text-muted)' }}> × {it.count}</span> : null}
                                    {it.description ? <span style={{ color: 'var(--text-muted)' }}> — {it.description}</span> : null}
                                  </span>
                                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>
                                    {it.amount != null ? formatUsdNoCents(it.amount) : '—'}
                                  </span>
                                </div>
                              ))
                            )}
                            {li.linked && li.billAmount != null && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', borderTop: '1px solid var(--border)', marginTop: '0.25rem', paddingTop: '0.2rem', color: 'var(--text-muted)' }}>
                                <span>bill total</span>
                                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-700)' }}>{formatUsdNoCents(li.billAmount)}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    </div>
                  )
                })
              )
            ) : bills.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nothing matches.</p>
            ) : (
              bills.map((b, i) => (
                <div
                  key={b.invoiceId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.4rem 0.45rem',
                    borderRadius: 6,
                    fontSize: '0.76rem',
                    background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                  }}
                >
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, width: '4.6em', textAlign: 'right', flexShrink: 0 }}>
                    {formatUsdNoCents(b.amount)}
                  </span>
                  {jobCell(b.customerName, b.jobName, b.address)}
                  <span style={{ fontSize: '0.64rem', fontWeight: 700, borderRadius: 9999, padding: '0 6px', flexShrink: 0, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
                    no bill date
                  </span>
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
              Excluded payments are remembered (who and when) and can always be included again. Quarantined rows are
              import-era same-day pairs, out of the math until a verified date replaces them. Undated bills are the
              all-time backlog of billed/paid invoices with no bill date.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
