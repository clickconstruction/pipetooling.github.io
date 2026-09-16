import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { customerJourneys, findStep, firstRenderableStep, type Journey, type JourneyId, type JourneyStep } from '../../lib/customerJourneys'
import { CUSTOMER_SAMPLE_SETTING_KEYS, buildSampleEmail, type AppSettingRow, type SampleEmailContext } from '../../lib/customerSampleEmails'
import { SAMPLE_GC, SAMPLE_HOMEOWNER, SAMPLE_SUB } from '../../lib/customerSample'
import { TestReportSampleCard } from './TestReportSampleCard'
import { coverageLine, journeyCoverage } from '../../lib/customerSurfaceRegistry'
import { PersonPicker } from '../journeys/PersonPicker'
import { PersonJourneyStrips } from '../journeys/PersonJourneyStrips'
import type { PersonSubject } from '../../lib/journeys/personJourney'

/**
 * Settings → What customers see (dev-only, v2.2758; owner pick B "Journeys" from the
 * 2026-09-04 mockups). Every customer-facing surface, rendered live: public pages open in
 * iframes with the sample token (the edge function lays the fixture over today's Settings),
 * emails are built right here by the same builders the senders use. One strip per audience,
 * in the order they meet each surface; tap a step to see it large, phone or desktop.
 */

type Device = 'phone' | 'desktop'
type Mode = 'sample' | 'person'

/** `?who=customer:<id>:<name>` — the Customer page's door into a person's journey (v2.3508). */
export function parseWhoParam(raw: string | null): PersonSubject | null {
  if (!raw) return null
  const [kind, id, ...rest] = raw.split(':')
  const name = rest.join(':')
  if (!id || !name) return null
  if (kind === 'customer' || kind === 'sub' || kind === 'house' || kind === 'firm') return { kind, id, name }
  return null
}

export function whoParam(s: PersonSubject): string {
  // URLSearchParams encodes the value once; the name is carried as-is.
  return `${s.kind}:${s.id}:${s.name}`
}
const PHONE_WIDTH = 390
const THUMB_SCALE = 0.4
const THUMB_W = Math.round(PHONE_WIDTH * THUMB_SCALE)
const THUMB_H = 220
const FRAME_H = 760

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.85rem 1rem', marginBottom: '0.9rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const PILL: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const PILL_ON: CSSProperties = { ...PILL, background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }

type SampleEmails = Record<string, { subject: string; html: string; text: string }>

export function SettingsWhatCustomersSeeTab() {
  const { user, profileName } = useAuth()
  const [rows, setRows] = useState<AppSettingRow[] | null>(null)
  const [senderPhone, setSenderPhone] = useState('')
  const [device, setDevice] = useState<Device>('phone')
  const [searchParams, setSearchParams] = useSearchParams()
  // v2.3508: Sample is the default; a person from the search box or the ?who= door turns every step into what actually happened.
  const [person, setPerson] = useState<PersonSubject | null>(() => parseWhoParam(searchParams.get('who')))
  const mode: Mode = person ? 'person' : 'sample'
  const choosePerson = (s: PersonSubject | null) => {
    setPerson(s)
    const next = new URLSearchParams(searchParams)
    if (s) next.set('who', whoParam(s))
    else next.delete('who')
    setSearchParams(next, { replace: true })
  }
  const journeys = useMemo(() => customerJourneys(), [])
  const [selected, setSelected] = useState<{ journeyId: JourneyId; stepId: string } | null>(() => firstRenderableStep(customerJourneys()))
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [settings, me] = await Promise.all([
          withSupabaseRetry(() => supabase.from('app_settings').select('key, value_text').in('key', [...CUSTOMER_SAMPLE_SETTING_KEYS]), 'what-customers-see settings'),
          user?.id ? withSupabaseRetry(() => supabase.from('users').select('phone').eq('id', user.id).maybeSingle(), 'what-customers-see sender') : Promise.resolve(null),
        ])
        if (cancelled) return
        setRows(((settings ?? []) as AppSettingRow[]).map((r) => ({ key: r.key, value_text: r.value_text })))
        setSenderPhone(String((me as { phone?: string | null } | null)?.phone ?? '').trim())
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, reloadNonce])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const emails = useMemo((): SampleEmails | null => {
    if (!rows) return null
    const ctx: SampleEmailContext = {
      rows,
      origin,
      todayYmd: todayYmdInAppTz(),
      dateLabel: new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()),
      sender: user?.email ? { name: profileName?.trim() || '', email: user.email, phone: senderPhone } : null,
    }
    const out: SampleEmails = {}
    for (const id of ['estimate', 'bid-room', 'bid-room-revised', 'contract'] as const) out[id] = buildSampleEmail(id, ctx)
    return out
  }, [rows, origin, user?.email, profileName, senderPhone])

  const selectedStep = selected ? findStep(journeys, selected.journeyId, selected.stepId) : null

  return (
    <div>
      {/* v2.3508: the mode bar — Sample (the fixture, every surface) or A person (their journey as it actually went). */}
      <div style={{ ...CARD, display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1rem', alignItems: 'center' }} data-testid="wcs-mode">
        <div style={{ display: 'flex', gap: '0.35rem' }} role="radiogroup" aria-label="Show">
          <button type="button" role="radio" aria-checked={mode === 'sample'} style={mode === 'sample' ? PILL_ON : PILL} onClick={() => choosePerson(null)}>Sample</button>
          <button type="button" role="radio" aria-checked={mode === 'person'} style={mode === 'person' ? PILL_ON : PILL} onClick={() => document.getElementById('person-picker-search')?.focus()}>A person</button>
        </div>
        <div style={{ flex: '1 1 320px' }}>
          <PersonPicker value={person} onChange={choosePerson} />
        </div>
      </div>
      {person ? (
        <>
          <div style={{ ...CARD, padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'center' }}>
            <strong style={{ color: 'var(--text-strong)' }}>{person.name}</strong>
            <span style={MUTED}>What was sent, when they opened it, where they stopped. Each card opens the page they hold, as they see it; nothing here writes.</span>
            <Link to={person.kind === 'customer' ? `/customers/${person.id}` : person.kind === 'sub' ? '/people?tab=subs' : person.kind === 'house' ? '/materials' : '/customers'} style={{ ...PILL, marginLeft: 'auto', textDecoration: 'none' }}>
              Open their record →
            </Link>
          </div>
          <PersonJourneyStrips subject={person} />
        </>
      ) : null}

      <div style={{ ...CARD, display: person ? 'none' : 'flex', flexWrap: 'wrap', gap: '0.6rem 1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button type="button" style={device === 'phone' ? PILL_ON : PILL} onClick={() => setDevice('phone')}>Phone</button>
          <button type="button" style={device === 'desktop' ? PILL_ON : PILL} onClick={() => setDevice('desktop')}>Desktop</button>
        </div>
        <span style={MUTED}>
          Sample data: <strong style={{ color: 'var(--text-strong)' }}>{SAMPLE_HOMEOWNER.name}</strong> · {SAMPLE_HOMEOWNER.address} · Bid{' '}
          <strong style={{ color: 'var(--text-strong)' }}>Cedar Bend Apartments</strong> for <strong style={{ color: 'var(--text-strong)' }}>{SAMPLE_GC.company}</strong> · Sub{' '}
          <strong style={{ color: 'var(--text-strong)' }}>{SAMPLE_SUB.company}</strong>. Nothing here exists in the database; nothing you do on a sample page is saved.
        </span>
        <button type="button" style={{ ...PILL, marginLeft: 'auto' }} onClick={() => setReloadNonce((n) => n + 1)} title="Re-read Settings and reload every frame">
          Refresh all
        </button>
      </div>

      {/* v2.3505: the count, and the promise behind it — customerSurfaceRegistry.test.ts fails CI when a public route or an outside email sender has no step here. */}
      <div style={{ ...CARD, padding: '0.55rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'center', fontSize: '0.82rem' }} data-testid="wcs-coverage">
        <strong style={{ color: 'var(--text-strong)' }}>{coverageLine(journeyCoverage(journeys))}</strong>
        <span style={MUTED}>Every public page and every email the app sends to someone outside the company has a place on this tab — a test checks it on every change. <em>Next release</em> cards name the surface and the PR that renders it.</span>
      </div>
      <div style={{ display: person ? 'none' : 'block' }}>
      {/* Test reports PR 1 (v2.3296): the paper, before any job carries one. */}
      <TestReportSampleCard />

      {journeys.map((j) => (
        <JourneyStrip
          key={j.id}
          journey={j}
          emails={emails}
          origin={origin}
          reloadNonce={reloadNonce}
          selectedStepId={selected?.journeyId === j.id ? selected.stepId : null}
          onSelect={(stepId) => setSelected({ journeyId: j.id, stepId })}
        >
          {selected?.journeyId === j.id && selectedStep ? (
            <ExpandedStep step={selectedStep} device={device} emails={emails} origin={origin} reloadNonce={reloadNonce} />
          ) : null}
        </JourneyStrip>
      ))}
      </div>
    </div>
  )
}

function JourneyStrip(props: {
  journey: Journey
  emails: SampleEmails | null
  origin: string
  reloadNonce: number
  selectedStepId: string | null
  onSelect: (stepId: string) => void
  children?: React.ReactNode
}) {
  const { journey } = props
  return (
    <section style={CARD} aria-label={journey.title}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{journey.title}</h3>
        <span style={MUTED}>{journey.subtitle}</span>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: 0, alignItems: 'stretch', paddingBottom: '0.25rem' }}>
        {journey.steps.map((s, i) => (
          <StepCard
            key={s.id}
            step={s}
            first={i === 0}
            selected={props.selectedStepId === s.id}
            emails={props.emails}
            origin={props.origin}
            reloadNonce={props.reloadNonce}
            onSelect={() => props.onSelect(s.id)}
          />
        ))}
      </div>
      {props.children}
    </section>
  )
}

function StepCard(props: { step: JourneyStep; first: boolean; selected: boolean; emails: SampleEmails | null; origin: string; reloadNonce: number; onSelect: () => void }) {
  const { step, selected } = props
  const renderable = step.render.kind === 'page' || step.render.kind === 'email'
  // v2.3507: every card opens — a Next-release or sent-elsewhere step expands to its note and what the person can do there.
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: '0.35rem', width: 188, flex: '0 0 auto', padding: '0 0.5rem', position: 'relative', borderLeft: props.first ? 'none' : '1px dashed var(--border)' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.25 }}>
        {step.label}
        <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{step.sublabel}</span>
      </div>
      <button
        type="button"
        onClick={props.onSelect}
        aria-pressed={selected}
        aria-label={`${step.label} — ${renderable ? 'show large' : 'not rendered'}`}
        style={{
          font: 'inherit',
          padding: 8,
          borderRadius: 8,
          border: selected ? '2px solid var(--border-blue)' : '1px solid var(--border)',
          background: 'var(--bg-page)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'start center',
          minHeight: THUMB_H + 16,
        }}
      >
        {renderable ? (
          <StepThumb step={step} emails={props.emails} origin={props.origin} reloadNonce={props.reloadNonce} />
        ) : (
          <span style={{ ...MUTED, textAlign: 'left', fontSize: '0.72rem', lineHeight: 1.35 }}>
            {step.render.kind === 'external' ? 'Sent by another system' : 'Next release'}
            <br />
            <span style={{ color: 'var(--text-muted)' }}>{step.render.kind === 'external' || step.render.kind === 'soon' ? step.render.note : ''}</span>
          </span>
        )}
      </button>
      <span style={{ ...MUTED, fontSize: '0.72rem' }}>{step.when}</span>
    </div>
  )
}

/** A live thumbnail: the real frame at phone width, scaled down, inert. */
function StepThumb(props: { step: JourneyStep; emails: SampleEmails | null; origin: string; reloadNonce: number }) {
  const frame = frameProps(props.step, props.emails, props.origin, props.reloadNonce)
  return (
    <div style={{ width: THUMB_W, height: THUMB_H, overflow: 'hidden', borderRadius: 4, background: 'var(--surface)', pointerEvents: 'none' }} aria-hidden="true">
      {frame ? (
        <iframe
          key={frame.key}
          {...frame.attrs}
          tabIndex={-1}
          loading="lazy"
          style={{ width: PHONE_WIDTH, height: THUMB_H / THUMB_SCALE, border: 0, transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top left', background: '#f3f5f7' }}
        />
      ) : (
        <span style={MUTED}>Loading…</span>
      )}
    </div>
  )
}

function ExpandedStep(props: { step: JourneyStep; device: Device; emails: SampleEmails | null; origin: string; reloadNonce: number }) {
  const { step, device } = props
  const frame = frameProps(step, props.emails, props.origin, props.reloadNonce)
  const email = step.render.kind === 'email' ? props.emails?.[step.render.email] ?? null : null
  const openUrl = step.render.kind === 'page' ? `${props.origin}${step.render.path}` : null
  return (
    <div style={{ marginTop: '0.75rem', border: '1px solid var(--border-blue)', borderRadius: 10, padding: '0.75rem 0.9rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.9rem', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.8rem' }}>
        <strong style={{ color: 'var(--text-strong)' }}>{step.label}</strong>
        {email ? <span style={{ color: 'var(--text-700)' }}>Subject: {email.subject}</span> : null}
        {openUrl ? (
          <a href={openUrl} target="_blank" rel="noopener noreferrer" style={{ ...PILL, textDecoration: 'none' }}>
            Open in new tab
          </a>
        ) : null}
        <Link to={`/help?g=${encodeURIComponent(step.guide)}`} style={{ ...PILL, textDecoration: 'none' }} title="The help guide for sending this">
          How to send it →
        </Link>
        {step.reflects.length > 0 ? (
          <span style={{ ...MUTED, marginLeft: 'auto' }}>
            Reflects: {step.reflects.join(' · ')}
          </span>
        ) : null}
      </div>
      {/* v2.3507: the teaching lines — what sends it, when, and what the person can do there. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.4rem 1rem', marginBottom: '0.6rem', fontSize: '0.8rem' }}>
        <div><span style={MUTED}>What sends it</span><br /><span style={{ color: 'var(--text-strong)' }}>{step.sublabel}</span></div>
        <div><span style={MUTED}>When</span><br /><span style={{ color: 'var(--text-strong)' }}>{step.when}</span></div>
        <div><span style={MUTED}>What they can do there</span><br /><span style={{ color: 'var(--text-strong)' }}>{step.customerCan}</span></div>
      </div>
      <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '0.9rem', display: 'grid', placeItems: 'start center' }}>
        {step.render.kind === 'soon' || step.render.kind === 'external' ? (
          <div style={{ maxWidth: 560, fontSize: '0.85rem', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-strong)' }}>{step.render.kind === 'external' ? 'Sent by another system' : 'Next release'}</strong>
            <div style={{ color: 'var(--text-700)', marginTop: '0.3rem' }}>{step.render.note}</div>
          </div>
        ) : frame ? (
          <iframe
            key={frame.key}
            {...frame.attrs}
            title={step.label}
            style={{ width: device === 'phone' ? PHONE_WIDTH : '100%', height: FRAME_H, border: '1px solid var(--border)', borderRadius: device === 'phone' ? 18 : 8, background: '#f3f5f7' }}
          />
        ) : (
          <span style={MUTED}>Loading…</span>
        )}
      </div>
      {email ? (
        <details style={{ marginTop: '0.6rem' }}>
          <summary style={{ ...MUTED, cursor: 'pointer' }}>Plain-text part</summary>
          <pre style={{ margin: '0.4rem 0 0', whiteSpace: 'pre-wrap', font: 'inherit', fontSize: '0.78rem', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem' }}>{email.text}</pre>
        </details>
      ) : null}
    </div>
  )
}

/** iframe props for a renderable step: a same-origin page URL, or the built email as srcDoc. */
function frameProps(step: JourneyStep, emails: SampleEmails | null, origin: string, reloadNonce: number): { key: string; attrs: { src?: string; srcDoc?: string; sandbox?: string; title: string } } | null {
  if (step.render.kind === 'page') {
    return { key: `${step.id}-${reloadNonce}`, attrs: { src: `${origin}${step.render.path}&v=${reloadNonce}`, title: step.label } }
  }
  if (step.render.kind === 'email') {
    const m = emails?.[step.render.email]
    if (!m) return null
    return { key: `${step.id}-${reloadNonce}`, attrs: { srcDoc: m.html, sandbox: '', title: step.label } }
  }
  return null
}
