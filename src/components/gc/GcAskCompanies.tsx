import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { askChoices, askStanding, type AskChoice } from '../../lib/gc/askCompanies'
import type { AskOutcome } from '../../lib/gc/askEmail'
import { GC_COMPANY } from '../../lib/gc/company'
import { currentRev, planLabel } from '../../lib/gc/lookups'
import { inviteMessage, portalQuoteDue } from '../../lib/gc/portal'
import { pt, type PortalLang } from '../../lib/gc/portalI18n'
import type { AnswerRecord } from '../../lib/gc/reliability'
import type { GcState, Invite } from '../../lib/gc/types'
import { daysUntil, weekdayDate } from '../../lib/gc/words'
import { Btn, Chip, type Tone } from './gcUi'

/**
 * GC mode, the real build (the Board's B4-a): the window before companies are asked to quote, from
 * the design spike's `GcAskCompanies.tsx` (the owner, 2026-10-05: "build the confirm window").
 * Left: the job, the trade, and each company not yet asked, with what helps choose. Right: the
 * invitation the picked company would get, in its own language, drawn by the Portal's
 * `inviteMessage`. **Ask N companies** records each ask (`gc_invite_companies`) and, for a dev, emails
 * each invitation through the Portal's sender (P3, v2.4939). An invitation that does not go out is
 * listed with the reason before the window closes; the ask is saved either way.
 */

/** The bench's words for how a company answers when asked. */
const RECORD_WORDS: Record<AnswerRecord, { tone: Tone; word: string }> = {
  new: { tone: 'grey', word: 'new to us' },
  reliable: { tone: 'green', word: 'answers' },
  mixed: { tone: 'amber', word: 'hit or miss' },
  silent: { tone: 'red', word: 'often silent' },
}

/** What the window says under the count: the invitations go out now, wait for the tick, or wait for a dev. */
const ASK_EMAIL_WORDS = 'Each company gets this invitation by email now, with its portal link.'
const ASK_EMAIL_OFF_WORDS = 'The asks are saved without an email. Tick Email the invitations now to send them.'
const ASK_NOT_SENT_WORDS = 'The asks are saved. A dev sends the invitation emails while GC mode is built.'

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

export function GcAskCompanies({
  state,
  projectId,
  packageId,
  tick,
  langs,
  emails = false,
  onAsk,
  onClose,
}: {
  state: GcState
  projectId: string
  packageId: string
  /** The companies ticked when it opens. Unset: every company in range that we have not declined. */
  tick?: string[]
  /** Each company's language, by id. Missing: English. */
  langs: Record<string, PortalLang>
  /** The reader can email the invitations (`canSendGcTradeEmail`). False: the asks are saved for a dev to send. */
  emails?: boolean
  /**
   * Record the asks, and email them when `email` (a dev with the tick on). The window closes once it resolves,
   * unless an invitation did not go out.
   */
  onAsk: (companyIds: string[], email: boolean) => Promise<AskOutcome[] | void>
  onClose: () => void
}) {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  const choices = askChoices(state, projectId, packageId)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(tick ?? choices.filter((c) => c.inZone && !c.declined).map((c) => c.partner.id)))
  // The company whose invitation shows on the right: the first ticked one, until a row is pressed.
  const [shown, setShown] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The invitations that did not go out, with the reason: the asks are saved, so the window says so and waits.
  const [refused, setRefused] = useState<AskOutcome[]>([])
  // Email the invitations with this press: OFF by default until the owner names an inbox for the checks (call 3).
  // The test company's contacts carry example.com addresses, so a press with this on would send. Call 3 flips it.
  const [emailNow, setEmailNow] = useState(false)
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
  const lang: PortalLang = showing ? (langs[showing.partner.id] ?? 'en') : 'en'
  // The invitation as it would read once asked today: a draft ask, nothing written.
  const draftInvite: Invite | null = showing ? { id: 'draft', partnerId: showing.partner.id, status: 'invited', invitedOn: state.today, bid: null, seenRev: null } : null
  const draft = showing && draftInvite ? inviteMessage(project, pkg, draftInvite, showing.partner, lang) : null
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
    setBusy(true)
    setProblem(null)
    onAsk(
      asking.map((c) => c.partner.id),
      emails && emailNow,
    )
      .then((outcomes) => {
        const notSent = (outcomes ?? []).filter((o) => !o.sent && o.words)
        if (notSent.length > 0) setRefused(notSent)
        else onClose()
      })
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'The asks were not saved.'))
      .finally(() => setBusy(false))
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
        data-gc-ask-choice={c.partner.id}
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
        <input type="checkbox" checked={on} onChange={() => toggle(c.partner.id)} onClick={(e) => e.stopPropagation()} aria-label={`Ask ${c.partner.company}`} style={{ marginTop: '0.2rem' }} />
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
            {langs[c.partner.id] === 'es' && <Chip tone="grey">Español</Chip>}
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: phone ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
      }}
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
          maxHeight: phone ? 'min(92vh, 100%)' : 'min(92vh, 720px, 100%)',
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
              {project.name}
              {project.sizeNote ? ` · ${project.sizeNote}` : ''}
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
              {project.planSets.length > 0 && <Chip tone="grey">Plans: {planLabel(project, currentRev(project))}</Chip>}
              <Chip tone={pkg.scope.length === 0 ? 'red' : 'grey'}>{pkg.scope.length === 1 ? '1 scope line' : `${pkg.scope.length} scope lines`}</Chip>
            </div>
          </div>
          <div style={{ padding: '0 1rem 0.8rem', overflowY: 'auto', display: 'grid', gap: '0.45rem', alignContent: 'start', minHeight: 0, flex: 1 }}>
            {choices.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Every company in this trade is already asked on this job. Add a company on Trade partners to ask another.</div>}
            {first.length > 0 && <div style={label}>Who to ask</div>}
            {first.map(row)}
            {rest.length > 0 && <div style={{ ...label, marginTop: first.length > 0 ? '0.3rem' : 0 }}>Too far, or declined</div>}
            {rest.map(row)}
          </div>
          <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 12rem', display: 'grid', gap: '0.2rem' }}>
              <span>{standing.words}</span>
              {refused.length === 0 && emails && (
                <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', color: 'var(--text-base)' }}>
                  <input type="checkbox" checked={emailNow} onChange={(e) => setEmailNow(e.target.checked)} />
                  Email the invitations now
                </label>
              )}
              {refused.length === 0 &&
                asking.length > 0 &&
                (!emails ? (
                  <strong style={{ color: 'var(--text-amber-800)' }}>{ASK_NOT_SENT_WORDS}</strong>
                ) : emailNow ? (
                  <span>{ASK_EMAIL_WORDS}</span>
                ) : (
                  <strong style={{ color: 'var(--text-amber-800)' }}>{ASK_EMAIL_OFF_WORDS}</strong>
                ))}
              {refused.length > 0 && (
                <span data-gc-ask-refused style={{ color: 'var(--text-red-700)', display: 'grid', gap: '0.15rem' }}>
                  <strong>{refused.length === 1 ? 'One invitation did not go out. The ask is saved.' : `${refused.length} invitations did not go out. The asks are saved.`}</strong>
                  {refused.map((o) => (
                    <span key={o.inviteId}>
                      {state.partners.find((p) => p.id === o.companyId)?.company ?? 'A company'}: {o.words}
                    </span>
                  ))}
                </span>
              )}
              {problem && <span style={{ color: 'var(--text-red-700)' }}>{problem}</span>}
            </span>
            {refused.length > 0 ? (
              <Btn kind="primary" onClick={onClose}>
                Done
              </Btn>
            ) : (
              <>
                <Btn kind="quiet" onClick={onClose}>
                  Cancel
                </Btn>
                <Btn kind="primary" disabled={asking.length === 0 || busy} onClick={send}>
                  {asking.length === 1 ? `Ask ${asking[0]?.partner.company ?? '1 company'}` : `Ask ${asking.length} companies`}
                </Btn>
              </>
            )}
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
                    {langs[c.partner.id] === 'es' ? ' · Español' : ''}
                  </button>
                )
              })}
            </div>
          )}
          {draft && showing ? (
            <article style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }} aria-label={`The invitation ${showing.partner.company} gets`}>
              <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', display: 'grid', gap: '0.1rem' }}>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>From </span>
                  {GC_COMPANY.name}
                </span>
                <span style={{ overflowWrap: 'anywhere' }}>
                  <span style={{ color: 'var(--text-muted)' }}>To </span>
                  {showing.to.map((t) => (t.email ? `${t.name} <${t.email}>` : t.name)).join(', ')}
                </span>
                <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{draft.subject}</span>
                  <Chip tone="amber">not sent yet</Chip>
                </span>
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
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Their own portal link goes here once the portal is open to them.</div>
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
