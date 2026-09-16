import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { customerJourneys, type Journey } from '../../lib/customerJourneys'
import { PERSON_STATE_LABEL, type PersonJourney, type PersonStep, type PersonSubject } from '../../lib/journeys/personJourney'
import { loadPersonJourney } from '../../lib/journeys/loadPersonJourney'
import { withPreviewFlag } from '../../lib/publicViewCounting'

/**
 * A real person on the What-customers-see strips (v2.3508): the same journeys, one status card
 * per step — sent · opened · signed · paid · not yet — with the date, the link the person holds,
 * and the office's next move. Rendered in Settings → What customers see (mode "A person") and
 * on the Customer page as "Their journey". Reads only; every door is a link to the surface that
 * owns the action.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.85rem 1rem', marginBottom: '0.9rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const PILL: CSSProperties = { font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.12rem 0.55rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', whiteSpace: 'nowrap' }

const TONE: Record<'green' | 'amber' | 'red' | 'blue' | 'gray', CSSProperties> = {
  green: { background: 'var(--bg-green-50)', borderColor: 'var(--border-green)', color: 'var(--text-green-700)' },
  amber: { background: 'var(--bg-amber-50)', borderColor: 'var(--border-amber)', color: 'var(--text-amber-700)' },
  red: { background: 'var(--bg-red-50)', borderColor: 'var(--border-red)', color: 'var(--text-red-700)' },
  blue: { background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' },
  gray: { background: 'var(--sunken)', borderColor: 'var(--border)', color: 'var(--text-muted)' },
}

/** The office opens the page the person holds; a same-origin path is opened with the preview flag so it never counts as their visit. */
export function personLinkHref(link: string): string {
  if (/^https?:\/\//.test(link)) return link
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return withPreviewFlag(`${origin}${link}`)
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export function PersonJourneyStrips(props: { subject: PersonSubject; compact?: boolean }) {
  const { subject } = props
  const [state, setState] = useState<{ journey: PersonJourney | null; error: string | null; loading: boolean }>({ journey: null, error: null, loading: true })
  useEffect(() => {
    let cancelled = false
    setState({ journey: null, error: null, loading: true })
    loadPersonJourney(subject)
      .then((journey) => {
        if (!cancelled) setState({ journey, error: null, loading: false })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ journey: null, error: e instanceof Error ? e.message : 'Could not load this journey.', loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [subject])

  if (state.loading) return <div style={{ ...CARD, ...MUTED }}>Reading {subject.name}'s journey…</div>
  if (state.error || !state.journey) return <div style={{ ...CARD, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{state.error ?? 'Could not load this journey.'}</div>
  const journey = state.journey
  const all = customerJourneys()
  return (
    <div data-testid="person-journey">
      {journey.journeys.map((jid) => {
        const j = all.find((x) => x.id === jid)
        if (!j) return null
        return <PersonStrip key={jid} journey={j} person={journey} compact={props.compact} />
      })}
    </div>
  )
}

function PersonStrip(props: { journey: Journey; person: PersonJourney; compact?: boolean }) {
  const { journey, person } = props
  const first = firstName(person.subject.name)
  return (
    <section style={CARD} aria-label={`${journey.title} — ${person.subject.name}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{journey.title}</h3>
        <span style={MUTED}>{person.subject.name}'s journey, as it actually went · each card opens the page {first} holds</span>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: 0, alignItems: 'stretch', paddingBottom: '0.25rem' }}>
        {journey.steps.map((s, i) => {
          const step = person.steps[s.id]
          if (!step) return null
          return <PersonStepCard key={s.id} label={s.label} step={step} first={i === 0} personFirstName={first} compact={props.compact} />
        })}
      </div>
    </section>
  )
}

export function PersonStepCard(props: { label: string; step: PersonStep; first: boolean; personFirstName: string; compact?: boolean }) {
  const { step } = props
  const meta = PERSON_STATE_LABEL[step.state]
  const dim = step.state === 'na'
  return (
    <div
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.35rem', width: props.compact ? 168 : 188, flex: '0 0 auto', padding: '0 0.5rem', borderLeft: props.first ? 'none' : '1px solid var(--border)', opacity: dim ? 0.6 : 1 }}
      data-state={step.state}
    >
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.25, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{props.label}</span>
        <span style={{ ...PILL, ...TONE[meta.tone], padding: '0.05rem 0.45rem', fontSize: '0.66rem' }}>{meta.text}</span>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: 8, minHeight: props.compact ? 96 : 118, display: 'grid', alignContent: 'start', gap: '0.3rem', fontSize: '0.74rem', lineHeight: 1.3 }}>
        <div style={{ fontWeight: 600, color: dim ? 'var(--text-muted)' : 'var(--text-strong)' }}>{step.headline}</div>
        {step.detail ? <div style={MUTED}>{step.detail}</div> : null}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {step.link ? (
            <a href={personLinkHref(step.link)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
              Open as {props.personFirstName} →
            </a>
          ) : null}
          {step.action ? (
            <Link to={step.action.to} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
              {step.action.label} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
