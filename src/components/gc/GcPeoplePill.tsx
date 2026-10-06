import { useEffect, useRef, useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { telHref, type PeopleTone, type PersonReason, type ProjectPeopleSummary, type ProjectPerson } from '../../lib/gcMode/gcModel'
import { REASON_GROUPS, reasonGroup } from '../../lib/gcMode/gcCounts'

/**
 * GC mode design spike: one count of the people we are waiting on, in place of the board row's
 * chips (the owner, 2026-10-04: "say number of people to call and then when a user hovers over it
 * they see the details, much like the circle"; mock-up `people-to-call-mockup.html`). It behaves
 * like the ring: hover opens the card, a click pins it, Escape or a press elsewhere lets it go, and
 * a tap opens it on a phone. Each person has Call and Follow up.
 */

const TONE: Record<PeopleTone, { bg: string; fg: string; dot: string }> = {
  red: { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)', dot: 'var(--text-red-700)' },
  amber: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)', dot: 'var(--text-amber-700)' },
  grey: { bg: 'var(--bg-muted)', fg: 'var(--text-600)', dot: 'var(--border-strong)' },
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z& ]/g, '').split(/\s+/).filter((w) => w && w !== '&')
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function GcPeoplePill({
  summary,
  projectName,
  tourKey,
  onFollowUp,
  onWorkList,
  onOpenFollowUp,
  onReason,
}: {
  summary: ProjectPeopleSummary
  projectName: string
  tourKey?: string
  /** A reason about a bar pressed (G-146): open the job's Schedule tab at that bar. Unset: reasons are words only. */
  onReason?: (person: ProjectPerson, reason: PersonReason) => void
  /** Opens the Follow up sheet on this job's people, at them: on "What did they say?" after a Call. */
  onFollowUp: (person: ProjectPerson, calling: boolean) => void
  /** The Follow up sheet on this job's people, from the first. Null: nobody to call. */
  onWorkList: (() => void) | null
  onOpenFollowUp: () => void
}) {
  // On a phone the buttons go under each person's words instead of beside them.
  const narrow = useMatchMedia('(max-width: 480px)')
  const [hovered, setHovered] = useState(false)
  const [keyFocus, setKeyFocus] = useState(false)
  const [pinned, setPinned] = useState(false)
  const wrap = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (!pinned) return
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setPinned(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setKeyFocus(false)
      }
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [pinned])

  if (summary.count === 0 || !summary.tone) {
    return (
      <span data-tour={tourKey ? `gc-people-${tourKey}` : undefined} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <span aria-hidden style={{ color: 'var(--text-green-700)', fontWeight: 700 }}>✓ </span>
        Nobody to chase
      </span>
    )
  }

  const open = hovered || keyFocus || pinned
  const t = TONE[summary.tone]
  // Acting on someone opens a sheet or a window over the board: the card steps out of the way.
  const close = () => {
    setPinned(false)
    setHovered(false)
    setKeyFocus(false)
  }
  const words = `${summary.count} to call${summary.late > 0 ? ` · ${summary.late} late` : ''}`
  return (
    <span
      ref={wrap}
      data-tour={tourKey ? `gc-people-${tourKey}` : undefined}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // The row behind opens the project on a click; the pill and its card keep their clicks.
      onClick={(e) => e.stopPropagation()}
    >
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${words}. Show who and why.`}
        onClick={() => {
          setPinned((p) => !p)
          if (pinned) setHovered(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setKeyFocus(false)
            setHovered(false)
            setPinned(false)
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setPinned((p) => !p)
          }
        }}
        onFocus={(e) => setKeyFocus(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setKeyFocus(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.2rem 0.75rem 0.2rem 0.25rem',
          borderRadius: 999,
          background: t.bg,
          color: t.fg,
          fontWeight: 700,
          fontSize: '0.88rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden style={{ display: 'inline-grid', placeItems: 'center', minWidth: 22, height: 22, padding: '0 4px', borderRadius: 999, background: t.dot, color: 'var(--surface)', fontSize: '0.78rem' }}>
          {summary.count}
        </span>
        to call
        {summary.late > 0 && <span style={{ fontWeight: 600, opacity: 0.85 }}>· {summary.late} late</span>}
      </span>
      {open && (
        <span role="dialog" aria-label={`Who to call on ${projectName}`} style={{ position: 'absolute', top: '100%', left: -6, zIndex: 40, paddingTop: 6, cursor: 'default' }}>
          <span
            style={{
              display: 'grid',
              gap: 0,
              width: '29rem',
              maxWidth: 'calc(100vw - 2.5rem)',
              maxHeight: '70vh',
              overflowY: 'auto',
              padding: '0.7rem 0.85rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderTop: `3px solid ${t.dot}`,
              borderRadius: 10,
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.2)',
              color: 'var(--text-base)',
              fontSize: '0.82rem',
              lineHeight: 1.35,
              textAlign: 'left',
              whiteSpace: 'normal',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
              {summary.count} to call on {projectName}
            </span>
            <span style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Late first. One call covers every reason under a name.</span>
            <PeopleRows
              people={summary.people}
              narrow={narrow}
              onFollowUp={(person, calling) => {
                close()
                onFollowUp(person, calling)
              }}
              {...(onReason
                ? {
                    onReason: (person: ProjectPerson, reason: PersonReason) => {
                      close()
                      onReason(person, reason)
                    },
                  }
                : {})}
            />
            <span style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
              {onWorkList ? (
                <button
                  type="button"
                  onClick={() => {
                    close()
                    onWorkList()
                  }}
                  style={{ padding: '0.25rem 0.7rem', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Work the list
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => {
                  close()
                  onOpenFollowUp()
                }}
                style={{ padding: '0.25rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Open Follow up
              </button>
            </span>
          </span>
        </span>
      )}
    </span>
  )
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
}: {
  people: ProjectPerson[]
  narrow: boolean
  onFollowUp: (person: ProjectPerson, calling: boolean) => void
  /** A reason about a bar on the schedule pressed (the Gantt's call list, G-115): open that bar. Unset: reasons are words only. */
  onReason?: (person: ProjectPerson, reason: PersonReason) => void
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
              onFollowUp(person, true)
            }}
            title={`Call ${person.name}, ${person.phone}`}
            style={{ padding: '0.2rem 0.55rem', borderRadius: 6, background: '#2563eb', color: 'white', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Call
          </a>
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
        </span>
      </span>
      ))}
    </>
  )
}
