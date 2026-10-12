import type { BillDayCardFacts } from './useBillDayCards'
import { shortDate, weekdayDate } from '../../lib/gc/words'

/**
 * Messages, cut 9 (wave 2, helper 7): Bill day's one line on a building job's card (the prototype's job page line,
 * v1.124). The bill day, the pay application, the cut-off, how many trades are in and how many gates are clear, and the
 * way to From the trades. The money team's, as Money is.
 */
export function BillDayCardLine({ facts, onOpen }: { facts: BillDayCardFacts; onOpen: () => void }) {
  return (
    <div role="status" data-bill-day-card-line style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem', padding: '0.15rem 0' }}>
      <strong>Bill day {shortDate(facts.billDay)}</strong>
      <span style={{ color: 'var(--text-muted)' }}>
        pay application {facts.number} · trades by {weekdayDate(facts.cutoff)} · {facts.inN} of {facts.of} in · gates {facts.ok} of {facts.gates}
      </span>
      <button type="button" onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit' }}>
        From the trades ›
      </button>
    </div>
  )
}
