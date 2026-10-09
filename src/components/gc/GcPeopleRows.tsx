/**
 * GC mode, the real build, the schedule's PR 7c-ii: the people a job waits on, each with every reason under their name, the
 * last thing said, and Call. Moved word for word from the GC mode prototype (branch spike/gc-mode, `GcPeoplePill.tsx`); the plan
 * is to-dos/gc-mode/mockups/schedule-pr7c.md on that branch. The Board lane's file: its Who to call pill (B2b) wraps these rows
 * rather than making a second copy. One known difference: `onFollowUp` is optional. Unset, Call only dials and Follow up is not
 * drawn, until the Board lane lifts the Follow up sheet.
 */
import { telHref } from '../../lib/gc/followUpSheet'
import type { PeopleTone, PersonReason, ProjectPerson } from '../../lib/gc/projectPeople'
import { REASON_GROUPS, reasonGroup } from '../../lib/gc/schedule/counts'

const TONE: Record<PeopleTone, { bg: string; fg: string; dot: string }> = {
  red: { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)', dot: 'var(--text-red-700)' },
  amber: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)', dot: 'var(--text-amber-700)' },
  grey: { bg: 'var(--bg-muted)', fg: 'var(--text-600)', dot: 'var(--border-strong)' },
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z& ]/g, '').split(/\s+/).filter((w) => w && w !== '&')
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?'
}

/**
 * The people, each with every reason, the last thing said, and Call and Follow up: the Who to call
 * card's rows, and Follow up's list of everyone its cards do not show (the owner, 2026-10-04).
 */
export function PeopleRows({
  people,
  narrow,
  onFollowUp,
  onReason,
  theirWork,
}: {
  people: ProjectPerson[]
  narrow: boolean
  /** The Follow up sheet at this person, on "What did they say?" after a Call. Unset (the real build, until the Board lane lifts the sheet): Call only dials, and Follow up is not drawn. */
  onFollowUp?: (person: ProjectPerson, calling: boolean) => void
  /** A reason about a bar on the schedule pressed (the Gantt's call list, G-115): open that bar. Unset: reasons are words only. */
  onReason?: (person: ProjectPerson, reason: PersonReason) => void
  /** The chart's one company (G-13): a press that shows this person's company's work, or null when the chart has none of theirs. Unset: no link. */
  theirWork?: (person: ProjectPerson) => (() => void) | null
}) {
  return (
    <>
      {people.map((person) => (
      <span key={person.key} style={{ display: 'grid', gridTemplateColumns: narrow ? '28px minmax(0, 1fr)' : '28px minmax(0, 1fr) auto', gap: '0.15rem 0.6rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', alignItems: 'start' }}>
        <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.72rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {initials(person.name)}
        </span>
        <span style={{ display: 'grid', gap: '0.12rem', minWidth: 0 }}>
          <span>
            <strong>{person.name}</strong>
            {person.name !== person.company && <span style={{ color: 'var(--text-muted)' }}> {person.company}</span>}{' '}
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.66rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderRadius: 4,
                padding: '0 0.3rem',
                background: person.kind === 'trade' ? 'var(--bg-subtle)' : 'var(--bg-violet-100)',
                color: person.kind === 'trade' ? 'var(--text-600)' : 'var(--text-violet-800)',
                border: '1px solid var(--border)',
              }}
            >
              {person.tag}
            </span>
            {(() => {
              // Their work on the chart (G-13): only for a company the chart has bars for.
              const show = theirWork?.(person)
              return show ? (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={show}
                    title={`Show only ${person.company} on the chart`}
                    style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', cursor: 'pointer' }}
                  >
                    Their work
                  </button>
                </>
              ) : null
            })()}
          </span>
          {/* A call about the work is not a paper owed (G-146): the reasons in two groups, each worst first. */}
          {REASON_GROUPS.map((g) => {
            const reasons = person.reasons.filter((r) => reasonGroup(r.code) === g.key)
            if (reasons.length === 0) return null
            return (
              <span key={g.key} data-gc-reason-group={g.key} style={{ display: 'grid', gap: '0.12rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{g.words}</span>
                {reasons.map((r) => (
                <span key={r.text} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', ...(r.aside ? { color: 'var(--text-muted)' } : {}) }}>
                  {/* An aside (G-115) is said so the caller knows, not theirs to do: a hollow dot. */}
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', boxSizing: 'border-box', flex: 'none', transform: 'translateY(-1px)', ...(r.aside ? { border: `1.5px solid ${TONE.grey.dot}` } : { background: TONE[r.tone].dot }) }} />
                  {onReason && r.lineId ? (
                    <button
                      type="button"
                      onClick={() => onReason(person, r)}
                      title="Open this bar on the chart"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                    >
                      {r.text}
                    </button>
                  ) : (
                    r.text
                  )}
                </span>
                ))}
              </span>
            )
          })}
          {person.last && <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{person.last}</span>}
        </span>
        <span style={{ display: 'flex', gap: '0.3rem', ...(narrow ? { gridColumn: '2 / -1', marginTop: '0.2rem' } : {}) }}>
          <a
            href={telHref(person.phone)}
            onClick={() => {
              onFollowUp?.(person, true)
            }}
            title={`Call ${person.name}, ${person.phone}`}
            style={{ padding: '0.2rem 0.55rem', borderRadius: 6, background: '#2563eb', color: 'white', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Call
          </a>
          {onFollowUp && (
            <button
              type="button"
              onClick={() => {
                onFollowUp(person, false)
              }}
              title="A text or an email from you, drafted, with every reason on this job"
              style={{ padding: '0.2rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Follow up
            </button>
          )}
        </span>
      </span>
      ))}
    </>
  )
}
