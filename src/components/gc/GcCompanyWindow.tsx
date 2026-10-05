import { useEffect, useState, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import {
  PARTNER_SCHEDULE_WHY,
  answerRecord,
  companyPeople,
  declineReasonWords,
  insuranceRenewalWords,
  insuranceRenewals,
  mailGroupName,
  money,
  partnerActivity,
  partnerDeclines,
  partnerDocuments,
  partnerExclusionHabits,
  partnerPaper,
  partnerScheduleRecord,
  partnerScheduleWords,
  partnerWork,
  partnerReach,
  paperStep,
  telHref,
  shortDate,
  tradePortalStatus,
  tradePromiseRecord,
  vettingOf,
  type AnswerRecord,
  type CompanyDoc,
  type GcAction,
  type GcState,
  type Partner,
} from '../../lib/gcMode/gcModel'
import { CompanyActivity, CompanyDocuments, CompanyPortalPanel, CompanyTabStrip } from './GcCompanyFile'
import { GcTradePortal } from './GcTradePortal'
import { GcPaperSend } from './GcPaperSend'
import type { CompanyTab } from './gcCompanyOpener'
import { Btn, Chip, Stat, type Tone } from './gcUi'
import { VettingChip } from './GcVetting'

/**
 * GC mode design spike: a trade company's window (the owner, 2026-10-04: "click on any of the
 * paperwork buttons and have that paperwork appear", with information, a ledger and documents in
 * three tabs). About is what decides whether to ask or award them; Activity is everything that
 * happened, newest first; Documents leads with what is missing. It opens at the tab and paper
 * that was clicked. Customers and architects keep their own window, with the same three tabs.
 */

const RECORD: Record<AnswerRecord, { tone: Tone; word: string }> = {
  new: { tone: 'grey', word: 'new to us' },
  reliable: { tone: 'green', word: 'answers' },
  mixed: { tone: 'amber', word: 'hit or miss' },
  silent: { tone: 'red', word: 'often silent' },
}

export function GcCompanyWindow({
  state,
  partner,
  dispatch,
  at,
  onClose,
  onOpenProject,
}: {
  state: GcState
  partner: Partner
  dispatch: Dispatch<GcAction>
  at?: { tab?: CompanyTab; doc?: string; focus?: string }
  onClose: () => void
  onOpenProject: (projectId: string) => void
}) {
  const docs = partnerDocuments(state, partner)
  const events = partnerActivity(state, partner)
  const portal = tradePortalStatus(state, partner)
  const reach = partnerReach(partner)
  // The portal draws from a project they are asked on; its home shows every job they have with us.
  const portalProject = state.projects.find((p) => p.packages.some((k) => k.invites.some((i) => i.partnerId === partner.id))) ?? null
  const firstDoc = docs.groups[0]?.docs[0]?.key ?? null
  const [tab, setTab] = useState<CompanyTab>(at?.tab ?? (at?.doc ? 'documents' : 'about'))
  const [doc, setDoc] = useState<string | null>(at?.doc ?? firstDoc)
  /** The paper being sent, by its Documents key: its send shows in the paper's place. */
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape steps back out of a send first, then closes the window.
      if (sending) setSending(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  const record = RECORD[answerRecord(partner)]
  const word = tradePromiseRecord(state, partner)
  const made = partner.promisesMade + word.made
  const kept = partner.promisesKept + word.kept
  const coverage = partner.base ? `from ${partner.base}${partner.maxMiles === null ? '' : `, goes ${partner.maxMiles} mi`}` : 'coverage not set'

  /** The row's next step, when the paper is missing or waiting: it opens the send beside the list. */
  const ask = (d: CompanyDoc) => {
    const step = paperStep(state, partner, d.key)
    if (!step || sending === d.key) return null
    return (
      <Btn
        kind="primary"
        onClick={() => {
          setDoc(d.key)
          setSending(d.key)
        }}
      >
        {step.verb}
      </Btn>
    )
  }
  const sendStep = sending ? paperStep(state, partner, sending) : null

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={partner.company}
        data-tour="gc-company-window"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1040px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.8rem 1rem 0.6rem', display: 'grid', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{partner.company}</div>
            {partner.trades.map((t) => (
              <Chip key={t} tone="grey">
                {t}
              </Chip>
            ))}
            <VettingChip partner={partner} />
            <Chip tone={record.tone}>{record.word}</Chip>
            {made > 0 && <Chip tone={kept === made ? 'green' : 'amber'}>kept {kept} of {made} promises</Chip>}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
            >
              ×
            </button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '0.15rem 0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span>{partner.contact || 'no contact yet'}</span>
            {/* One press to call or write (the Building lane's reach; made-up until the record has them). */}
            <span>
              · <a href={telHref(reach.phone)} style={reachLink} title={reach.madeUp ? 'A made-up number until their record has one' : `Call ${reach.first}`}>{reach.phone}</a>
            </span>
            <span>
              · <a href={`mailto:${reach.email}`} style={reachLink} title={reach.madeUp ? 'A made-up address until their record has one' : `Email ${reach.first}`}>{reach.email}</a>
            </span>
            <span>· {coverage}</span>
            {partner.lang === 'es' && <span>· reads Spanish</span>}
          </div>
        </div>
        <CompanyTabStrip tab={tab} onTab={setTab} activity={events.length} toGet={docs.toGet} portal={portal} />
        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto' }}>
          {tab === 'about' && <About state={state} partner={partner} onOpenProject={onOpenProject} onDocuments={(key) => { setDoc(key); setTab('documents') }} />}
          {tab === 'activity' && (
            <CompanyActivity
              events={events}
              onOpenProject={onOpenProject}
              onLog={(note) => dispatch({ type: 'logPartnerContact', partnerId: partner.id, note })}
              {...(at?.focus ? { focus: at.focus } : {})}
            />
          )}
          {tab === 'documents' && (
            <CompanyDocuments
              groups={docs.groups}
              selected={doc}
              onSelect={(key) => {
                setDoc(key)
                setSending(null)
              }}
              paper={doc ? partnerPaper(state, partner, doc) : null}
              ask={ask}
              aside={
                sendStep ? (
                  <GcPaperSend
                    key={sending ?? ''}
                    state={state}
                    partner={partner}
                    step={sendStep}
                    dispatch={dispatch}
                    onDone={() => setSending(null)}
                    onCancel={() => setSending(null)}
                  />
                ) : undefined
              }
            />
          )}
          {tab === 'portal' && (
            <CompanyPortalPanel
              status={portal}
              shows={`One link for everything they have with us: what we ask them to quote, the plans, papers to sign, their pay and their schedule. They read it in ${partner.lang === 'es' ? 'Spanish' : 'English'}. What they press here lands on our side at once.`}
              preview={
                portalProject ? (
                  <GcTradePortal state={state} project={portalProject} partnerId={partner.id} onPickPartner={() => undefined} dispatch={dispatch} partnerLocked />
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
                    Nothing to show yet. Ask them to quote on a job and their portal opens.
                  </div>
                )
              }
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** What decides whether to ask them or award them: their record, their papers, and their money with us. */
function About({
  state,
  partner,
  onOpenProject,
  onDocuments,
}: {
  state: GcState
  partner: Partner
  onOpenProject: (projectId: string) => void
  onDocuments: (key: string) => void
}) {
  const work = partnerWork(state, partner)
  const schedule = partnerScheduleRecord(state, partner)
  const habits = partnerExclusionHabits(state, partner)
  const declines = partnerDeclines(state, partner.id)
  const renewal = insuranceRenewals(state).find((r) => r.partner.id === partner.id)
  const vetting = vettingOf(partner)
  const lines: { label: string; text: string; doc?: string; title?: string }[] = [
    {
      label: 'Quotes',
      text: partner.invited === 0 ? 'never asked yet' : `quoted ${partner.bids} of ${partner.invited} asks`,
    },
    ...(schedule ? [{ label: 'On our jobs', text: partnerScheduleWords(schedule), title: PARTNER_SCHEDULE_WHY }] : []),
    ...(habits.length > 0
      ? [{ label: 'Usually excludes', text: habits.map((h) => `${h.name.toLowerCase()} (${h.excluded} of ${h.of})`).join(', ') }]
      : []),
    {
      label: 'Vetting',
      text:
        vetting.status === 'approved'
          ? vetting.decidedBy
            ? `approved by ${vetting.decidedBy}${vetting.decidedOn ? ` ${shortDate(vetting.decidedOn)}` : ''}${vetting.limit ? `, up to ${money(vetting.limit)} on one award` : ''}`
            : 'a company we know'
          : vetting.status === 'declined'
            ? `declined${vetting.note ? `: ${vetting.note}` : ''}`
            : `not vetted yet${vetting.form ? '. Their form is in.' : '. Their form is not in yet.'}`,
      ...(partner.vetting ? { doc: 'vetting' } : {}),
    },
    ...(renewal ? [{ label: 'Insurance', text: insuranceRenewalWords(renewal), doc: 'insurance' }] : []),
  ]
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <Stat label="Jobs with us" value={work.jobs.length} />
        <Stat label="Under contract" value={money(work.underContract)} />
        <Stat label="Paid to them" value={money(work.paid)} />
        {work.approved > 0 && <Stat label="Approved, not paid" value={money(work.approved)} />}
        <Stat label="We are holding" value={money(work.held)} />
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(8rem, auto) minmax(0, 1fr)', gap: '0.4rem 1rem', fontSize: '0.9rem' }}>
        {lines.map((l) => (
          <div key={l.label} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--text-muted)' }}>{l.label}</dt>
            <dd style={{ margin: 0 }} title={l.title}>
              {l.text}
              {l.doc && (
                <>
                  {' '}
                  <button type="button" onClick={() => onDocuments(l.doc ?? '')} style={link}>
                    see it
                  </button>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <People partner={partner} />
      {work.jobs.length > 0 && (
        <section>
          <Heading>Their work with us</Heading>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
            {work.jobs.map((j) => (
              <div key={j.pkg.id}>
                <button type="button" onClick={() => onOpenProject(j.project.id)} style={link}>
                  {j.project.name}
                </button>{' '}
                · {j.pkg.trade} · {money(j.price)} ·{' '}
                <button type="button" onClick={() => onDocuments(`sow-${j.pkg.id}`)} style={link}>
                  {j.signed ? 'statement of work signed' : 'statement of work not signed'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {declines.length > 0 && (
        <section>
          <Heading>Times they passed</Heading>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
            {declines.map((d) => (
              <div key={d.invite.id}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {shortDate(d.invite.declineReason?.on ?? null)} · {d.project.name} · {d.pkg.trade}:
                </span>{' '}
                {d.invite.declineReason ? declineReasonWords(d.invite.declineReason) : ''}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * Who at the company gets which of our emails (the owner, 2026-10-05: "build both", on the Portal
 * lane's *who at the company gets what*). The company sets it in its portal; we read it here.
 */
function People({ partner }: { partner: Partner }) {
  const people = companyPeople(partner)
  return (
    <section data-tour="gc-company-people">
      <Heading>Who gets our emails</Heading>
      <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
        {people.map((p) => (
          <div key={`${p.main ? 'main' : 'p'}:${p.name}`} style={{ display: 'flex', gap: '0.15rem 0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <strong style={{ fontWeight: 600 }}>{p.name}</strong>
            {p.role && <span style={{ color: 'var(--text-muted)' }}>{p.role}</span>}
            <a href={`mailto:${p.email}`} style={reachLink} title={p.madeUp ? 'A made-up address until their record has one' : `Email ${p.name}`}>
              {p.email}
            </a>
            <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {p.gets.length === 0 ? (
                <Chip tone="grey">no emails</Chip>
              ) : (
                p.gets.map((g) => (
                  <Chip key={g} tone="grey">
                    {mailGroupName(g)}
                  </Chip>
                ))
              )}
            </span>
          </div>
        ))}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
        {people.length === 1 ? 'They can name others in their portal, like a bookkeeper for pay.' : 'They set this in their portal. Follow up emails each person what they get.'}
      </div>
    </section>
  )
}

const reachLink = { color: 'var(--text-link)', textDecoration: 'none' } as const

const link = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 } as const

function Heading({ children }: { children: string }) {
  return <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{children}</div>
}
