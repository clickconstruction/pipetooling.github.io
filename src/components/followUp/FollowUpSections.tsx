/**
 * Messages, cut 2: Follow up's sections, drawn above the asks the tab already lists (the prototype v1.178's
 * `renderFollowup`): **New** first (residential R7, mockup A: what came in and still needs sorting, each row's press
 * opening the thread at the sort card), **Needs you** (a note's day come back, the clause edits waiting on approval, a customer's portal),
 * **Needs a reply** (longest waiting first, with who has it and the presses), **We owe them**, and the slot the nudges
 * from the flow fill after them. Each row is one person; a press anywhere off its buttons opens their thread at its
 * line. The queue and its words are the kernels' (`followUp/queue.ts`, `messages/owed.ts`, `messages/promises.ts`);
 * this draws them and hands each press to the page.
 */
import { PUT_BACK, setAsideLines, setAsideTitle, type SetAsideRow } from '../../lib/followUp/setAsideFold'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { callFirst, callTitle, CALL_WORDS, dayAfter, type CallTaskRow } from '../../lib/calls/callTasks'
import { boxForNew } from '../../lib/messages/boxes'
import { lineGcProject } from '../../lib/followUp/askArchitect'
import type { FollowUpContact, FollowUpLine } from '../../lib/followUp/followUpRows'
import { NEW_LANE_EMPTY, type NewLaneRow } from '../../lib/followUp/newLane'
import { canSortAll, SORT_ALL } from '../../lib/followUp/sortDesk'
import { ANSWER_ALL, canAnswerAll } from '../../lib/followUp/answerDesk'
import { needsYouCount, type BackRow, type FollowUpQueue, type NeedsReplyRow, type OwedRow, type PortalRow } from '../../lib/followUp/queue'
import { LANE_NOTES } from '../../lib/followUp/laneNotes'
import { JUMP_LANE_COLOR } from '../../lib/messages/jumpStrip'
import { markedByWords } from '../../lib/messages/owed'
import { agoWords, channelWord, lineWhen, snippetOf } from '../../lib/messages/thread'
import { Btn, Card, Chip } from '../gc/gcUi'
import { WhoHasItPill, type Teammate } from './WhoHasItPill'
import { CallButton } from '../messages/CallButton'
import { EmptyState } from '../EmptyState'

/** Call back on a missed call or a voicemail (to-do #152): Btn's plain look, as a link. */
const CALL_BACK_STYLE: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: '0.85rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', textDecoration: 'none', whiteSpace: 'nowrap' }

/** What a row's presses do; the page runs each as a press and reads the queue again. */
export interface FollowUpSectionActions {
  openThread: (contactId: string, atMessageId?: string) => void
  hand: (contactId: string, userId: string | null) => void
  noReplyNeeded: (contactId: string) => void
  remindMonday: (contactId: string) => void
  backDone: (noteId: string) => void
  anotherDay: (noteId: string) => void
  /** A call to make (v2.5596): I called or Skip, and Tomorrow. Unset: the row reads only. */
  callDone?: (id: string, how: 'called' | 'skipped') => void
  callMove?: (id: string, dueYmd: string) => void
  /** A plans question to the job's architect. Unset, or a line on no GC project: no press. */
  askArchitect?: (messageId: string) => void
  /** A customer's page as they see it (the portal's; the screen comes with cut 8). Unset: no press. */
  seeTheirPage?: (contactId: string) => void
  /** **Sort all** on New's header (R7, mockup C): opens the desk. Unset: no press. */
  sortAll?: () => void
  /** **Answer all** on Needs a reply's header (punch list #140 PR 6): opens the desk. Unset: no press. */
  answerAll?: () => void
  /** A lead's doors (punch list #140 PR 8): the row's Book a visit and Start an estimate, with their newest words. Unset: the labels draw dead. */
  bookVisit?: (contactId: string, words: string | null) => void
  startEstimate?: (contactId: string, words: string | null) => void
  /** **Put back** on a notice the reader set aside (v2.6231). Unset: the fold draws without the press. */
  putBack?: (id: string) => void
}

export interface FollowUpSectionsProps<C, N extends { contactId: string }> {
  queue: FollowUpQueue<C, N>
  contacts: readonly FollowUpContact[]
  /** The lines the queue read, by id, for a row's snippet. */
  lines: ReadonlyMap<string, FollowUpLine>
  me: Teammate
  team: readonly Teammate[]
  todayYmd: string
  nowIso: string
  actions: FollowUpSectionActions
  /** The press running now, so its buttons wait. */
  pressing?: string | null
  /** The clause rows (`contracts/ClauseNeedRows`), drawn after the notes. */
  renderClauses?: (rows: readonly C[]) => ReactNode
  /** The nudges from the flow (`flows/nudges.ts`), drawn after We owe them. */
  renderNudges?: (rows: readonly N[]) => ReactNode
  /**
   * The lanes' look (v2.5802, punch list #151 PR 3): `plain` prints each lane's sentence under its heading, as GC
   * projects' Follow up does; `bands` draws the heading as a band in the lane's color with the count in a pill and
   * keeps the sentence off the page, since `/messages` says it behind its bar's ?.
   */
  laneLook?: LaneLook
  /** The notices the reader set aside this week (v2.6231), folded under New with a count. */
  setAside?: readonly SetAsideRow[]
}

export type LaneLook = 'plain' | 'bands'

const KIND_WORDS: Readonly<Record<string, string>> = { customer: 'customer', trade: 'trade partner', arch: 'architect', lead: 'lead', unknown: 'who is this?' }

const initials = (c: FollowUpContact) =>
  c.kind === 'unknown'
    ? '?'
    : c.name
        .split(/\s+/)
        .filter((w) => w && !/^dr\.?$/i.test(w))
        .map((w) => w[0]!.toUpperCase())
        .join('')
        .slice(0, 2)

/** Two hundred and twenty characters of a line, cut at a word. */
const clip = (s: string) => (s.length > 220 ? `${s.slice(0, 220).replace(/\s+\S*$/, '')}…` : s)

export function FollowUpSections<C, N extends { contactId: string }>(props: FollowUpSectionsProps<C, N>) {
  const { queue, contacts, renderClauses, renderNudges, actions, laneLook: look = 'plain' } = props
  const setAside = props.setAside ?? []
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const youCount = needsYouCount(queue)
  const back = queue.needsYou.filter((r): r is BackRow => r.kind === 'back')
  const portal = queue.needsYou.filter((r): r is PortalRow => r.kind === 'portal')

  return (
    <section aria-label="Follow up: who is waiting on us" style={{ display: 'grid', gap: '0.9rem' }}>
      <Section
        id="new-lane"
        name="New"
        count={queue.newLane.length}
        note={LANE_NOTES.new}
        look={look}
        color={JUMP_LANE_COLOR.new}
        action={
          actions.sortAll && canSortAll(queue.newLane.length) ? (
            <Btn kind="primary" onClick={actions.sortAll}>
              {SORT_ALL}
            </Btn>
          ) : undefined
        }
      >
        {queue.newLane.length === 0 ? (
          <EmptyState compact main={NEW_LANE_EMPTY} />
        ) : (
          queue.newLane.map((r) => byId.get(r.contactId) && <NewRowView key={r.contactId} row={r} contact={byId.get(r.contactId)!} {...props} />)
        )}
        {setAside.length > 0 && <SetAsideFold rows={setAside} nowIso={props.nowIso} pressing={props.pressing} onPutBack={actions.putBack} />}
      </Section>
      {youCount > 0 && (
        <Section id="needs-you" name="Needs you" count={youCount} note={LANE_NOTES.needsYou(Boolean(renderClauses))} look={look} color={JUMP_LANE_COLOR.needsYou}>
          {back.map((r) => byId.get(r.contactId) && <BackRowView key={r.noteId} row={r} contact={byId.get(r.contactId)!} {...props} />)}
          {queue.clauses.length > 0 && renderClauses?.(queue.clauses)}
          {portal.map((r, i) => byId.get(r.contactId) && <PortalRowView key={`${r.contactId}-${i}`} row={r} contact={byId.get(r.contactId)!} {...props} />)}
        </Section>
      )}
      <Section
        id="needs-reply"
        name="Needs a reply"
        count={queue.needsReply.length}
        note={LANE_NOTES.needsReply}
        look={look}
        color={JUMP_LANE_COLOR.needsReply}
        action={
          actions.answerAll && canAnswerAll(queue.needsReply.length) ? (
            <Btn kind="primary" onClick={actions.answerAll}>
              {ANSWER_ALL}
            </Btn>
          ) : undefined
        }
      >
        {queue.needsReply.length === 0 ? (
          <EmptyState compact main="Nobody is waiting on us." />
        ) : (
          queue.needsReply.map((r) => byId.get(r.contactId) && <ReplyRowView key={r.contactId} row={r} contact={byId.get(r.contactId)!} {...props} />)
        )}
      </Section>
      <Section id="we-owe-them" name="We owe them" count={queue.weOwe.length + queue.calls.length} note={LANE_NOTES.weOwe} look={look} color={JUMP_LANE_COLOR.weOwe}>
        {queue.weOwe.length === 0 && queue.calls.length === 0 ? (
          <EmptyState compact main="Nothing we owe anyone." />
        ) : (
          <>
            {queue.weOwe.map((r) => byId.get(r.contactId) && <OwedRowView key={r.contactId} row={r} contact={byId.get(r.contactId)!} {...props} />)}
            {queue.calls.map((r) => byId.get(r.contactId) && <CallRowView key={r.id} row={r} contact={byId.get(r.contactId)!} {...props} />)}
          </>
        )}
      </Section>
      {renderNudges?.(queue.nudges)}
    </section>
  )
}

/**
 * A lane. Its `id` is where `/messages`' jump strip lands (`lib/messages/jumpStrip.ts`), under the bar by `.messagesLane`'s
 * margin. `look` is the host's (v2.5802): `plain` prints the lane's sentence under its heading; `bands` draws the heading
 * as the Pipeline's section band in the lane's color with the count in a pill and no sentence. The heading's name reads
 * `Name (N)` either way.
 */
function Section({ id, name, count, note, look, color, action, children }: { id: string; name: string; count: number; note: string; look: LaneLook; color: string; action?: ReactNode; children: ReactNode }) {
  const title = `${name} (${count})`
  return (
    <section id={id} className="messagesLane" aria-label={name}>
      {look === 'bands' ? (
        <div className="stagesSectionBand messagesLaneBand" style={{ '--stage-color': color } as CSSProperties} data-testid="lane-band">
          <h3 className="stagesBandTitle" aria-label={title}>
            {name}{' '}
            <span className="stagesBandCount" aria-hidden>
              {count}
            </span>
          </h3>
          {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{note}</span>
          {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
        </div>
      )}
      <div style={{ display: 'grid', gap: '0.5rem' }}>{children}</div>
    </section>
  )
}

/** One person's row: a press anywhere off its buttons opens the thread at its line. `lead` draws before the name, `beside` and `pill` after it. */
function Row<C, N extends { contactId: string }>({
  contact,
  landOn,
  lead,
  beside,
  pill,
  sub,
  snippet,
  acts,
  props,
}: {
  contact: FollowUpContact
  landOn?: string | null
  lead?: ReactNode
  beside?: ReactNode
  pill?: ReactNode
  sub: string
  snippet?: ReactNode
  acts?: ReactNode
  props: FollowUpSectionsProps<C, N>
}) {
  const { me, team, contacts, todayYmd, nowIso, actions, pressing } = props
  return (
    <Card style={{ padding: '0.6rem 0.8rem' }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${contact.name}’s thread`}
        data-follow-up-row={contact.id}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, a, input, select')) return
          actions.openThread(contact.id, landOn ?? undefined)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) actions.openThread(contact.id, landOn ?? undefined)
        }}
        style={{ display: 'grid', gap: '0.35rem', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            aria-hidden
            style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 999, background: 'var(--bg-muted)', fontWeight: 700, fontSize: '0.8rem' }}
          >
            {initials(contact)}
          </span>
          <span style={{ display: 'grid', flex: 1, minWidth: 180 }}>
            <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {lead}
              <strong>{contact.name}</strong>
              {beside}
              {pill}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub}</span>
          </span>
          <WhoHasItPill
            contact={contact}
            me={me}
            team={team}
            everyone={contacts}
            todayYmd={todayYmd}
            nowIso={nowIso}
            busy={pressing === `hand ${contact.id}`}
            onHand={(userId) => actions.hand(contact.id, userId)}
          />
        </div>
        {snippet && <div style={{ fontSize: '0.875rem', color: 'var(--text-base)' }}>{snippet}</div>}
        {acts && <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{acts}</div>}
      </div>
    </Card>
  )
}

const companyOf = (c: FollowUpContact) => c.company || KIND_WORDS[c.kind] || ''

function BackRowView<C, N extends { contactId: string }>({ row, contact, ...props }: { row: BackRow; contact: FollowUpContact } & FollowUpSectionsProps<C, N>) {
  const { actions, pressing } = props
  return (
    <Row
      contact={contact}
      landOn={row.noteId}
      pill={<Chip tone="blue">↩ {row.pill}</Chip>}
      sub={`${companyOf(contact)} · ${row.noteBy}`}
      snippet={
        <>
          <strong>Note for the team:</strong> {row.note}
        </>
      }
      acts={
        <>
          <Btn kind="primary" onClick={() => actions.openThread(contact.id, row.noteId)}>
            Open the thread
          </Btn>
          <Btn onClick={() => actions.backDone(row.noteId)} disabled={pressing === `back ${row.noteId}`} title="Clears the day. The note stays in the thread.">
            Done with it
          </Btn>
          <Btn onClick={() => actions.anotherDay(row.noteId)} disabled={pressing === `back ${row.noteId}`} title="Brings it back on the next working day.">
            Another day
          </Btn>
        </>
      }
      props={props}
    />
  )
}

function PortalRowView<C, N extends { contactId: string }>({ row, contact, ...props }: { row: PortalRow; contact: FollowUpContact } & FollowUpSectionsProps<C, N>) {
  const { actions } = props
  return (
    <Row
      contact={contact}
      landOn={row.landOnId ?? null}
      pill={
        <Chip tone="violet" title={row.why}>
          portal · {row.pill}
        </Chip>
      }
      sub={`${companyOf(contact)} · ${row.sub}${row.more ? ` · ${row.more}` : ''}`}
      snippet={row.snippet}
      acts={
        <>
          <Btn kind="primary" onClick={() => actions.openThread(contact.id, row.landOnId)}>
            Open the thread
          </Btn>
          {actions.seeTheirPage && <Btn onClick={() => actions.seeTheirPage!(contact.id)}>See their page</Btn>}
        </>
      }
      props={props}
    />
  )
}

/** *Bid it?* (v2.6222) wears the estimator's purple, so an invitation reads apart from the office's three sorts at a glance. */
const BID_PRESS: CSSProperties = { background: '#6d28d9', border: '1px solid #6d28d9' }

/** The one press on a New row (v2.5793): the sort's question as a small blue pill before the name (v2.6191), the same words as the card it opens. */
const SORT_PRESS: CSSProperties = {
  display: 'inline-block',
  padding: '0.1rem 0.6rem',
  borderRadius: 999,
  background: '#2563eb',
  color: 'white',
  border: '1px solid #2563eb',
  font: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

/**
 * The notices the reader set aside this week (v2.6231): a fold under New with the count, each row the sender, the
 * subject, when, and **Put back**, which marks it for the next read. Never a delete; nothing in Gmail changes.
 */
function SetAsideFold({ rows, nowIso, pressing, onPutBack }: { rows: readonly SetAsideRow[]; nowIso: string; pressing?: string | null; onPutBack?: (id: string) => void }) {
  const lines = setAsideLines(rows, nowIso)
  return (
    <details data-set-aside-fold style={{ border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '0.5rem 0.8rem', background: 'var(--bg-subtle)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>{setAsideTitle(rows.length)}</summary>
      <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.4rem' }}>
        {lines.map((l) => (
          <div key={l.id} data-set-aside-row={l.id} title={l.why} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-600)' }}>
            <span style={{ flex: 1, minWidth: 160, overflowWrap: 'anywhere' }}>
              {l.who} · <i>{l.subject}</i> · {l.when}
            </span>
            {onPutBack && (
              <Btn kind="quiet" onClick={() => onPutBack(l.id)} disabled={pressing === `putBack ${l.id}`}>
                {PUT_BACK}
              </Btn>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

/**
 * A person who still needs sorting. One control, the sort's question before the name (*Who is this? ›*, since v2.6191;
 * beside it from v2.5793), opens the thread at the sort card, as the row itself does; nothing repeats it under the
 * subject. After the name, the address or the number the line came from (`row.reach`), quiet, unless the name is it
 * already. When the app texted back after their missed call (v2.6012) a quiet line says so, and that the row still waits.
 */
function NewRowView<C, N extends { contactId: string }>({ row, contact, ...props }: { row: NewLaneRow; contact: FollowUpContact } & FollowUpSectionsProps<C, N>) {
  const { actions } = props
  return (
    <Row
      contact={contact}
      landOn={row.messageId}
      lead={
        <button type="button" onClick={() => actions.openThread(contact.id, row.messageId)} title={row.why} style={row.sort === 'bid' ? { ...SORT_PRESS, ...BID_PRESS } : SORT_PRESS} data-new-lane-press={row.sort}>
          {row.head}
          <span aria-hidden> ›</span>
        </button>
      }
      beside={
        row.reach ? (
          <span data-new-lane-reach style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflowWrap: 'anywhere', minWidth: 0 }}>
            {row.reach}
          </span>
        ) : undefined
      }
      sub={[contact.kind === 'unknown' ? '' : companyOf(contact), row.via, row.when].filter(Boolean).join(' · ')}
      snippet={clip(row.words)}
      acts={
        row.autoLine ? (
          <span data-new-lane-auto style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {row.autoLine}
          </span>
        ) : undefined
      }
      props={props}
    />
  )
}

function ReplyRowView<C, N extends { contactId: string }>({ row, contact, ...props }: { row: NeedsReplyRow; contact: FollowUpContact } & FollowUpSectionsProps<C, N>) {
  const { actions, pressing, nowIso, lines } = props
  const line = row.landOnId ? lines.get(row.landOnId) : undefined
  const busy = pressing === `state ${contact.id}`
  return (
    <Row
      contact={contact}
      landOn={row.landOnId}
      pill={
        row.waitingSince ? (
          <Chip tone="amber" title="Their word was last, so the next move is ours. It counts from their last message.">
            Our move · {agoWords(row.waitingSince, nowIso)}
          </Chip>
        ) : undefined
      }
      sub={companyOf(contact)}
      snippet={
        line ? (
          <>
            <strong>
              {channelWord(line)}, {lineWhen(line.at, nowIso)}:
            </strong>{' '}
            {clip(snippetOf(line))}
          </>
        ) : undefined
      }
      acts={
        <>
          {row.offers.map((o) =>
            o.kind === 'day' ? (
              <Btn key={o.messageId} onClick={() => actions.openThread(contact.id, o.messageId)} title="Opens the line, where the day's choices are.">
                {o.label}
              </Btn>
            ) : actions.askArchitect && lineGcProject(lines.get(o.messageId)) ? (
              <Btn
                key={o.messageId}
                onClick={() => actions.askArchitect!(o.messageId)}
                disabled={pressing === `ask ${o.messageId}`}
                title="Puts it on the job's questions about the plans and emails it to the architect."
              >
                {o.label}
              </Btn>
            ) : null,
          )}
          {row.acts.map((label) =>
            label === 'Reply' || label === 'Who is this?' ? (
              <Btn key={label} kind="primary" onClick={() => actions.openThread(contact.id, row.landOnId ?? undefined)}>
                {label}
              </Btn>
            ) : label === 'Call back' ? (
              contact.phone?.trim() ? (
                <CallButton site="call-task" key={label} number={contact.phone} name={contact.name} verb={label} box={boxForNew(contact)} glyph="☎ " style={CALL_BACK_STYLE} testId={`call-back-${contact.id}`} />
              ) : (
                <Btn key={label} onClick={() => undefined} disabled title="No number to call.">
                  {label}
                </Btn>
              )
            ) : label === 'Book a visit' ? (
              <Btn key={label} onClick={() => actions.bookVisit?.(contact.id, line ? snippetOf(line) : null)} disabled={busy || !actions.bookVisit} title="Makes them a customer and opens Add Job with their name, number and words filled in.">
                {label}
              </Btn>
            ) : label === 'Start an estimate' ? (
              <Btn key={label} onClick={() => actions.startEstimate?.(contact.id, line ? snippetOf(line) : null)} disabled={busy || !actions.startEstimate} title="Makes them a customer and opens a new estimate on them. The thread comes with them.">
                {label}
              </Btn>
            ) : label === 'No reply needed' ? (
              <Btn key={label} onClick={() => actions.noReplyNeeded(contact.id)} disabled={busy}>
                {label}
              </Btn>
            ) : (
              <Btn key={label} onClick={() => actions.remindMonday(contact.id)} disabled={busy}>
                {label}
              </Btn>
            ),
          )}
        </>
      }
      props={props}
    />
  )
}

/** A call to make (v2.5596): who, about what, its day; the script to read; Call, I called, Tomorrow and Skip. */
function CallRowView<C, N extends { contactId: string }>({ row, contact, ...props }: { row: CallTaskRow; contact: FollowUpContact } & FollowUpSectionsProps<C, N>) {
  const { actions, pressing, todayYmd, nowIso } = props
  const [open, setOpen] = useState(false)
  const first = callFirst(contact)
  const number = contact.phone?.trim() || null
  const busy = pressing === `call ${row.id}`
  return (
    <Row
      contact={contact}
      pill={<Chip tone={row.late ? 'red' : row.today ? 'amber' : 'blue'}>{row.pill}</Chip>}
      sub={`${callTitle(first, row.what)} · added by ${row.madeBy} ${agoWords(row.madeAt, nowIso)}`}
      snippet={
        row.script ? (
          <div data-call-script-row={row.id} style={{ fontSize: '0.85rem' }}>
            <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }}>
              {open ? 'Hide what to say' : CALL_WORDS.whatToSay}
            </button>
            {open && <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{row.script}</p>}
          </div>
        ) : undefined
      }
      acts={
        <>
          {number ? (
            <CallButton site="call-task"
              number={number}
              name={contact.name}
              verb={CALL_WORDS.call}
              box={boxForNew(contact)}
              glyph="📞 "
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.7rem', borderRadius: 8, background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}
              testId={`call-dial-${row.id}`}
            />
          ) : null}
          {actions.callDone ? (
            <Btn onClick={() => actions.callDone?.(row.id, 'called')} disabled={busy} title="Closes the call with a note in the thread.">
              {CALL_WORDS.iCalled}
            </Btn>
          ) : null}
          {actions.callMove ? (
            <Btn onClick={() => actions.callMove?.(row.id, dayAfter(todayYmd))} disabled={busy} title="Moves the call to tomorrow.">
              {CALL_WORDS.tomorrow}
            </Btn>
          ) : null}
          {actions.callDone ? (
            <Btn onClick={() => actions.callDone?.(row.id, 'skipped')} disabled={busy} title="Closes the call with no note. A gray line says so.">
              {CALL_WORDS.skip}
            </Btn>
          ) : null}
        </>
      }
      props={props}
    />
  )
}

function OwedRowView<C, N extends { contactId: string }>({ row, contact, ...props }: { row: OwedRow; contact: FollowUpContact } & FollowUpSectionsProps<C, N>) {
  const { actions, nowIso } = props
  return (
    <Row
      contact={contact}
      pill={
        <button
          type="button"
          title={`We owe ${contact.name} ${row.owed.what}. Press to open the thread at the reply box, where the ways to deal with it are.`}
          onClick={() => actions.openThread(contact.id)}
          style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
        >
          <Chip tone={row.late ? 'red' : 'blue'}>{row.pill} ▾</Chip>
        </button>
      }
      sub={`${companyOf(contact)} · ${markedByWords(row.owed, nowIso)}`}
      props={props}
    />
  )
}
