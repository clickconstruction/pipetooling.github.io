/**
 * Bids → Submittals: the journey strip (v2.4067) — eight pills lit by the bid's state, under
 * four words (Build · Send · Their answer · Order, v2.4126),
 * (`submittalJourney`), the next thing to do with the button that does it, the
 * walkthrough door, and the first-open offer. Renders and reports only: the tab wires
 * each action to the handler its button row already calls.
 */
import type { CSSProperties } from 'react'
import { groupJourneyStages, type JourneyAction, type JourneyStage, type SubmittalJourney } from '../../lib/submittals/submittalJourney'

const pillBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.15rem 0.6rem 0.15rem 0.25rem', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.3, color: 'var(--text-muted)', background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }
const numBase: CSSProperties = { width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--border-strong)', display: 'inline-grid', placeItems: 'center', fontSize: '0.62rem', fontWeight: 700 }

function pillStyle(status: JourneyStage['status']): { pill: CSSProperties; num: CSSProperties } {
  if (status === 'done') return { pill: { ...pillBase, borderColor: 'var(--text-green-600)', color: 'var(--text-green-700)' }, num: { ...numBase, borderColor: 'var(--text-green-600)', color: 'var(--text-green-700)' } }
  if (status === 'current') return { pill: { ...pillBase, borderColor: '#2563eb', color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', fontWeight: 700 }, num: { ...numBase, borderColor: '#2563eb', background: '#2563eb', color: '#fff' } }
  if (status === 'waiting') return { pill: { ...pillBase, borderColor: '#f59e0b', color: 'var(--text-amber-800)', background: 'var(--bg-yellow-tint)', fontWeight: 600 }, num: { ...numBase, borderColor: '#f59e0b', color: 'var(--text-amber-800)' } }
  return { pill: pillBase, num: numBase }
}

const groupWord = (status: JourneyStage['status']): CSSProperties => ({
  fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2,
  color: status === 'done' ? 'var(--text-green-700)' : status === 'current' ? 'var(--text-blue-700)' : status === 'waiting' ? 'var(--text-amber-800)' : 'var(--text-muted)',
})

const btn: CSSProperties = { fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.3, padding: '0.28rem 0.7rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff', fontWeight: 600 }

export function SubmittalJourneyStrip({
  journey,
  busy,
  onAction,
  onGoToStage,
  onWalkThrough,
  offerWalkThrough,
  onDismissOffer,
}: {
  journey: SubmittalJourney
  busy: boolean
  /** The next line's button: the tab runs the same handler its button row calls. */
  onAction: (action: JourneyAction) => void
  /** A click on a pill: scroll to and flash that stage's controls. */
  onGoToStage: (stage: JourneyStage) => void
  onWalkThrough: () => void
  /** The first open on this device: a line under the pills offers the walkthrough in words. */
  offerWalkThrough: boolean
  onDismissOffer: () => void
}) {
  const { stages, next } = journey
  const lead = next.kind === 'next' ? 'Next: ' : next.kind === 'waiting' ? 'Waiting: ' : 'Done: '
  return (
    <div data-tour="submittals-journey" data-testid="submittal-journey" style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Where this submittal is</span>
        <button type="button" onClick={onWalkThrough} style={btn} title="A one-minute walkthrough of every stage, from the schedule to the GC's approval">
          Walk me through it ▶
        </button>
      </div>
      <div role="list" aria-label="Submittal stages" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {groupJourneyStages(stages).map((g, gi, groups) => (
          <div key={g.label} role="group" aria-label={g.label} data-testid="journey-group" data-status={g.status} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={groupWord(g.status)}>{g.label}</span>
            <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {g.stages.map((s, i) => {
                const st = pillStyle(s.status)
                const word = s.status === 'done' ? 'done' : s.status === 'current' ? 'you are here' : s.status === 'waiting' ? 'waiting on the reviewer' : 'later'
                const lastPill = i === g.stages.length - 1 && gi === groups.length - 1
                return (
                  <span key={s.key} role="listitem" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button type="button" onClick={() => onGoToStage(s)} style={st.pill} aria-label={`${s.number} ${s.label} · ${word}`} data-testid="journey-stage" data-status={s.status} title={word}>
                      <span style={st.num} aria-hidden>{s.status === 'done' ? '✓' : s.number}</span>
                      {s.label}
                    </button>
                    {!lastPill ? <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>›</span> : null}
                  </span>
                )
              })}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="journey-next" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
        <span>
          <b style={{ color: 'var(--text-strong)' }}>{lead}</b>
          {next.text}
        </span>
        {next.action && next.actionLabel ? (
          <button type="button" disabled={busy} onClick={() => onAction(next.action as JourneyAction)} style={next.kind === 'waiting' ? btn : btnPrimary}>
            {next.actionLabel}
          </button>
        ) : null}
      </div>
      {offerWalkThrough ? (
        <div data-testid="journey-offer" style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.4rem 0.7rem', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span>
            <b style={{ color: 'var(--text-strong)' }}>New here?</b> Walk through how Submittals works, from the schedule to the GC’s approval. About a minute.
          </span>
          <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={onWalkThrough} style={btnPrimary}>
              Walk me through it ▶
            </button>
            <button type="button" onClick={onDismissOffer} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'underline dotted', cursor: 'pointer' }}>
              Not now
            </button>
          </span>
        </div>
      ) : null}
    </div>
  )
}
