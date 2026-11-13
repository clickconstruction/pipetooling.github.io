import { useState, type CSSProperties } from 'react'
import { MONEY_BAR_TONE, MONEY_BAR_TRACK } from '../../lib/jobs/jobMoneyBar'
import { formatCurrency } from '../../lib/format'
import { rtbEditJobHref, rtbOpenBillWords, type RtbParts, type RtbSegmentKind } from '../../lib/billing/rtbParts'

/**
 * Bill Customer's RTB drawn (punch list #217, jobs-pipeline-4, a prototype): the Pipeline row's
 * money bar under the header with *this bill* as its next segment and the bid as the frame, then
 * the sum as rows with a door on each part. Reads `rtbParts`' fractions and words only. The green
 * and the blue are the Pipeline bar's paid and billed; this bill is the lighter blue of a bill not
 * yet out; the grey is the bar's own track. A door opens in a new tab, so the window stays as it is.
 */

const THIS_BILL = '#60a5fa'

function fill(kind: RtbSegmentKind): CSSProperties {
  switch (kind) {
    case 'paid':
      return { background: MONEY_BAR_TONE.paid, color: '#fff' }
    case 'open':
      return { background: MONEY_BAR_TONE.billed, color: '#fff' }
    case 'this':
      return { background: THIS_BILL, color: '#fff', outline: `2px dashed ${MONEY_BAR_TONE.billed}`, outlineOffset: -2 }
    case 'rest':
      return { background: MONEY_BAR_TRACK, color: 'var(--text-muted)' }
  }
}

const LEGEND: Array<{ kind: RtbSegmentKind; words: string }> = [
  { kind: 'paid', words: 'paid' },
  { kind: 'open', words: 'open bills' },
  { kind: 'this', words: 'this bill' },
  { kind: 'rest', words: 'left after this bill' },
]

const usd = (n: number) => `$${formatCurrency(n)}`

const ROW: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', fontSize: '0.8125rem', padding: '0.15rem 0' }
const AMOUNT: CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const DOOR: CSSProperties = { marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }

export function BillCustomerRtbParts({ parts, jobId }: { parts: RtbParts; jobId: string }) {
  const [unfolded, setUnfolded] = useState(false)
  const words = parts.segments.map((s) => s.title).join(' · ')
  return (
    <div data-testid="bill-customer-rtb-parts" style={{ display: 'grid', gap: '0.35rem', margin: '0.35rem 0 0', maxWidth: 520 }}>
      <div
        role="img"
        aria-label={`Bid ${usd(parts.bid)}: ${words || 'nothing on it yet'}`}
        title={words}
        style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-strong)', background: MONEY_BAR_TRACK }}
      >
        {parts.segments.map((s) => (
          <span
            key={s.kind}
            data-rtb-segment={s.kind}
            title={s.title}
            style={{ ...fill(s.kind), flex: `${Math.max(s.fraction, 0.001)} 1 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0, borderRight: '1px solid var(--surface)' }}
          >
            {s.fraction >= 0.14 ? s.label : ''}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>
          bid <b style={{ color: 'var(--text-strong)' }}>{usd(parts.bid)}</b>
        </span>
        <span data-rtb-frame-words>{parts.frameWords}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.8rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        {LEGEND.filter((l) => parts.segments.some((s) => s.kind === l.kind)).map((l) => (
          <span key={l.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <span aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: fill(l.kind).background as string, border: '1px solid var(--border-strong)' }} />
            {l.words}
          </span>
        ))}
      </div>
      {parts.note ? (
        <p data-rtb-note style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
          {parts.note}
        </p>
      ) : null}
      <div data-rtb-rows style={{ borderTop: '1px solid var(--border)', marginTop: '0.1rem' }}>
        {parts.rows.map((r) => (
          <div key={r.kind} data-rtb-row={r.kind}>
            <div style={{ ...ROW, borderTop: r.kind === 'this' ? '1px solid var(--border-strong)' : undefined, fontWeight: r.kind === 'this' ? 700 : 400, marginTop: r.kind === 'this' ? '0.15rem' : 0 }}>
              <span style={{ minWidth: 0 }}>
                {r.sign ? <span aria-hidden style={{ display: 'inline-block', width: '1rem', color: 'var(--text-muted)' }}>{r.sign}</span> : <span aria-hidden style={{ display: 'inline-block', width: '1rem' }} />}
                {r.words}
                {r.door ? (
                  <a href={r.door.href} target="_blank" rel="noopener" style={DOOR} title={`Open ${r.door.label} in a new tab`}>
                    ↗ {r.door.label}
                  </a>
                ) : null}
                {r.kind === 'open' && parts.openBills.length > 0 ? (
                  <button
                    type="button"
                    aria-expanded={unfolded}
                    onClick={() => setUnfolded((v) => !v)}
                    style={{ ...DOOR, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.72rem' }}
                  >
                    {unfolded ? '▴ fold' : '▾ unfold'}
                  </button>
                ) : null}
              </span>
              <span style={AMOUNT}>{usd(r.amount)}</span>
            </div>
            {r.kind === 'open' && unfolded
              ? parts.openBills.map((b) => (
                  <div key={b.id} data-rtb-open-bill={b.id} style={{ ...ROW, paddingLeft: '1.6rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <span>
                      {rtbOpenBillWords(b)}
                      {b.applied > 0.004 ? <span title={`${usd(b.face)} on the bill, ${usd(b.applied)} paid on it`}> · {usd(b.face)} less {usd(b.applied)} paid</span> : null}
                      <a href={rtbEditJobHref(jobId)} target="_blank" rel="noopener" style={DOOR} title="Open Edit Job, where the bills are kept, in a new tab">
                        ↗ the bill
                      </a>
                    </span>
                    <span style={AMOUNT}>{usd(b.open)}</span>
                  </div>
                ))
              : null}
          </div>
        ))}
      </div>
    </div>
  )
}
