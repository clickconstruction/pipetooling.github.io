import { useEffect, useState, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import {
  PARTNER_SCHEDULE_WHY,
  PROMISE_WHAT,
  answerRecord,
  declineReasonWords,
  insuranceRenewalWords,
  insuranceRenewals,
  money,
  openPromiseFor,
  partnerActivity,
  partnerDeclines,
  partnerDocuments,
  partnerExclusionHabits,
  partnerPaper,
  partnerScheduleRecord,
  partnerScheduleWords,
  partnerWork,
  shortDate,
  tradePortalStatus,
  tradePromiseRecord,
  vettingOf,
  weekdayDate,
  type AnswerRecord,
  type CompanyDoc,
  type GcAction,
  type GcState,
  type Partner,
} from '../../lib/gcMode/gcModel'
import { CompanyActivity, CompanyDocuments, CompanyPortalPanel, CompanyTabStrip } from './GcCompanyFile'
import { GcTradePortal } from './GcTradePortal'
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

/** An office ask for a paper is due a week out: the day it becomes a promise to chase. */
function weekOut(today: string): string {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
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
  at?: { tab?: CompanyTab; doc?: string }
  onClose: () => void
  onOpenProject: (projectId: string) => void
}) {
  const docs = partnerDocuments(state, partner)
  const events = partnerActivity(state, partner)
  const portal = tradePortalStatus(state, partner)
  // The portal draws from a project they are asked on; its home shows every job they have with us.
  const portalProject = state.projects.find((p) => p.packages.some((k) => k.invites.some((i) => i.partnerId === partner.id))) ?? null
  const firstDoc = docs.groups[0]?.docs[0]?.key ?? null
  const [tab, setTab] = useState<CompanyTab>(at?.tab ?? (at?.doc ? 'documents' : 'about'))
  const [doc, setDoc] = useState<string | null>(at?.doc ?? firstDoc)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const record = RECORD[answerRecord(partner)]
  const word = tradePromiseRecord(state, partner)
  const made = partner.promisesMade + word.made
  const kept = partner.promisesKept + word.kept
  const coverage = partner.base ? `from ${partner.base}${partner.maxMiles === null ? '' : `, goes ${partner.maxMiles} mi`}` : 'coverage not set'

  /** Ask for a missing or running-out paper: it becomes a promise on Follow up, due in a week. */
  const ask = (d: CompanyDoc) => {
    if (!d.ask) return null
    const match = { partnerId: partner.id, kind: d.ask, ...(d.projectId ? { projectId: d.projectId } : {}), ...(d.packageId ? { packageId: d.packageId } : {}) }
    const open = openPromiseFor(state, match)
    if (open) return <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>asked · due {weekdayDate(open.by)}</span>
    return (
      <Btn
        kind="quiet"
        title={`Writes it down as a promise: ${PROMISE_WHAT[d.ask]} by ${weekdayDate(weekOut(state.today))}. It shows on Follow up until it comes.`}
        onClick={() =>
          dispatch({
            type: 'recordPromise',
            ...match,
            by: weekOut(state.today),
            from: 'office',
            ...(d.key.startsWith('waivers-') ? { what: 'the unconditional lien waiver' } : {}),
          })
        }
      >
        Ask for it
      </Btn>
    )
  }

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
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {[partner.contact || 'no contact yet', coverage, partner.lang === 'es' ? 'reads Spanish' : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        <CompanyTabStrip tab={tab} onTab={setTab} activity={events.length} toGet={docs.toGet} portal={portal} />
        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto' }}>
          {tab === 'about' && <About state={state} partner={partner} onOpenProject={onOpenProject} onDocuments={(key) => { setDoc(key); setTab('documents') }} />}
          {tab === 'activity' && (
            <CompanyActivity events={events} onOpenProject={onOpenProject} onLog={(note) => dispatch({ type: 'logPartnerContact', partnerId: partner.id, note })} />
          )}
          {tab === 'documents' && (
            <CompanyDocuments groups={docs.groups} selected={doc} onSelect={setDoc} paper={doc ? partnerPaper(state, partner, doc) : null} ask={ask} />
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

const link = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 } as const

function Heading({ children }: { children: string }) {
  return <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{children}</div>
}
