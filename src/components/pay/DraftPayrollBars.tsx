import type { CSSProperties } from 'react'
import { MONEY_BAR_TONE } from '../../lib/jobs/jobMoneyBar'
import { formatCurrency } from '../../lib/format'
import { SALARY_FLAT_HOURS_CHIP, SALARY_FLAT_HOURS_TITLE } from '../../lib/people/approvalsSessionChips'
import {
  ESTIMATE_CHIP,
  ESTIMATE_CHIP_TITLE,
  SALARY_FLAT_HOURS_SHORT_CHIP,
  pendingDotTitle,
  pendingDotWords,
  type DraftPayrollBarPart,
  type DraftPayrollBarPartKind,
  type DraftPayrollPeriodBar as PeriodBar,
  type DraftPayrollRowBar as RowBar,
} from '../../lib/pay/draftPayrollBars'

/**
 * Draft Payroll's bars, drawn (punch list #217, people-docs-1, a prototype): the period's bar under
 * the dates, a thin bar per row in place of the Status column, the *est.* and *salary 8h* chips and
 * the amber dot for sessions still waiting. Reads `draftPayrollBars`' fractions and words only. The
 * green and the blue are the Pipeline money bar's paid and billed, so money reads the same colour
 * everywhere; the hatch is the Legal desk's *asked, not counted* texture; the neutrals are tokens.
 */

const HATCH = 'repeating-linear-gradient(135deg, var(--bg-200) 0 5px, var(--bg-muted) 5px 10px)'

function fill(kind: DraftPayrollBarPartKind): CSSProperties {
  switch (kind) {
    case 'paid':
      return { background: MONEY_BAR_TONE.paid, color: '#fff' }
    case 'owed':
      return { background: MONEY_BAR_TONE.billed, color: '#fff' }
    case 'withheld':
      return { background: 'var(--bg-200)', color: 'var(--text-700)' }
    case 'estimate':
      return { background: HATCH, color: 'var(--text-700)' }
  }
}

/**
 * `fit` (the owner, 2026-10-30: "*paid Tue* bar should be no wider than its text"): the bar is as wide as its
 * words, each part its label with a little room, instead of filling the cell; the period bar still fills.
 */
function Bar({ parts, height, words, labelFrom, testId, fit = false }: { parts: DraftPayrollBarPart[]; height: number; words: string; labelFrom: number; testId: string; fit?: boolean }) {
  return (
    <div
      role="img"
      aria-label={words}
      title={words}
      data-testid={testId}
      style={{ display: fit ? 'inline-flex' : 'flex', width: fit ? 'auto' : undefined, maxWidth: '100%', height, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', minWidth: fit ? undefined : 0, verticalAlign: 'middle' }}
    >
      {parts.map((p) => (
        <span
          key={p.kind}
          data-draft-payroll-part={p.kind}
          title={p.title}
          style={{
            ...fill(p.kind),
            flex: fit ? '0 0 auto' : `${Math.max(p.fraction, 0.001)} 1 0`,
            padding: fit ? '0 7px' : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.66rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            minWidth: fit ? undefined : 0,
            borderRight: '1px solid var(--surface)',
          }}
        >
          {fit || p.fraction >= labelFrom ? p.label : ''}
        </span>
      ))}
    </div>
  )
}

/** The period's bar under the dates with its caption, in place of *Total | Left*; the words live inside the parts and on the hover (the owner dropped the legend, 2026-10-30). */
export function DraftPayrollPeriodBar({ bar }: { bar: PeriodBar }) {
  return (
    <div data-draft-payroll-period-bar style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.6rem' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-strong)', textAlign: 'center' }}>{bar.caption}</div>
      <Bar parts={bar.parts} height={20} words={bar.parts.map((p) => p.title).join(' · ') || 'Nothing due in this period'} labelFrom={0.16} testId="draft-payroll-period-bar" />
    </div>
  )
}

/** One row's Cash due cell: the thin bar, and the Review press when the row still needs one. */
export function DraftPayrollRowBarCell({ bar, onReview }: { bar: RowBar; onReview?: () => void }) {
  return (
    <div data-draft-payroll-row-bar={bar.person} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', maxWidth: '100%' }}>
      <Bar parts={bar.parts} height={16} words={bar.words} labelFrom={0.3} testId={`draft-payroll-row-bar-${bar.person}`} fit />
      {onReview ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReview()
          }}
          title="Show dates needing attention for this period (Correct checkbox or job assignment)"
          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#ea580c', textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >
          Review
        </button>
      ) : null}
    </div>
  )
}

const CHIP: CSSProperties = {
  display: 'inline-block',
  marginLeft: '0.35rem',
  padding: '0 0.4rem',
  borderRadius: 999,
  fontSize: '0.66rem',
  fontWeight: 600,
  lineHeight: 1.6,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
}

/** The $ column's figure with the cents drawn smaller (the owner, 2026-10-30): *$1,200* and a lighter *.00*. */
export function DraftPayrollMoney({ amount }: { amount: number }) {
  const whole = formatCurrency(amount)
  const dot = whole.lastIndexOf('.')
  const dollars = dot >= 0 ? whole.slice(0, dot) : whole
  const cents = dot >= 0 ? whole.slice(dot) : ''
  return (
    <span data-draft-payroll-money style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      ${dollars}
      {cents ? <span style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{cents}</span> : null}
    </span>
  )
}

/** *est.* beside a figure that is a live estimate from the hours. */
export function DraftPayrollEstChip() {
  return (
    <span data-draft-payroll-est title={ESTIMATE_CHIP_TITLE} style={{ ...CHIP, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
      {ESTIMATE_CHIP}
    </span>
  )
}

/** *salary 8h* as a small line under a salaried person's figure (the owner, 2026-10-30: not beside the name): the hours are the flat rule, not a clock. */
export function DraftPayrollSalaryChip() {
  return (
    <div data-draft-payroll-salary title={`${SALARY_FLAT_HOURS_CHIP}. ${SALARY_FLAT_HOURS_TITLE}`} style={{ fontSize: '0.66rem', lineHeight: 1.3, color: 'var(--text-muted)', textAlign: 'right' }}>
      {SALARY_FLAT_HOURS_SHORT_CHIP}
    </div>
  )
}

/** The amber dot: *● 2 waiting*, a press to the Hours tab when the person can open it. */
export function DraftPayrollPendingDot({ n, onPress }: { n: number; onPress?: () => void }) {
  const style: CSSProperties = { ...CHIP, background: 'var(--bg-amber-100)', border: '1px solid #f59e0b', color: 'var(--text-amber-800)', cursor: onPress ? 'pointer' : 'default', font: 'inherit', fontSize: '0.66rem', fontWeight: 600, lineHeight: 1.6 }
  const words = (
    <>
      <span aria-hidden style={{ color: '#f59e0b' }}>●</span> {pendingDotWords(n)}
    </>
  )
  return onPress ? (
    <button type="button" data-draft-payroll-pending={n} title={pendingDotTitle(n)} onClick={onPress} style={style}>
      {words}
    </button>
  ) : (
    <span data-draft-payroll-pending={n} title={pendingDotTitle(n)} style={style}>
      {words}
    </span>
  )
}

