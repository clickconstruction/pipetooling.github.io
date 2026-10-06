/**
 * GC mode design spike: the window before companies are asked to quote (the owner, 2026-10-05:
 * "build the confirm window"; mock-up `to-dos/gc-mode/ask-companies-mockup.html`). Trade partners'
 * "Ask the 2 we have not asked", a company's "+ Ask on …" and the assistants' Ask all open it.
 * Left: the job, the trade, and each company with what helps choose. Right: the invitation the
 * picked company would get, in its own language. In the prototype nothing leaves the app.
 */
import { useEffect, useState, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import { GC_COMPANY, daysUntil, planLabel, currentRev, weekdayDate, type GcAction, type GcState } from '../../lib/gcMode/gcModel'
import { portalLink, portalQuoteDue } from '../../lib/gcMode/gcPortal'
import { pt } from '../../lib/gcMode/gcPortalI18n'
import { askChoices, askDraft, askStanding, type AskChoice } from '../../lib/gcMode/gcAskCompanies'
import type { AnswerRecord } from '../../lib/gcMode/gcReliability'
import { Btn, Chip, type Tone } from './gcUi'

/** The bench's words for how a company answers when asked. */
const RECORD_WORDS: Record<AnswerRecord, { tone: Tone; word: string }> = {
  new: { tone: 'grey', word: 'new to us' },
  reliable: { tone: 'green', word: 'answers' },
  mixed: { tone: 'amber', word: 'hit or miss' },
  silent: { tone: 'red', word: 'often silent' },
}

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

export function GcAskCompanies({
  state,
  dispatch,
  projectId,
  packageId,
  tick,
  onClose,
}: {
  state: GcState
  dispatch: Dispatch<GcAction>
  projectId: string
  packageId: string
  /** The companies ticked when it opens. Unset: every company in range that we have not declined. */
  tick?: string[]
  onClose: () => void
}) {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  const choices = askChoices(state, projectId, packageId)
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(tick ?? choices.filter((c) => c.inZone && !c.declined).map((c) => c.partner.id)),
  )
  // The company whose invitation shows on the right: the first ticked one, until a row is pressed.
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!project || !pkg) return null

  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches
  const asking = choices.filter((c) => picked.has(c.partner.id))
  const showing = choices.find((c) => c.partner.id === shown) ?? asking[0] ?? choices[0] ?? null
  const draft = showing ? askDraft(state, projectId, packageId, showing.partner.id) : null
  const lang = showing?.partner.lang ?? 'en'
  const standing = askStanding(state, projectId, packageId, asking.length)
  const due = project.ourBidSentOn === null ? portalQuoteDue(project) : null
  const dueDays = due ? daysUntil(due, state.today) : null
  const toggle = (id: string) =>
    setPicked((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const send = () => {
    for (const c of asking) dispatch({ type: 'invite', projectId, packageId, partnerId: c.partner.id })
    onClose()
  }
  const first = choices.filter((c) => c.inZone && !c.declined)
  const rest = choices.filter((c) => !c.inZone || c.declined)

  const row = (c: AskChoice) => {
    const on = picked.has(c.partner.id)
    const record = RECORD_WORDS[c.record]
    const main = c.to[0]
    return (
      <div
        key={c.partner.id}
        onClick={() => setShown(c.partner.id)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: '0.6rem',
          padding: '0.55rem 0.6rem',
          borderRadius: 8,
          cursor: 'pointer',
          border: `1px solid ${showing?.partner.id === c.partner.id ? 'var(--border-blue)' : 'var(--border)'}`,
          background: showing?.partner.id === c.partner.id ? 'var(--bg-blue-50)' : 'transparent',
          opacity: on ? 1 : 0.8,
        }}
      >
        <input
          type="checkbox"
          checked={on}
          onChange={() => toggle(c.partner.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Ask ${c.partner.company}`}
          style={{ marginTop: '0.2rem' }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{c.partner.company}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', overflowWrap: 'anywhere' }}>
            {c.to.map((t) => t.name).join(', ')}
            {main?.email ? ` · ${main.email}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
            <Chip tone={record.tone}>
              {record.word}
              {c.partner.invited > 0 ? ` · ${c.partner.bids} of ${c.partner.invited}` : ''}
            </Chip>
            {c.travel && <Chip tone={c.inZone ? 'grey' : 'amber'}>{c.travel}</Chip>}
            {c.partner.lang === 'es' && <Chip tone="grey">Español</Chip>}
            {c.notVetted && (
              <Chip tone="amber" title="It can quote. No award until we approve it on Trade partners.">
                not vetted yet
              </Chip>
            )}
            {c.declined && <Chip tone="red">we declined them</Chip>}
            {!main?.email && <Chip tone="red">no email on file</Chip>}
          </div>
        </div>
      </div>
    )
  }

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ask for ${pkg.trade} quotes`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: phone ? '12px 12px 0 0' : 12,
          width: phone ? '100%' : 'min(920px, 100%)',
          maxHeight: phone ? '92vh' : 'min(92vh, 720px)',
          display: 'grid',
          gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
          overflow: phone ? 'auto' : 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.22)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--border)' }}>
          <div style={{ padding: '1rem 1rem 0.6rem', display: 'grid', gap: '0.35rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Ask for {pkg.trade} quotes</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
              {project.name} · {project.sizeNote}
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
              <Chip tone={standing.quotes >= standing.wanted ? 'green' : standing.quotes === 0 ? 'red' : 'amber'}>
                {standing.quotes} of {standing.wanted} quotes
              </Chip>
              {standing.out > 0 && <Chip tone="grey">{standing.out} asked, no quote yet</Chip>}
              {due && dueDays !== null && (
                <Chip tone={dueDays <= 7 ? 'red' : 'grey'}>
                  Quotes wanted {weekdayDate(due)} · {dueDays < 0 ? 'passed' : dueDays === 1 ? '1 day' : `${dueDays} days`}
                </Chip>
              )}
              <Chip tone="grey">Plans: {planLabel(project, currentRev(project))}</Chip>
              <Chip tone={pkg.scope.length === 0 ? 'red' : 'grey'}>{pkg.scope.length === 1 ? '1 scope line' : `${pkg.scope.length} scope lines`}</Chip>
            </div>
          </div>
          <div style={{ padding: '0 1rem 0.8rem', overflowY: 'auto', display: 'grid', gap: '0.45rem', alignContent: 'start', minHeight: 0, flex: 1 }}>
            {choices.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Every company in this trade is already asked on this job.</div>}
            {first.length > 0 && <div style={label}>Who to ask</div>}
            {first.map(row)}
            {rest.length > 0 && <div style={{ ...label, marginTop: first.length > 0 ? '0.3rem' : 0 }}>Too far, or declined</div>}
            {rest.map(row)}
          </div>
          <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 12rem' }}>
              {standing.words}
              {asking.length > 0 ? ' In the prototype nothing leaves the app.' : ''}
            </span>
            <Btn kind="quiet" onClick={onClose}>
              Cancel
            </Btn>
            <Btn kind="primary" disabled={asking.length === 0} onClick={send}>
              {asking.length === 1 ? `Ask ${asking[0]?.partner.company ?? '1 company'}` : `Ask ${asking.length} companies`}
            </Btn>
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'var(--bg-muted)', overflowY: phone ? 'visible' : 'auto', minWidth: 0, display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
          <div style={label}>{asking.length > 1 ? 'The email each one gets' : 'The email they get'}</div>
          {asking.length > 1 && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {asking.map((c) => {
                const on = showing?.partner.id === c.partner.id
                return (
                  <button
                    key={c.partner.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setShown(c.partner.id)}
                    style={{
                      border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                      borderRadius: 999,
                      padding: '0.15rem 0.6rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: on ? 600 : 400,
                      background: on ? 'var(--bg-blue-50)' : 'var(--surface)',
                      color: on ? 'var(--text-blue-800)' : 'var(--text-muted)',
                    }}
                  >
                    {c.partner.company}
                    {c.partner.lang === 'es' ? ' · Español' : ''}
                  </button>
                )
              })}
            </div>
          )}
          {draft && showing ? (
            <article style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', display: 'grid', gap: '0.1rem' }}>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>From </span>
                  {GC_COMPANY.name}
                </span>
                <span style={{ overflowWrap: 'anywhere' }}>
                  <span style={{ color: 'var(--text-muted)' }}>To </span>
                  {showing.to.map((t) => (t.email ? `${t.name} <${t.email}>` : t.name)).join(', ')}
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{draft.subject}</span>
              </div>
              <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
                {draft.lines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
                {draft.scope && draft.scope.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.15rem' }}>
                    {draft.scope.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {draft.leavesOut && (
                  <>
                    <div>{pt(lang, 'mInviteLeavesOut')}</div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.15rem' }}>
                      {draft.leavesOut.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{portalLink(showing.partner.id)}</div>
              </div>
            </article>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Pick a company to read its invitation.</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
