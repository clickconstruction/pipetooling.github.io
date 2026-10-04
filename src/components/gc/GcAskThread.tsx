import { useState, type Dispatch } from 'react'
import {
  askPromise,
  followUps,
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
}

/** The story on one ask: their word, the last thing said, a way to add a line, and the rest on a press. */
export function AskThread({ state, project, pkg, invite, partner, dispatch }: ThreadProps) {
  const [logging, setLogging] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [how, setHow] = useState<'call' | 'text' | 'email'>('call')
  const [note, setNote] = useState('')
  const [promisedBy, setPromisedBy] = useState('')
  const contacts = invite.contacts ?? []
  const last = contacts[0]
  const word = wordRecord(state, partner)
  const ids = { projectId: project.id, packageId: pkg.id, inviteId: invite.id }

  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <PromiseChip invite={invite} today={state.today} />
        {word.made > 0 && (
          <span style={{ color: 'var(--text-muted)' }} title="How often the day they gave for a quote held.">
            kept {word.kept} of {word.made} promises
          </span>
        )}
        {!logging && <Btn kind="quiet" onClick={() => setLogging(true)}>Log a contact</Btn>}
        {contacts.length > 1 && (
          <Btn kind="quiet" onClick={() => setShowAll(!showAll)}>{showAll ? 'Hide the story' : `The story (${contacts.length})`}</Btn>
        )}
      </div>

      {last && !showAll && <ContactLine line={last} />}
      {showAll && contacts.map((line, i) => <ContactLine key={`${line.on}-${i}`} line={line} />)}
      {!last && !logging && <span style={{ color: 'var(--text-muted)' }}>No contact logged on this ask yet.</span>}

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

function ContactLine({ line }: { line: AskContact }) {
  return (
    <div>
      <span style={{ color: 'var(--text-muted)' }}>
        {shortDate(line.on)} · {line.by} · {HOW_WORDS[line.how]}:
      </span>{' '}
      {line.note}
      {line.promisedBy && <strong> Quote by {shortDate(line.promisedBy)}.</strong>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Follow up: everyone we are waiting on, across every project, the ones to call first
// ---------------------------------------------------------------------------------------------

const WHY_WORDS: Record<FollowUpWhy, { tone: Tone; title: string; blurb: string }> = {
  passed: { tone: 'red', title: 'Their day passed', blurb: 'They gave a day and no quote came. Call them.' },
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
  const toCall = all.filter((f) => f.why !== 'waiting').length
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        Every company we are waiting on, across every project, with the ones to call first. Log what they say as you
        go. When they give a day for their quote, write it down: if that day passes with no quote, they come back to
        the top of this list. {toCall === 0 ? 'No one to call right now.' : `${toCall} to call now.`}
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
                <FollowUpCard key={f.invite.id} state={state} followUp={f} dispatch={dispatch} onMap={onMap} />
              ))}
            </div>
          </section>
        )
      })}
      {/* Insurance, papers and every other promise (question 8). */}
      <GcFollowUpPromises state={state} dispatch={dispatch} />
      {all.length === 0 && <Card style={{ color: 'var(--text-muted)' }}>We are not waiting on anyone for a quote.</Card>}
    </div>
  )
}

function FollowUpCard({
  state,
  followUp,
  dispatch,
  onMap,
}: {
  state: GcState
  followUp: FollowUp
  dispatch: Dispatch<GcAction>
  onMap: (projectId: string, packageId: string) => void
}) {
  const { project, pkg, invite, partner, why, words } = followUp
  const ids = { projectId: project.id, packageId: pkg.id, inviteId: invite.id }
  // Will not do it / Cannot do it ask why first (the owner, 2026-10-04): the reason stays with the job and the company.
  const [declining, setDeclining] = useState<'wont' | 'cant' | null>(null)
  return (
    <Card style={{ borderLeft: `4px solid ${why === 'waiting' ? 'var(--border-blue)' : why === 'passed' || why === 'silent' ? '#dc2626' : '#d97706'}` }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{partner.company}</strong>
        <span style={{ color: 'var(--text-muted)' }}>{partner.contact}</span>
        <Chip tone="grey">{project.name} · {pkg.trade}</Chip>
        {/* Portal lane: a company that never opened its link. */}
        <LinkNeverOpenedChip state={state} partnerId={partner.id} />
        <span style={{ flex: 1 }} />
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
      <div style={{ margin: '0.3rem 0 0.4rem', fontSize: '0.9rem' }}>{words}</div>
      <AskThread state={state} project={project} pkg={pkg} invite={invite} partner={partner} dispatch={dispatch} />
    </Card>
  )
}
