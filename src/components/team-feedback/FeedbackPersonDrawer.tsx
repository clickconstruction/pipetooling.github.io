/**
 * People → Feedback (v2.2835): everything about one person — crew lanes over office, crew
 * notes, their open words, the dev-only rater list, and Reset for their deck cycle.
 */
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { RATING_DEFS } from '../prospects/ratingDimensions'
import { formatReviewMonthLabel, latestReviewsByReviewer } from '../../lib/prospects/teamMemberReviews'
import type { SourcedReviewRow } from '../../lib/people/crewReview'
import { roleLabel, submissionHasWords, type FeedbackPersonRow, type WordsSubmission } from '../../lib/people/feedbackTabRows'
import { parseOpenPrompts } from '../../lib/people/crewReview'
import { DeckChip, chipStyle } from './FeedbackPeopleTable'

type Props = {
  row: FeedbackPersonRow
  reviews: SourcedReviewRow[]
  submissions: WordsSubmission[]
  openPrompts: unknown
  nameOf: (userId: string) => string
  nowMs: number
  enabled: boolean
  resetting: boolean
  onReset: (userId: string) => void
  onClose: () => void
  narrow: boolean
}

export default function FeedbackPersonDrawer({ row, reviews, submissions, openPrompts, nameOf, nowMs, enabled, resetting, onReset, onClose, narrow }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const prompts = parseOpenPrompts(openPrompts)
  const crewRows = reviews.filter((r) => r.source === 'crew')
  const raters = latestReviewsByReviewer(crewRows, row.userId)
  const words = submissions
    .filter((s) => s.reviewer_user_id === row.userId && submissionHasWords(s))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const canReset = row.deck.kind !== 'off' && row.deck.kind !== 'due'

  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()} style={backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-person-title" onMouseDown={(e) => e.stopPropagation()} style={{ ...panel, width: narrow ? '100%' : 'min(560px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id="feedback-person-title" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>
            {row.name}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{roleLabel(row.role)}</span>
          <DeckChip deck={row.deck} nowMs={nowMs} />
          {(row.crew.crewRaterCount > 0 || row.crew.officeReviewerCount > 0) && (
            <span style={chipStyle('n')}>
              {row.crew.crewRaterCount} crew · {row.crew.officeReviewerCount} office
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            {enabled && canReset && (
              <button
                type="button"
                disabled={resetting}
                onClick={() => onReset(row.userId)}
                title="Clear this person's snooze and cycle so the deck is dealt at their next clock-out"
                style={secondary}
              >
                {resetting ? 'Resetting…' : 'Reset cycle'}
              </button>
            )}
            <button type="button" onClick={onClose} style={secondary}>
              Close
            </button>
          </div>
        </div>

        <div style={{ padding: '0.85rem 1rem 1.25rem', overflowY: 'auto', flex: '1 1 auto', display: 'grid', gap: '1rem' }}>
          <section>
            <SectionLabel>Crew over office</SectionLabel>
            {row.crew.crewRaterCount === 0 && row.crew.officeReviewerCount === 0 ? (
              <p style={muted}>No ratings yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 56px', gap: '0.3rem 0.75rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                {row.crew.lanes.map((lane) => (
                  <LaneRow key={lane.key} short={lane.short} color={lane.color} crew={lane.crew} office={lane.office} gap={lane.gap} />
                ))}
              </div>
            )}
            {row.crew.crewRaterCount === 1 && <p style={{ ...muted, marginTop: '0.4rem' }}>One crew rating. The office sees a crew average only once two people have rated.</p>}
          </section>

          {row.crew.crewNotes.length > 0 && (
            <section>
              <SectionLabel>Crew notes</SectionLabel>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                {row.crew.crewNotes.map((n, i) => (
                  <div key={i} style={quote}>
                    <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>
                      {n.short} · {formatReviewMonthLabel(n.month)}
                    </span>{' '}
                    {n.text}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionLabel>{row.name}&rsquo;s words · {words.length}</SectionLabel>
            {words.length === 0 ? (
              <p style={muted}>Nothing written yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                {words.flatMap((s) =>
                  (
                    [
                      [prompts[0], s.open_fix_improve],
                      [prompts[1], s.open_safety_tools],
                      [prompts[2], s.open_training],
                      [prompts[3], s.open_anything],
                    ] as Array<[string, string | null]>
                  )
                    .filter(([, t]) => t && t.trim())
                    .map(([heading, t], i) => (
                      <div key={`${s.id}-${i}`} style={quote}>
                        <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>
                          {heading} · {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>{' '}
                        {t}
                      </div>
                    )),
                )}
              </div>
            )}
          </section>

          {raters.length > 0 && (
            <section>
              <SectionLabel>Who rated {row.name} · dev only</SectionLabel>
              <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {raters.map((r) => (
                  <div key={r.id}>
                    <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{nameOf(r.reviewer_user_id)}</span> · {formatReviewMonthLabel(r.review_month)} ·{' '}
                    {[r.rating_ability, r.rating_drive, r.rating_integrity].map((v) => (v == null ? '—' : v)).join(' · ')}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function LaneRow({ short, color, crew, office, gap }: { short: string; color: string; crew: number | null; office: number | null; gap: boolean }) {
  return (
    <>
      <div style={{ color: 'var(--text-700)', fontWeight: 600 }}>
        {short}
        {gap && <span style={{ ...chipStyle('gap'), marginLeft: 6 }}>split</span>}
        <small style={{ display: 'block', color: 'var(--text-faint)', fontWeight: 400, fontSize: '0.66rem' }}>crew / office</small>
      </div>
      <div>
        <Bar value={crew} color={color} opacity={1} />
        <Bar value={office} color={color} opacity={0.4} />
      </div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>
        {crew == null ? '—' : Math.round(crew)}
        <small style={{ display: 'block', color: 'var(--text-faint)' }}>{office == null ? '—' : Math.round(office)}</small>
      </div>
    </>
  )
}

function Bar({ value, color, opacity }: { value: number | null; color: string; opacity: number }) {
  return (
    <div aria-hidden style={{ height: 5, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${value ?? 0}%`, background: color, opacity, borderRadius: 999 }} />
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: '0.64rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>{children}</div>
}

// Keep the dimension list imported for future per-dimension sections.
void RATING_DEFS

const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', justifyContent: 'flex-end' }
const panel: CSSProperties = { height: '100%', background: 'var(--surface)', color: 'var(--text-base)', borderLeft: '1px solid var(--border)', boxShadow: '-20px 0 40px -20px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }
const secondary: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }
const muted: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const quote: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-700)', paddingLeft: '0.6rem', borderLeft: '2px solid var(--border)' }
