import { Link } from 'react-router-dom'
import { unchargedWords, type CrewUncharged } from '../../lib/charges/crewDays'
import { personIdOfCrewKey } from '../../lib/charges/chargeStandings'

/**
 * The office's line when people out on a job count as nobody on the rate card yet (punch list #254, the live pass of
 * 2026-11-03): a day with nobody charged prices at nothing, and nothing else on the window said why or where to fix it.
 * Names each person, and counts only the days a standing would fix (`unchargedDays`, v2.6484), never a day unpriced
 * for a missing rate-card row or a flat rate not set. A dev gets a door to each desk's *Charged as* and to the one place
 * that sets everyone at once; anyone else gets the words to ask a dev, since the Jobs & billing tab and the desk's
 * Charged as row open for a dev alone. A person with no login (v2.6501, keyed `person:<id>`) gets the door to their
 * People record, where their Charged as lives. Office screens only; a customer's paper keeps its neutral reason.
 */
export function UnchargedCallout({ people, unchargedDays, role, onNavigate, margin = '0 1rem 0.5rem' }: { people: ReadonlyArray<CrewUncharged>; unchargedDays: number; role: string | null | undefined; onNavigate?: () => void; margin?: string }) {
  const words = unchargedWords(people)
  if (!words) return null
  const dev = role === 'dev'
  return (
    <div
      role="note"
      data-testid="uncharged-callout"
      style={{ margin, padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem', color: 'var(--text-base)', display: 'grid', gap: '0.3rem' }}
    >
      <span style={{ fontWeight: 600 }}>
        {words} {unchargedDays > 0 ? `${unchargedDays} ${unchargedDays === 1 ? 'day prices' : 'days price'} at nothing until someone out counts as a master, a tech or a helper.` : 'Their hours add to the crew only once they count as something.'}
      </span>
      {dev ? (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem', alignItems: 'baseline' }}>
          <Link to="/settings?tab=settings-jobs#who-counts-as-what" onClick={onNavigate} style={{ fontWeight: 600 }} data-testid="uncharged-who-counts">
            Set everyone in Who counts as what
          </Link>
          {people.slice(0, 6).map((p) => {
            const personId = personIdOfCrewKey(p.userId)
            const days = `${p.days} ${p.days === 1 ? 'day' : 'days'}`
            return personId ? (
              <Link key={p.userId} to={`/people?tab=person&id=${encodeURIComponent(`p:${personId}`)}`} onClick={onNavigate}>
                {p.name}’s People record (no login) · {days}
              </Link>
            ) : (
              <Link key={p.userId} to={`/people?tab=person&id=${encodeURIComponent(`u:${p.userId}`)}`} onClick={onNavigate}>
                {p.name}’s desk · {days}
              </Link>
            )
          })}
          {people.length > 6 ? <span style={{ color: 'var(--text-muted)' }}>and {people.length - 6} more</span> : null}
        </span>
      ) : (
        <span data-testid="uncharged-ask-dev" style={{ color: 'var(--text-muted)' }}>
          Ask a dev to set who counts as what in Settings, under Rates charged by crew.
          {people.length ? ` ${people.slice(0, 6).map((p) => `${p.name} · ${p.days} ${p.days === 1 ? 'day' : 'days'}${personIdOfCrewKey(p.userId) ? ' (no login)' : ''}`).join(', ')}${people.length > 6 ? ` and ${people.length - 6} more` : ''}.` : ''}
        </span>
      )}
    </div>
  )
}
