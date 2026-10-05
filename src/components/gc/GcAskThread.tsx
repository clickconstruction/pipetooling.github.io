import { useState, type Dispatch } from 'react'
import {
  allFollowPeople,
  allPeople,
  askPromise,
  daysUntil,
  weekdayDate,
  followUps,
  partnerReach,
  telHref,
  promiseWords,
  shortDate,
  wordRecord,
  type AskContact,
  type FollowUp,
  type FollowUpWhy,
  type GcAction,
  type GcProject,
  type GcState,
  type Invite,
  type Partner,
  type PromiseState,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { LinkNeverOpenedChip } from './GcPortalLinkChip'
import { Btn, Card, Chip, Why, input, type Tone } from './gcUi'
import { GcFollowUpPromises } from './GcFollowUpPromises'
import { GcDeclineForm } from './GcDeclineForm'
import { GcFollowUpSheet } from './GcFollowUpSheet'
import { PeopleRows } from './GcPeoplePill'
import { PartnerLink } from './GcCompanyFile'

/**
 * GC mode design spike: keeping up with a company on one ask. Every call, text, email, nudge and
 * portal answer is a line on the ask, newest first. A line can carry their word ("quote by
 * Monday"). When that day passes with no quote, the ask lands at the top of Follow up.
 */

const PROMISE_TONE: Record<PromiseState, Tone> = {
  kept: 'green',
  late: 'amber',
  pending: 'blue',
  today: 'amber',
  passed: 'red',
}

const HOW_WORDS: Record<AskContact['how'], string> = {
  call: 'call',
  text: 'text',
  email: 'email',
  nudge: 'nudge',
  portal: 'their portal',
}

export function PromiseChip({ invite, today }: { invite: Invite; today: string }) {
  const promise = askPromise(invite, today)
  if (!promise) return null
  return <Chip tone={PROMISE_TONE[promise.state]}>{promiseWords(promise)}</Chip>
}

interface ThreadProps {
  state: GcState
  project: GcProject
  pkg: TradePackage
  invite: Invite
  partner: Partner
  dispatch: Dispatch<GcAction>
  /**
   * On a Follow up card (the owner, 2026-10-04: say it once per card): Call and Follow up already
   * log a contact, so there is no Log a contact here; with no promise, the chip says when we asked.
   */
  onList?: boolean
}

/** The story on one ask: their word, the last thing said, a way to add a line, and the rest on a press. */
export function AskThread({ state, project, pkg, invite, partner, dispatch, onList }: ThreadProps) {
  const [logging, setLogging] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [how, setHow] = useState<'call' | 'text' | 'email'>('call')
  const [note, setNote] = useState('')
  const [promisedBy, setPromisedBy] = useState('')
  const contacts = invite.contacts ?? []
  const last = contacts[0]
  const word = wordRecord(state, partner)
  const ids = { projectId: project.id, packageId: pkg.id, inviteId: invite.id }
  const promise = askPromise(invite, state.today)
  const askedDays = daysUntil(state.today, invite.invitedOn)

  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <PromiseChip invite={invite} today={state.today} />
        {onList && !promise && (
          <Chip tone="grey">
            asked {weekdayDate(invite.invitedOn)}, {askedDays === 0 ? 'today' : `${askedDays} ${askedDays === 1 ? 'day' : 'days'} ago`}
          </Chip>
        )}
        {word.made > 0 && (
          <span style={{ color: 'var(--text-muted)' }} title="How often the day they gave for a quote held.">
            kept {word.kept} of {word.made} promises
          </span>
        )}
        {!logging && !onList && <Btn kind="quiet" onClick={() => setLogging(true)}>Log a contact</Btn>}
        {contacts.length > 1 && (
          <Btn kind="quiet" onClick={() => setShowAll(!showAll)}>{showAll ? 'Hide the story' : `The story (${contacts.length})`}</Btn>
        )}
      </div>

      {/* The chip already says the promised day: the last line does not say it again. The full story keeps every one. */}
      {last && !showAll && <ContactLine line={last} sayDay={last.promisedBy !== promise?.by} />}
      {showAll && contacts.map((line, i) => <ContactLine key={`${line.on}-${i}`} line={line} sayDay />)}
      {!last && !logging && <span style={{ color: 'var(--text-muted)' }}>No call or message logged yet.</span>}

      {logging && (
        <div style={{ display: 'grid', gap: '0.35rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <select value={how} onChange={(e) => setHow(e.target.value as 'call' | 'text' | 'email')} style={input} aria-label="How you reached them">
              <option value="call">Call</option>
              <option value="text">Text</option>
              <option value="email">Email</option>
            </select>
            <input
              autoFocus
              style={{ ...input, flex: '1 1 14rem' }}
              placeholder={`What ${partner.contact || 'they'} said`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            They promised the quote by
            <input type="date" min={state.today} value={promisedBy} onChange={(e) => setPromisedBy(e.target.value)} style={input} aria-label="The day they promised the quote" />
            <span style={{ color: 'var(--text-muted)' }}>Leave it empty if they gave no day.</span>
          </label>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <Btn
              kind="primary"
              disabled={note.trim() === '' && promisedBy === ''}
              onClick={() => {
                dispatch({ type: 'logContact', ...ids, how, note: note.trim() || 'Gave a day for the quote.', promisedBy: promisedBy || null })
                setNote('')
                setPromisedBy('')
                setLogging(false)
              }}
            >
              Save
            </Btn>
            <Btn kind="quiet" onClick={() => setLogging(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactLine({ line, sayDay }: { line: AskContact; sayDay: boolean }) {
  return (
    <div>
      <span style={{ color: 'var(--text-muted)' }}>
        {shortDate(line.on)} · {line.by} · {HOW_WORDS[line.how]}:
      </span>{' '}
      {line.note}
      {sayDay && line.promisedBy && <strong> Quote by {shortDate(line.promisedBy)}.</strong>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Follow up: everyone we are waiting on, across every project, the ones to call first
// ---------------------------------------------------------------------------------------------

const WHY_WORDS: Record<FollowUpWhy, { tone: Tone; title: string; blurb: string }> = {
  // The owner, 2026-10-04 (relayed by the Portal lane): "Late on their word", matching the portal's "late: you said Sep 30".
  passed: { tone: 'red', title: 'Late on their word', blurb: 'They gave a day and no quote came. Call them.' },
  today: { tone: 'amber', title: 'Promised today', blurb: 'Their quote is due today. Check before you go home.' },
  silent: { tone: 'red', title: 'Never opened it', blurb: 'We asked and they have not looked. Call, or offer it to the next company.' },
  nodate: { tone: 'amber', title: 'No day given', blurb: 'They have the plans. Get a day from them.' },
  waiting: { tone: 'blue', title: 'Waiting on their word', blurb: 'They gave a day and it has not come. Nothing to do yet.' },
}

const WHY_ORDER: FollowUpWhy[] = ['passed', 'today', 'silent', 'nodate', 'waiting']

export function GcFollowUpTab({
  state,
  dispatch,
  onMap,
}: {
  state: GcState
  dispatch: Dispatch<GcAction>
  onMap: (projectId: string, packageId: string) => void
}) {
  const all = followUps(state)
  // The Follow up sheet (the owner, 2026-10-04, Building lane's GcFollowUpSheet): one person at a time, a draft from me.
  const [sheet, setSheet] = useState<{ partnerId?: string; calling?: boolean } | null>(null)
  // Everyone we are waiting on, each once across every job: the board rows' sum and the dashboard's count ("make them match").
  const everyone = allPeople(state)
  const listCount = everyone.count
  const open = (partnerId?: string, calling = false) => setSheet({ ...(partnerId ? { partnerId } : {}), calling })
  // Who the cards and the papers below do not show: the architect, a customer, the newest plans not opened, a waiver, a late bill.
  const SHOWN_ABOVE = new Set(['ask', 'promise', 'insurance', 'sow', 'w9'])
  const more = everyone.people
    .map((p) => ({ ...p, reasons: p.reasons.filter((r) => !SHOWN_ABOVE.has(r.code ?? '')) }))
    .filter((p) => p.reasons.length > 0)
  // A phone puts each person's buttons under their words. Read once: a test page may have no matchMedia.
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 480px)').matches
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {sheet && (
        <GcFollowUpSheet
          state={state}
          dispatch={dispatch}
          {...(sheet.partnerId ? { startPartnerId: sheet.partnerId } : {})}
          startCalling={sheet.calling ?? false}
          onClose={() => setSheet(null)}
          list={(s) => allFollowPeople(s, sheet.partnerId)}
        />
      )}
      {listCount > 0 && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn kind="primary" onClick={() => open()}>
            Work the list · {listCount}
          </Btn>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>One person at a time: a draft from you to send, or a call to log.</span>
        </div>
      )}
      <Why>
        Every company we are waiting on, across every project, the ones to call first. A day they give for their quote
        is written down: if it passes with no quote, they come back to the top.
      </Why>
      {WHY_ORDER.map((why) => {
        const rows = all.filter((f) => f.why === why)
        if (rows.length === 0) return null
        const words = WHY_WORDS[why]
        return (
          <section key={why}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{words.title} ({rows.length})</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{words.blurb}</span>
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {rows.map((f) => (
                <FollowUpCard key={f.invite.id} state={state} followUp={f} dispatch={dispatch} onMap={onMap} onFollowUp={open} />
              ))}
            </div>
          </section>
        )
      })}
      {/* Insurance, papers and every other promise (question 8). */}
      <GcFollowUpPromises state={state} dispatch={dispatch} onFollowUp={(partnerId) => open(partnerId)} />
      {more.length > 0 && (
        <section>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>More to follow up on ({more.length})</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>The architect, customers, plans not opened, waivers and late bills, by job.</span>
          </div>
          <Card style={{ padding: '0.2rem 0.9rem' }}>
            <PeopleRows
              people={more}
              narrow={phone}
              onFollowUp={(person, calling) => open(person.partnerId ?? `customer:${person.customerId ?? ''}`, calling)}
            />
          </Card>
        </section>
      )}
      {all.length === 0 && <Card style={{ color: 'var(--text-muted)' }}>We are not waiting on anyone for a quote.</Card>}
    </div>
  )
}

function FollowUpCard({
  state,
  followUp,
  dispatch,
  onMap,
  onFollowUp,
}: {
  state: GcState
  followUp: FollowUp
  dispatch: Dispatch<GcAction>
  onMap: (projectId: string, packageId: string) => void
  /** Open the Follow up sheet on this company: to write, or, after Call, to log what they said. */
  onFollowUp?: (partnerId: string, calling?: boolean) => void
}) {
  const { project, pkg, invite, partner, why } = followUp
  const ids = { projectId: project.id, packageId: pkg.id, inviteId: invite.id }
  // Will not do it / Cannot do it ask why first (the owner, 2026-10-04): the reason stays with the job and the company.
  const [declining, setDeclining] = useState<'wont' | 'cant' | null>(null)
  return (
    <Card style={{ borderLeft: `4px solid ${why === 'waiting' ? 'var(--border-blue)' : why === 'passed' || why === 'silent' ? '#dc2626' : '#d97706'}` }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        {/* The name opens the company at this ask's promised day, on Activity (the owner, 2026-10-04). */}
        <PartnerLink partnerId={partner.id} company={partner.company} strong at={{ tab: 'activity', focus: `ask:${invite.id}` }} />
        <span style={{ color: 'var(--text-muted)' }}>{partner.contact}</span>
        {/* The bid date sits with the job, once, not as a sentence on every card. */}
        <Chip tone="grey">
          {project.name} · {pkg.trade}
          {project.bidDue ? ` · bid ${weekdayDate(project.bidDue)}` : ''}
        </Chip>
        {/* Portal lane: a company that never opened its link. */}
        <LinkNeverOpenedChip state={state} partnerId={partner.id} />
        <span style={{ flex: 1 }} />
        {onFollowUp && (
          <>
            {/* One click to call (the owner, 2026-10-04): it dials, then the sheet asks what they said. */}
            <a
              href={telHref(partnerReach(partner).phone)}
              title={`Call ${partnerReach(partner).phone}`}
              onClick={() => onFollowUp(partner.id, true)}
              style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-base)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
            >
              Call {partnerReach(partner).first}
            </a>
            <Btn kind="primary" onClick={() => onFollowUp(partner.id)}>
              Follow up
            </Btn>
          </>
        )}
        {why !== 'waiting' && (
          <>
            <Btn onClick={() => setDeclining('wont')}>Will not do it</Btn>
            <Btn onClick={() => setDeclining('cant')}>Cannot do it</Btn>
          </>
        )}
        <Btn kind="quiet" onClick={() => onMap(project.id, pkg.id)} title="See who else could quote this trade.">Who else?</Btn>
      </div>
      {declining && (
        <GcDeclineForm
          company={partner.company}
          why={declining}
          context={`${project.name} · ${pkg.trade}`}
          onCancel={() => setDeclining(null)}
          onSave={(reason, note) => {
            dispatch({ type: 'officeDecline', ...ids, why: declining, reason, note })
            setDeclining(null)
          }}
        />
      )}
      {/* The section says why they are here, the chip says the day: the card's sentence stays in the data (the sheet reads it). */}
      <div style={{ marginTop: '0.35rem' }}>
        <AskThread state={state} project={project} pkg={pkg} invite={invite} partner={partner} dispatch={dispatch} onList />
      </div>
    </Card>
  )
}
