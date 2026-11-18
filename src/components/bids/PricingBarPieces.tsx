/**
 * Bids → Pricing: five small pieces of the Workbench's sticky bar, moved out of `BidsPricingTab`
 * as they were drawn (decomposition queue row 1). None reads the solver's values. All draw and
 * report; the tab keeps every state and every write.
 *
 * - `PricingMarkupTool` / `PricingTaxTool`: the two buttons beside the brush and the popover each
 *   opens (punch list #128). The rows they are handed are `lib/bids/rowMarkToolRows.ts`.
 * - `PricingRobotRowsDoor`: prices the robot's rows that landed before a price book was picked.
 * - `PricingLockChip`: a sent bid's frozen-price chip, with Revise… and Lock again (v2.3591).
 * - `PricingSentLine`: what was sent beside today's number.
 */
import { countedLabel } from '../../lib/batchWords'
import { MarkupToolPopover } from './MarkupToolPopover'
import { TaxToolPopover } from './TaxToolPopover'

type MarkupPopoverProps = Parameters<typeof MarkupToolPopover>[0]
type TaxPopoverProps = Parameters<typeof TaxToolPopover>[0]

export function PricingMarkupTool({ open, onToggle, onClose, rows, bidMarkup, weightedMarkup, onApply, undoCount, onUndo }: { open: boolean; onToggle: () => void } & MarkupPopoverProps) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        title="Material markup — set one number across the rows, a tag or a kind"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', font: 'inherit', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: open ? 'var(--bg-muted)' : 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1, flex: '0 0 auto' }}
      >
        <span aria-hidden style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>+%</span>
        Markup ›
      </button>
      {open ? (
        <MarkupToolPopover
          rows={rows}
          bidMarkup={bidMarkup}
          weightedMarkup={weightedMarkup}
          onApply={onApply}
          undoCount={undoCount}
          onUndo={onUndo}
          onClose={onClose}
        />
      ) : null}
    </span>
  )
}

export function PricingTaxTool({ open, onToggle, onClose, rows, taxPercent, onTaxPercentChange, onTaxPercentCommit, onApply, undoCount, onUndo }: { open: boolean; onToggle: () => void } & TaxPopoverProps) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        title="Sales tax — make rows tax-free or taxed across the bid, a tag or a kind"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', font: 'inherit', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: open ? 'var(--bg-muted)' : 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1, flex: '0 0 auto' }}
      >
        <span aria-hidden style={{ fontSize: '0.72rem', fontWeight: 800, lineHeight: 1, textDecoration: 'line-through' }}>tx</span>
        Tax ›
      </button>
      {open ? (
        <TaxToolPopover
          rows={rows}
          taxPercent={taxPercent}
          onTaxPercentChange={onTaxPercentChange}
          onTaxPercentCommit={onTaxPercentCommit}
          onApply={onApply}
          undoCount={undoCount}
          onUndo={onUndo}
          onClose={onClose}
        />
      ) : null}
    </span>
  )
}

export function PricingRobotRowsDoor({ count, busy, onPrice }: { /** Robot rows with no price. */ count: number; busy: boolean; onPrice: () => void }) {
  return (
    <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
      <button
        type="button"
        data-testid="pricing-robot-price-door"
        disabled={busy}
        onClick={onPrice}
        style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', cursor: busy ? 'wait' : 'pointer' }}
      >
        {busy ? 'Pricing…' : `${countedLabel('Price', count, 'robot row')} at the robot's prices`}
      </button>
      <span style={{ color: 'var(--text-muted)' }}>{count === 1 ? '1 robot row landed before a book was picked and has no price.' : `${count} robot rows landed before a book was picked and have no price.`}</span>
    </div>
  )
}

export function PricingLockChip({ chip, revising, onToggle }: { /** The chip's words (`pricingLockChipText`). */ chip: string; revising: boolean; onToggle: () => void }) {
  return (
    <div data-testid="pricing-lock-chip" style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.74rem' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.15rem 0.55rem',
          borderRadius: 999,
          border: `1px solid ${revising ? 'var(--border-amber)' : 'var(--border-strong)'}`,
          background: revising ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
          color: revising ? 'var(--text-amber-700)' : 'var(--text-600)',
          fontWeight: 600,
        }}
      >
        {revising ? '✎' : '🔒'} {chip}
      </span>
      <button
        type="button"
        onClick={onToggle}
        title={revising ? 'Lock this bid\'s pricing again' : 'Unlock this bid\'s pricing for this session — changes after send are on purpose'}
        style={{ padding: '0.15rem 0.55rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}
      >
        {revising ? 'Lock again' : 'Revise…'}
      </button>
    </div>
  )
}

export function PricingSentLine({ text, differs }: { /** `sentVsTodayText`. */ text: string; /** Today's number is not what was sent. */ differs: boolean }) {
  return (
    <div
      data-testid="pricing-sent-vs-today"
      style={{ marginTop: '0.4rem', fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: differs ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: differs ? 600 : 400 }}
    >
      {text}
    </div>
  )
}
