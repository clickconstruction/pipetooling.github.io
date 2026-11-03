import { Link } from 'react-router-dom'
import { unchargedWords, type CrewUncharged } from '../../lib/charges/crewDays'

/**
 * The office's line when people out on a job count as nobody on the rate card yet (punch list #254, the live pass of
 * 2026-11-03): a day with nobody charged prices at nothing, and nothing else on the window said why or where to fix it.
 * Names each person with a door to their desk's *Charged as*, and the one place that sets everyone at once. Office
 * screens only; a customer's paper keeps its neutral reason.
 */
export function UnchargedCallout({ people, unpricedDays, onNavigate, margin = '0 1rem 0.5rem' }: { people: ReadonlyArray<CrewUncharged>; unpricedDays: number; onNavigate?: () => void; margin?: string }) {
  const words = unchargedWords(people)
  if (!words) return null
  return (
    <div
      role="note"
      data-testid="uncharged-callout"
      style={{ margin, padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem', color: 'var(--text-base)', display: 'grid', gap: '0.3rem' }}
    >
      <span style={{ fontWeight: 600 }}>
        {words} {unpricedDays > 0 ? `${unpricedDays} ${unpricedDays === 1 ? 'day prices' : 'days price'} at nothing until someone out counts as a master, a tech or a helper.` : 'Their hours add to the crew only once they count as something.'}
      </span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem', alignItems: 'baseline' }}>
        <Link to="/settings?tab=settings-jobs#who-counts-as-what" onClick={onNavigate} style={{ fontWeight: 600 }} data-testid="uncharged-who-counts">
          Set everyone in Who counts as what
        </Link>
        {people.slice(0, 6).map((p) => (
          <Link key={p.userId} to={`/people?tab=person&id=${encodeURIComponent(`u:${p.userId}`)}`} onClick={onNavigate}>
            {p.name}’s desk · {p.days} {p.days === 1 ? 'day' : 'days'}
          </Link>
        ))}
        {people.length > 6 ? <span style={{ color: 'var(--text-muted)' }}>and {people.length - 6} more</span> : null}
      </span>
    </div>
  )
}
