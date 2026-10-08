import { useState } from 'react'
import { bidsIn } from '../../lib/gc/bids'
import { declinedTitle, declinedWords } from '../../lib/gc/decline'
import { askPromise, followUps, promiseWords, wordRecord, type FollowUp, type FollowUpWhy, type PromiseState } from '../../lib/gc/followUp'
import { telHref } from '../../lib/gc/followUpSheet'
import type { AskContact, DeclineReason, GcProject, GcState, Invite, Partner, TradePackage } from '../../lib/gc/types'
import { daysUntil, shortDate, weekdayDate } from '../../lib/gc/words'
import { GcDeclineForm } from './GcDeclineForm'
import { PartnerName } from './GcPartnerName'
import { Btn, Card, Chip, input, type Tone } from './gcUi'

/**
 * GC mode, the real build (the Board's B4-b): keeping up with a company on one ask, from the design
 * spike's `GcAskThread.tsx`. Every call, text, email and portal answer is a line on the ask, newest
 * first. A line can carry their word ("quote by Monday"). When that day passes with no quote, the
 * ask lands at the top of Follow up. Will not do it and Cannot do it take a company off the ask with
 * the reason kept. Work the list, By people and the Follow up sheet come with the Board's B2b, so
 * Log a contact sits on each card until then.
 */

/** What the asks write, through the company record (B1). */
export interface AskWrites {
  logContact: (ask: { companyId: string; inviteId: string }, how: 'call' | 'text' | 'email', note: string, promisedBy: string | null) => Promise<void>
  decline: (inviteId: string, why: 'wont' | 'cant', reason: DeclineReason, note: string) => Promise<void>
}

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

const ASK_WORDS: Record<Invite['status'], { tone: Tone; word: string }> = {
  invited: { tone: 'red', word: 'has not opened it' },
  opened: { tone: 'blue', word: 'looking' },
  bid: { tone: 'green', word: 'quote in' },
  declined: { tone: 'grey', word: 'passed' },
}

export function PromiseChip({ invite, today }: { invite: Invite; today: string }) {
  const promise = askPromise(invite, today)
  if (!promise) return null
  return <Chip tone={PROMISE_TONE[promise.state]}>{promiseWords(promise)}</Chip>
}

/** The story on one ask: their word, the last thing said, a way to add a line, and the rest on a press. */
export function AskThread({ state, invite, partner, writes, onList }: { state: GcState; invite: Invite; partner: Partner; writes: AskWrites; onList?: boolean }) {
  const [logging, setLogging] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [how, setHow] = useState<'call' | 'text' | 'email'>('call')
  const [note, setNote] = useState('')
  const [promisedBy, setPromisedBy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const contacts = invite.contacts ?? []
  const last = contacts[0]
  const word = wordRecord(state, partner)
  const promise = askPromise(invite, state.today)
  const askedDays = daysUntil(state.today, invite.invitedOn)
  const save = () => {
    setBusy(true)
    setProblem(null)
    writes
      .logContact({ companyId: partner.id, inviteId: invite.id }, how, note.trim() || 'Gave a day for the quote.', promisedBy || null)
      .then(() => {
        setNote('')
        setPromisedBy('')
        setLogging(false)
      })
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }

  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }} data-gc-ask={invite.id}>
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
        {!logging && (
          <Btn kind="quiet" onClick={() => setLogging(true)}>
            Log a contact
          </Btn>
        )}
        {contacts.length > 1 && (
          <Btn kind="quiet" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Hide the story' : `The story (${contacts.length})`}
          </Btn>
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
            <input autoFocus style={{ ...input, flex: '1 1 14rem' }} placeholder={`What ${partner.contact || 'they'} said`} aria-label="What they said" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            They promised the quote by
            <input type="date" min={state.today} value={promisedBy} onChange={(e) => setPromisedBy(e.target.value)} style={input} aria-label="The day they promised the quote" />
            <span style={{ color: 'var(--text-muted)' }}>Leave it empty if they gave no day.</span>
          </label>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn kind="primary" disabled={busy || (note.trim() === '' && promisedBy === '')} onClick={save}>
              Save
            </Btn>
            <Btn kind="quiet" onClick={() => setLogging(false)}>
              Cancel
            </Btn>
            {problem && <span style={{ color: 'var(--text-red-700)' }}>{problem}</span>}
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
        {shortDate(line.on)} · {line.by || 'Someone on our team'} · {HOW_WORDS[line.how]}:
      </span>{' '}
      {line.note}
      {sayDay && line.promisedBy && <strong> Quote by {shortDate(line.promisedBy)}.</strong>}
    </div>
  )
}

/** Will not do it and Cannot do it, with the window that asks why. Only on an ask still open. */
function DeclineButtons({ project, pkg, invite, partner, writes }: { project: GcProject; pkg: TradePackage; invite: Invite; partner: Partner; writes: AskWrites }) {
  // Will not do it / Cannot do it ask why first (the owner, 2026-10-04): the reason stays with the job and the company.
  const [declining, setDeclining] = useState<'wont' | 'cant' | null>(null)
  return (
    <>
      <Btn onClick={() => setDeclining('wont')}>Will not do it</Btn>
      <Btn onClick={() => setDeclining('cant')}>Cannot do it</Btn>
      {declining && (
        <GcDeclineForm
          company={partner.company}
          why={declining}
          context={`${project.name} · ${pkg.trade}`}
          onCancel={() => setDeclining(null)}
          onSave={async (reason, note) => {
            await writes.decline(invite.id, declining, reason, note)
            setDeclining(null)
          }}
        />
      )}
    </>
  )
}

/** A trade's asks on a project: each company asked, where it stands, and its story, with Ask for quotes while a company in the trade is not asked. */
export function GcTradeAsks({
  state,
  projectId,
  packageId,
  writes,
  onAsk,
  onCompare,
}: {
  state: GcState
  projectId: string
  packageId: string
  writes: AskWrites
  onAsk?: () => void
  /** Open Compare quotes on this trade (B5-b). Shown once a quote is in. */
  onCompare?: () => void
}) {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  if (!project || !pkg || pkg.selfPerform) return null
  const asked = new Set(pkg.invites.map((i) => i.partnerId))
  const canAsk = Boolean(onAsk) && !project.lostOn && state.partners.some((p) => p.trades.includes(pkg.trade) && !asked.has(p.id))
  const quotes = bidsIn(pkg).length
  const ask = ((canAsk && onAsk) || (onCompare && quotes > 0)) && (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      {onCompare && quotes > 0 && (
        <Btn kind="primary" onClick={onCompare}>
          Compare quotes ({quotes})
        </Btn>
      )}
      {canAsk && onAsk && (
        <Btn kind="quiet" onClick={onAsk}>
          Ask for quotes
        </Btn>
      )}
    </div>
  )
  if (pkg.invites.length === 0)
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.85rem' }} data-gc-trade-asks={pkg.id}>
        No company asked yet.
        {ask}
      </div>
    )
  return (
    <div style={{ display: 'grid', gap: '0.45rem' }} data-gc-trade-asks={pkg.id}>
      {ask}
      {pkg.invites.map((invite) => {
        const partner = state.partners.find((p) => p.id === invite.partnerId)
        if (!partner) return null
        const words = ASK_WORDS[invite.status]
        const open = invite.status === 'invited' || invite.status === 'opened'
        return (
          <div key={invite.id} style={{ borderLeft: '3px solid var(--border)', paddingLeft: '0.6rem', display: 'grid', gap: '0.25rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <PartnerName partnerId={partner.id} company={partner.company} />
              {invite.status === 'declined' ? (
                <Chip tone="grey" title={declinedTitle(invite)}>
                  {declinedWords(invite)}
                </Chip>
              ) : (
                <Chip tone={words.tone}>{words.word}</Chip>
              )}
              <span style={{ color: 'var(--text-muted)' }}>asked {shortDate(invite.invitedOn)}</span>
              {open && <DeclineButtons project={project} pkg={pkg} invite={invite} partner={partner} writes={writes} />}
            </div>
            {open && <AskThread state={state} invite={invite} partner={partner} writes={writes} />}
          </div>
        )
      })}
    </div>
  )
}

const WHY_WORDS: Record<FollowUpWhy, { tone: Tone; title: string; blurb: string }> = {
  // The owner, 2026-10-04 (relayed by the Portal lane): "Late on their word", matching the portal's "late: you said Sep 30".
  passed: { tone: 'red', title: 'Late on their word', blurb: 'They gave a day and no quote came. Call them.' },
  today: { tone: 'amber', title: 'Promised today', blurb: 'Their quote is due today. Check before you go home.' },
  silent: { tone: 'red', title: 'Never opened it', blurb: 'We asked and they have not looked. Call, or offer it to the next company.' },
  nodate: { tone: 'amber', title: 'No day given', blurb: 'They have the plans. Get a day from them.' },
  waiting: { tone: 'blue', title: 'Waiting on their word', blurb: 'They gave a day and it has not come. Nothing to do yet.' },
}

const WHY_ORDER: FollowUpWhy[] = ['passed', 'today', 'silent', 'nodate', 'waiting']

/** Follow up: every company we are waiting on for a quote, across every project, the ones to call first. */
export function GcFollowUp({ state, writes, onWhoElse }: { state: GcState; writes: AskWrites; onWhoElse: (trade: string) => void }) {
  const all = followUps(state)
  return (
    <section aria-label="Follow up" style={{ display: 'grid', gap: '0.9rem' }}>
      {WHY_ORDER.map((why) => {
        const rows = all.filter((f) => f.why === why)
        if (rows.length === 0) return null
        const words = WHY_WORDS[why]
        return (
          <section key={why}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                {words.title} ({rows.length})
              </h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{words.blurb}</span>
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {rows.map((f) => (
                <FollowUpCard key={f.invite.id} state={state} followUp={f} writes={writes} onWhoElse={onWhoElse} />
              ))}
            </div>
          </section>
        )
      })}
      {all.length === 0 && <Card style={{ color: 'var(--text-muted)' }}>We are not waiting on anyone for a quote.</Card>}
    </section>
  )
}

function FollowUpCard({ state, followUp, writes, onWhoElse }: { state: GcState; followUp: FollowUp; writes: AskWrites; onWhoElse: (trade: string) => void }) {
  const { project, pkg, invite, partner, why } = followUp
  return (
    <Card style={{ borderLeft: `4px solid ${why === 'waiting' ? 'var(--border-blue)' : why === 'passed' || why === 'silent' ? '#dc2626' : '#d97706'}` }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }} data-gc-follow-up={invite.id}>
        <PartnerName partnerId={partner.id} company={partner.company} />
        <span style={{ color: 'var(--text-muted)' }}>{partner.contact}</span>
        {/* The bid date sits with the job, once, not as a sentence on every card. */}
        <Chip tone="grey">
          {project.name} · {pkg.trade}
          {project.bidDue ? ` · bid ${weekdayDate(project.bidDue)}` : ''}
        </Chip>
        <span style={{ flex: 1 }} />
        {/* One press to call: only a number we have, never a made-up one. */}
        {partner.phone && (
          <a
            href={telHref(partner.phone)}
            title={`Call ${partner.phone}`}
            style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-base)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Call {partner.contact.split(' ')[0] || partner.company}
          </a>
        )}
        {why !== 'waiting' && <DeclineButtons project={project} pkg={pkg} invite={invite} partner={partner} writes={writes} />}
        <Btn kind="quiet" onClick={() => onWhoElse(pkg.trade)} title="See who else could quote this trade.">
          Who else?
        </Btn>
      </div>
      {/* The section says why they are here, the chip says the day: the card's sentence stays in the data. */}
      <div style={{ marginTop: '0.35rem' }}>
        <AskThread state={state} invite={invite} partner={partner} writes={writes} onList />
      </div>
    </Card>
  )
}
