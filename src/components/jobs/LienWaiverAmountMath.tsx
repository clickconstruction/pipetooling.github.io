import type { CSSProperties } from 'react'
import {
  waiverShortDay,
  waiverCoverageSentence,
  waiverCoversSentence,
  type WaiverAmountMath,
  type WaiverCoverage,
} from '../../lib/jobs/lienWaiverAmountMath'

/**
 * The Release of Lien window's amount pieces (v2.4296; split per step in v2.4314): how the amount
 * is figured and a typed-over amount with the way back (step 3), a waiver that already covers a
 * picked bill (step 1), and the money paid that no unconditional waiver covers yet (step 2). The
 * kernel is `lienWaiverAmountMath.ts`; this only draws.
 */

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const plain = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: '1rem', alignItems: 'baseline' }
const btn: CSSProperties = { padding: '0.35rem 0.7rem', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }

/**
 * Step 3 (v2.4314): the box that says how the amount is figured, and a typed-over amount with the
 * way back. Shows nothing when the amount is simply the bill.
 */
export function WaiverMathBox({
  math,
  typedAmount,
  editable,
  onUseAmount,
  onHover,
  onGoOn,
}: {
  math: WaiverAmountMath | null
  /** The Amount box as typed. */
  typedAmount: string
  editable: boolean
  onUseAmount: (amount: number) => void
  /** Hovering the math marks the amount on the page preview. */
  onHover: (on: boolean) => void
  /** An unconditional final that is early: go on anyway (the money has settled outside the app). */
  onGoOn?: () => void
}) {
  const typed = Number((typedAmount ?? '').replace(/[$,\s]/g, ''))
  const typedOver = math != null && editable && (typedAmount ?? '').trim() !== '' && Number.isFinite(typed) && Math.abs(typed - math.total) > 0.005
  const showMath = math != null && (math.show || typedOver)
  if (!showMath && !typedOver) return null
  const many = (math?.bills.length ?? 0) > 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }} data-testid="lien-waiver-math-block">
      {typedOver && math ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }} data-testid="lien-waiver-typed-over">
          <span>
            The bills say <strong>{usd(math.total)}</strong>. You typed {usd(typed)}.
          </span>
          <button type="button" onClick={() => onUseAmount(math.total)} style={{ ...btn, border: '1px solid var(--border-strong)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }}>
            Use {usd(math.total)}
          </button>
        </div>
      ) : null}

      {showMath && math ? (
        <div
          data-testid="lien-waiver-math"
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
          style={{ border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', padding: '0.65rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}
        >
          <div style={{ fontWeight: 700 }}>How {usd(math.total)} is figured</div>
          {math.kind === 'paid'
            ? math.bills.flatMap((b) =>
                b.payments.map((p, i) => (
                  <div key={p.id} style={row}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {p.label} · {waiverShortDay(p.ymd)}
                      {many ? ` · bill #${b.n}` : ''}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{i === 0 && b === math.bills[0] ? usd(p.amount) : `+ ${plain(p.amount)}`}</span>
                  </div>
                )),
              )
            : math.bills.map((b, bi) => (
                <div key={b.invoiceId} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={row}>
                    <span>
                      Bill #{b.n} · billed {waiverShortDay(b.billedYmd)}
                    </span>
                    <span>{bi === 0 || math.kind === 'owed' ? usd(b.amount) : `+ ${plain(b.amount)}`}</span>
                  </div>
                  {math.kind === 'owed'
                    ? b.payments.map((p) => (
                        <div key={p.id} style={row}>
                          <span style={{ color: 'var(--text-muted)', paddingLeft: '0.6rem' }}>
                            {p.label} · {waiverShortDay(p.ymd)}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>− {plain(p.amount)}</span>
                        </div>
                      ))
                    : null}
                  {math.kind === 'owed' && many ? (
                    <div style={row}>
                      <span style={{ paddingLeft: '0.6rem' }}>Owed on #{b.n}</span>
                      <span>{usd(b.owed)}</span>
                    </div>
                  ) : null}
                </div>
              ))}
          <div style={{ ...row, borderTop: '1px solid var(--border-strong)', paddingTop: '0.3rem', fontSize: '0.875rem' }}>
            <strong>{math.totalLabel}</strong>
            <strong>{usd(math.total)}</strong>
          </div>
          {math.tooEarly != null ? (
            <div style={{ color: 'var(--text-amber-800)', fontWeight: 600, display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span>Not yet. {usd(math.tooEarly)} is still owed. Wait for it to settle.</span>
              {onGoOn ? (
                <button type="button" onClick={onGoOn} style={{ ...linkBtn, color: 'var(--text-amber-800)' }}>
                  It has settled, go on
                </button>
              ) : null}
            </div>
          ) : math.note ? (
            <div style={{ color: 'var(--text-muted)' }}>{math.note}</div>
          ) : null}
        </div>
      ) : null}

    </div>
  )
}

/**
 * Step 1 (v2.4314): a live waiver already covers a picked bill. The ways on, the best first: when
 * paid money has no unconditional waiver yet, waive that instead; else open the other waiver or
 * drop this draft. "Make it anyway" is for the rare case the app has it wrong.
 */
export function WaiverCoveredNote({
  coverage,
  paidUnwaived,
  canDiscard,
  onOpenCovered,
  onDiscard,
  onWaivePaid,
  onMakeAnyway,
}: {
  coverage: WaiverCoverage
  paidUnwaived: number | null
  /** The row being edited is an unminted draft, so Discard can void it. */
  canDiscard: boolean
  onOpenCovered: () => void
  onDiscard: () => void
  onWaivePaid: () => void
  onMakeAnyway: () => void
}) {
  return (
    <div data-testid="lien-waiver-covered" style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-amber-100)', borderRadius: 10, padding: '0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', lineHeight: 1.45 }}>
        <strong style={{ fontSize: '0.875rem' }}>
          {coverage.billNumbers.length > 1 ? `Bills #${coverage.billNumbers.join(' and #')} are already waived.` : `Bill #${coverage.billNumbers[0] ?? ''} is already waived.`}
        </strong>
        <span>{waiverCoverageSentence(coverage, usd, waiverShortDay)}</span>
        <span>{waiverCoversSentence(coverage)}</span>
        <span>A second waiver would give up the same money twice.</span>
      </div>
      {paidUnwaived != null ? (
        <button
          type="button"
          onClick={onWaivePaid}
          aria-label={`Waive the ${usd(paidUnwaived)} already paid instead ›`}
          aria-describedby="lien-waiver-covered-paid-why"
          style={{ border: 'none', background: '#2563eb', color: '#ffffff', borderRadius: 9, padding: '0.6rem 0.8rem', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}
        >
          <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Waive the {usd(paidUnwaived)} already paid instead ›</span>
          <span id="lien-waiver-covered-paid-why" style={{ fontSize: '0.75rem', opacity: 0.92 }}>
            That money has no unconditional waiver yet. The GC is owed one.
          </span>
        </button>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={onOpenCovered} style={{ ...btn, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-amber-800)' }}>
          Open the {coverage.release.status === 'signed' ? 'signed one' : 'other one'} ›
        </button>
        {canDiscard ? (
          <button type="button" onClick={onDiscard} style={{ ...btn, fontWeight: 500, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }}>
            Discard this draft
          </button>
        ) : null}
        <button type="button" onClick={onMakeAnyway} style={{ ...linkBtn, marginLeft: 'auto', color: 'var(--text-muted)' }}>
          Make it anyway
        </button>
      </div>
    </div>
  )
}

/** Step 2 (v2.4314): paid money that no unconditional waiver covers yet — the GC is owed one. */
export function WaiverPaidNote({ paidUnwaived, onWaivePaid }: { paidUnwaived: number; onWaivePaid: () => void }) {
  return (
    <div data-testid="lien-waiver-paid-unwaived" style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.65rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8125rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', lineHeight: 1.45, color: 'var(--text-blue-700)' }}>
        <strong>{usd(paidUnwaived)} is paid and not waived yet.</strong>
        <span>It is recorded as paid. The GC is owed an unconditional progress waiver for it.</span>
      </div>
      <div>
        <button type="button" onClick={onWaivePaid} style={{ ...btn, border: '1px solid #2563eb', background: 'var(--surface)', color: 'var(--text-blue-700)' }}>
          Waive the {usd(paidUnwaived)} paid ›
        </button>
      </div>
    </div>
  )
}

/** The page preview's paragraph with the amount marked while the math is hovered. */
export function MarkedWaiverAmount({ text, amountLabel, on }: { text: string; amountLabel: string; on: boolean }) {
  if (!on || !amountLabel || !text.includes(amountLabel)) return <>{text}</>
  const parts = text.split(amountLabel)
  return (
    <>
      {parts.map((part, i) =>
        i === 0 ? (
          <span key={i}>{part}</span>
        ) : (
          <span key={i}>
            <mark data-testid="lien-waiver-amount-mark" style={{ background: 'var(--bg-blue-tint)', color: 'inherit', borderBottom: '2px solid #2563eb', padding: '0 2px' }}>
              {amountLabel}
            </mark>
            {part}
          </span>
        ),
      )}
    </>
  )
}
