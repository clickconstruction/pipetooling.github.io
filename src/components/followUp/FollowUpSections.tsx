/**
 * Messages, cut 2: Follow up's sections, drawn above the asks the tab already lists (the prototype v1.178's
 * `renderFollowup`): **Needs you** (a note's day come back, the clause edits waiting on approval, a customer's portal),
 * **Needs a reply** (longest waiting first, with who has it and the presses), **We owe them**, and the slot the nudges
 * from the flow fill after them. Each row is one person; a press anywhere off its buttons opens their thread at its
 * line. The queue and its words are the kernels' (`followUp/queue.ts`, `messages/owed.ts`, `messages/promises.ts`);
 * this draws them and hands each press to the page.
 */
import type { ReactNode } from 'react'
import { lineGcProject } from '../../lib/followUp/askArchitect'
import type { FollowUpContact, FollowUpLine } from '../../lib/followUp/followUpRows'
import { needsYouCount, type BackRow, type FollowUpQueue, type NeedsReplyRow, type OwedRow, type PortalRow } from '../../lib/followUp/queue'
import { markedByWords } from '../../lib/messages/owed'
import { agoWords, channelWord, lineWhen, snippetOf } from '../../lib/messages/thread'
import { Btn, Card, Chip } from '../gc/gcUi'
import { WhoHasItPill, type Teammate } from './WhoHasItPill'

/** What a row's presses do; the page runs each as a press and reads the queue again. */
export interface FollowUpSectionActions {
  openThread: (contactId: string, atMessageId?: string) => void
  hand: (contactId: string, userId: string | null) => void
  noReplyNeeded: (contactId: string) => void
  remindMonday: (contactId: string) => void
  backDone: (noteId: string) => void
  anotherDay: (noteId: string) => void
  /** A plans question to the job's architect. Unset, or a line on no GC project: no press. */
  askArchitect?: (messageId: string) => void
  /** A customer's page as they see it (the portal's; the screen comes with cut 8). Unset: no press. */
  seeTheirPage?: (contactId: string) => void
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
}

/** What Needs you holds, said under its heading: the clause rows only once the page hands them in. */
const NEEDS_YOU_NOTE = {
  back: 'A note with a day comes back here that morning.',
  portal: 'A portal row is a customer who wrote on their page.',
  clause: 'A clause row waits on a controller or a dev.',
}

const KIND_WORDS: Readonly<Record<string, string>> = { customer: 'customer', trade: 'trade partner', arch: 'architect', unknown: 'who is this?' }

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
  const { queue, contacts, renderClauses, renderNudges } = props
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const youCount = needsYouCount(queue)
  const back = queue.needsYou.filter((r): r is BackRow => r.kind === 'back')
  const portal = queue.needsYou.filter((r): r is PortalRow => r.kind === 'portal')

  return (
    <section aria-label="Follow up: who is waiting on us" style={{ display: 'grid', gap: '0.9rem' }}>
      {youCount > 0 && (
        <Section title={`Needs you (${youCount})`} note={[NEEDS_YOU_NOTE.back, NEEDS_YOU_NOTE.portal, ...(renderClauses ? [NEEDS_YOU_NOTE.clause] : [])].join(' ')}>
          {back.map((r) => byId.get(r.contactId) && <BackRowView key={r.noteId} row={r} contact={byId.get(r.contactId)!} {...props} />)}
          {queue.clauses.length > 0 && renderClauses?.(queue.clauses)}
          {portal.map((r, i) => byId.get(r.contactId) && <PortalRowView key={`${r.contactId}-${i}`} row={r} contact={byId.get(r.contactId)!} {...props} />)}
        </Section>
      )}
      <Section title={`Needs a reply (${queue.needsReply.length})`} note="Texts, voicemails, missed calls and emails nobody has answered. The one waiting longest is first.">
        {queue.needsReply.length === 0 ? (
          <Empty>Nobody is waiting on us.</Empty>
        ) : (
          queue.needsReply.map((r) => byId.get(r.contactId) && <ReplyRowView key={r.contactId} row={r} contact={byId.get(r.contactId)!} {...props} />)
        )}
      </Section>
      <Section title={`We owe them (${queue.weOwe.length})`} note="What we still have to do for someone, with its day. It stays our move until a note or a message marks it done.">
        {queue.weOwe.length === 0 ? <Empty>Nothing we owe anyone.</Empty> : queue.weOwe.map((r) => byId.get(r.contactId) && <OwedRowView key={r.contactId} row={r} contact={byId.get(r.contactId)!} {...props} />)}
      </Section>
      {renderNudges?.(queue.nudges)}
    </section>
  )
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section aria-label={title.replace(/ \(\d+\)$/, '')}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{note}</span>
      </div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <Card style={{ color: 'var(--text-muted)' }}>{children}</Card>
}

/** One person's row: a press anywhere off its buttons opens the thread at its line. */
function Row<C, N extends { contactId: string }>({
  contact,
  landOn,
  pill,
  sub,
  snippet,
  acts,
  props,
}: {
  contact: FollowUpContact
  landOn?: string | null
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
              <strong>{contact.name}</strong>
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
            ) : label === 'Call back in Quo' ? (
              <Btn key={label} onClick={() => undefined} disabled title="Calls through Quo come with the phone link. Call from your own phone until then.">
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
