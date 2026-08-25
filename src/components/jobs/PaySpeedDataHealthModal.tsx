import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdSlash } from '../../lib/jobs/paySpeedsBreakdown'
import {
  filterBills,
  filterTxns,
  lensCounts,
  parsePaySpeedTransactions,
  type DataHealthLens,
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
  canExclude,
  onChanged,
}: {
  onClose: () => void
  /** Open a row's job detail (closes the modal stack upstream). */
  onOpenJobDetail?: (jobId: string) => void
  /** Devs + master techs can exclude/include; everyone else just reads. */
  canExclude: boolean
  /** Fired after an exclude/include lands so the medians refresh live. */
  onChanged?: () => void
}) {
  const { user: authUser, profileName } = useAuth()
  const [data, setData] = useState<PaySpeedTransactions | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [lens, setLens] = useState<DataHealthLens>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close data health transactions"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', lineHeight: 1, padding: '0.15rem' }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: '0.3rem 0 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>
          Every recorded payment from the last 12 months. Excluding one drops it from the medians and the counts;
          opening the job is where dates and invoice links get fixed.
        </p>

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
                  return (
                    <div
                      key={t.paymentId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        padding: '0.4rem 0.45rem',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                        opacity: t.status === 'excluded' ? 0.6 : 1,
                      }}
                    >
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-700)', width: '3.4em', flexShrink: 0 }}>
                        {formatYmdSlash(t.paidYmd)}
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
                          onClick={() => void toggleExclusion(t)}
                          title={t.status === 'excluded' ? 'Put this payment back into the pay-speed math' : 'Drop this payment from the pay-speed math (you can always include it again)'}
                          style={{ ...actStyle, color: t.status === 'excluded' ? 'var(--text-link)' : 'var(--text-muted)' }}
                        >
                          {busyId === t.paymentId ? '…' : t.status === 'excluded' ? 'Include again' : 'Exclude'}
                        </button>
                      )}
                      {t.jobId && onOpenJobDetail && (
                        <button type="button" onClick={() => onOpenJobDetail(t.jobId!)} style={{ ...actStyle, color: 'var(--text-link)' }}>
                          Open job ›
                        </button>
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
                  {b.jobId && onOpenJobDetail && (
                    <button type="button" onClick={() => onOpenJobDetail(b.jobId!)} style={{ ...actStyle, color: 'var(--text-link)' }}>
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
