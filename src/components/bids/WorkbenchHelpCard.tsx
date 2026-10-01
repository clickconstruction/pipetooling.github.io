/**
 * Bids → Pricing: the "?" card (v2.2376) — the Workbench in four scannable lines; the tour
 * and the full guide ride in its footer, so one icon is the whole help story. Region P2 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`; the JSX moved out of `BidsPricingTab` as it
 * was. Renders and reports only. The lines are written in plain words (v2.4307, the rules in
 * `src/lib/plainWords.ts`); each line's body carries `data-help-line` so the render test can
 * hold them to the rules.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WORKBENCH_GUIDE_HREF } from '../../lib/bids/workbenchHelp'

export function WorkbenchHelpCard({
  solo,
  firstScenarioName,
  gcName,
  gcShort,
  onClose,
  onTakeTour,
}: {
  /** One price and one GC at most (`workbenchHelpFacts`). */
  solo: boolean
  firstScenarioName: string
  /** The GC the packet on screen goes to. */
  gcName: string
  gcShort: string
  onClose: () => void
  /** Closes the card and starts the walkthrough. */
  onTakeTour: () => void
}) {
  const strong: CSSProperties = { color: 'var(--text-strong)' }
  const infoRow = (k: string, body: ReactNode) => (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.5rem 0.95rem', borderBottom: '1px solid var(--border)' }}>
      <span style={{ flex: '0 0 7.5rem', fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.8rem' }}>{k}</span>
      <span data-help-line={k} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{body}</span>
    </div>
  )
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4rem 1rem 1rem' }}>
      <div role="dialog" aria-label="How this page works" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, maxWidth: '30rem', width: '100%', boxShadow: '0 10px 32px rgba(15, 23, 42, 0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '0.55rem 0.95rem', borderBottom: '1px solid var(--border)', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
          How this page works
        </div>
        {infoRow(
          'Type a price',
          <>
            Type a price in a row. It saves when you leave the field, and the row reads{' '}
            <span style={{ color: 'var(--text-green-700)', fontSize: '0.68rem', fontWeight: 700 }}>saved ✓</span>.
          </>,
        )}
        {infoRow(
          'Solve',
          <>
            Tap <b style={strong}>Solver ›</b> for suggested prices. They show in amber, like{' '}
            <span style={{ border: '1px solid var(--text-amber-700)', background: 'var(--bg-amber-tint)', borderRadius: 4, padding: '0 0.3rem', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>150</span>
            . They are previews, prices not saved yet. Tap <b style={strong}>Apply</b> to keep them or <b style={strong}>Discard</b> to clear them.
            Previews wait on this device. The GC never sees them.
          </>,
        )}
        {solo
          ? infoRow(
              'This bid',
              <>
                This bid has one packet, the copy one GC gets. {gcShort} sees <b style={strong}>{firstScenarioName}</b>. Tap{' '}
                <b style={strong}>＋ Add price</b> to start another price or GC.
              </>,
            )
          : infoRow(
              'This GC',
              <>
                You are on the packet for {gcName}, their copy of the bid. The{' '}
                <span style={{ color: 'var(--text-green-600)', fontWeight: 700 }}>★</span> base is the price they see on their letter. Switch the GC or
                the price option at the top.
              </>,
            )}
        {infoRow('Labor & cost', <>Labor and cost are shared by the whole package. Switching bids changes the revenue, not the cost.</>)}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.95rem', background: 'var(--bg-subtle)' }}>
          <button
            type="button"
            onClick={onTakeTour}
            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.32rem 0.8rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
          >
            ▶ Take the tour
          </button>
          <Link to={WORKBENCH_GUIDE_HREF} onClick={onClose} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)' }}>
            Read the guide →
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{ font: 'inherit', marginLeft: 'auto', padding: '0.3rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
