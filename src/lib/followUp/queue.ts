/**
 * Messages, cut 2: Follow up, one queue of everything waiting on us, and who has each conversation. Lifted from the
 * Messages prototype v1.178 (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html`: `renderFollowup`'s
 * sections, `noteBack`, `setNoteBack`, `clearBack`, `pushBack`, `remind`, `setState`, `claim`, `whoPicker`,
 * `morePicker`'s state rows and `portalNeeds`; the why is `MESSAGES_PLAN.md` → *Follow up*, v1.12, v1.128, v1.146 and
 * v1.147). The sections, in order: New (residential R7: what came in and still needs sorting, `newLane.ts`, built by
 * the screen and passed through), Needs you (a note's day come back, a customer's portal), Needs a reply (longest
 * waiting first), We owe them, then the nudges from the flow, which `flows/nudges.ts` builds one row per person and
 * orders (this file passes them through as they come). Each section has one row per person, never one per job. A person
 * in New is not also in Needs a reply. The quote asks are `gc/followUp.ts`'s and the screen draws them last. Neither
 * the nudges nor the asks count on the badge.
 *
 * Open · Snoozed · Done is the app's to set (v1.146): a message from them opens the row, our reply or a team note
 * closes it, and the thread's ⋯ holds the overrides. A snooze wakes on its own day, so the queue reads the state
 * through `stateToday`. Pure: the writes are cut 2's RPCs (`take_it`, `hand_to`, `set_state`).
 *
 * Supply houses and candidates are never on it (`OFF_FOLLOW_UP`): their threads live on the RFQ and the hiring board.
 */
import { callRows, type CallTaskRecord, type CallTaskRow } from '../calls/callTasks'
import { firstName, type ContactKind } from '../contacts/kernel'
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly, ymdDaysBetween } from '../../utils/dateUtils'
import type { ThreadMessage } from '../messages/thread'
import { dayLabel, nextMonday, nextWorkday, owedPill, type DayKept, type Owed } from '../messages/owed'
import { rowOffers, type HeardLine, type RowOffer } from '../messages/promises'
import type { PaperView } from '../portal/papers'
import type { NewLaneRow } from './newLane'

/** Open, Snoozed or Done, as `contacts.state` keeps it. */
export type ContactState = 'waiting' | 'snoozed' | 'done'

/** The words for each state, as the thread and its ⋯ say them. */
export const STATE_WORDS: Readonly<Record<ContactState, string>> = { waiting: 'Open', snoozed: 'Snoozed', done: 'Done' }

/** A person as Follow up reads them: who they are, and the conversation's state. */
export interface QueueContact {
  id: string
  kind: ContactKind
  name: string
  goesBy?: string | null
  company?: string | null
  state: ContactState
  /** The day a snooze ends, when it is snoozed. */
  snoozedUntil?: string | null
  /** Who has it, by name; null when nobody does. */
  has?: string | null
}

/** A message as Follow up reads it, with a note's day to come back and the day it was dealt with. */
export type QueueMessage = Pick<ThreadMessage, 'id' | 'contactId' | 'channel' | 'direction' | 'at' | 'body' | 'backOn' | 'backBy'> & {
  /** A note's day to come back in the words typed, when they did not read as a date (`messages.back_words`). */
  backWords?: string | null
  /** When *Done with it* cleared the note's day (`messages.back_done_at`). The note stays in the thread. */
  backDoneAt?: string | null
}

/** What we owe a person, as `contact_owed` keeps one row. */
export type OwedRecord = Owed & { contactId: string; doneAt?: string | null }

/** A paper sent through a customer's page, as the portal reads it (`portal/papers.ts`), with whose page it is on. */
export interface CustomerPaper {
  contactId: string
  paper: PaperView
}

/** A sent paper turns into a Needs you row once it has sat unanswered this many days. */
export const PORTAL_PAPER_DAYS = 2

/**
 * The kinds Follow up never shows, in any section or on the badge: supply houses and candidates, the owner's call of
 * 2026-10-13, off Follow up by default. `followUpQueue` drops their rows in one place.
 */
export const OFF_FOLLOW_UP: ReadonlySet<ContactKind> = new Set<ContactKind>(['supply_house', 'candidate'])

/** Whether a person of this kind is on Follow up. */
export function onFollowUp(kind: ContactKind): boolean {
  return !OFF_FOLLOW_UP.has(kind)
}

/** The state as it stands today: a snooze whose day has come is open again. */
export function stateToday(contact: Pick<QueueContact, 'state' | 'snoozedUntil'>, todayYmd: string): ContactState {
  if (contact.state === 'snoozed' && contact.snoozedUntil && contact.snoozedUntil <= todayYmd) return 'waiting'
  return contact.state
}

const byTime = (a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at)

/** Each person's newest message to us, of any channel, in one pass over the messages. */
function newestIn(messages: ReadonlyArray<QueueMessage>): Map<string, QueueMessage> {
  const out = new Map<string, QueueMessage>()
  for (const m of messages) {
    if (m.direction !== 'in') continue
    const best = out.get(m.contactId)
    if (!best || byTime(m, best) > 0) out.set(m.contactId, m)
  }
  return out
}

/** One row of Needs a reply. */
export interface NeedsReplyRow {
  contactId: string
  /** The line a press on the row opens the thread at: their newest message. */
  landOnId: string | null
  /** When that line came, ISO. The row longest waiting is first. */
  waitingSince: string | null
  /** A missed call or a voicemail gets *Call back in Quo*. */
  callBack: boolean
  /** The days heard and the plans questions still offered on the thread. */
  offers: RowOffer[]
  /** The row's presses after the offers, in order. */
  acts: string[]
}

/**
 * Needs a reply: everyone open, the one waiting longest first, counted from their newest message as the move line
 * counts it. The prototype sorted by the newest line of any kind, so a team note could move a row. A customer whose
 * newest message is a portal write sits in Needs you instead (the lead, 2026-10-12), once.
 */
export function needsReply(
  contacts: ReadonlyArray<QueueContact>,
  messages: ReadonlyArray<QueueMessage>,
  heard: ReadonlyArray<HeardLine>,
  todayYmd: string,
): NeedsReplyRow[] {
  const rows: NeedsReplyRow[] = []
  const newest = newestIn(messages)
  for (const c of contacts) {
    if (stateToday(c, todayYmd) !== 'waiting') continue
    const last = newest.get(c.id)
    if (last?.channel === 'portal' && c.kind === 'customer') continue
    const callBack = last?.channel === 'missed' || last?.channel === 'voicemail'
    rows.push({
      contactId: c.id,
      landOnId: last?.id ?? null,
      waitingSince: last?.at ?? null,
      callBack,
      offers: rowOffers(heard, c.id),
      acts: [c.kind === 'unknown' ? 'Who is this?' : 'Reply', ...(callBack ? ['Call back in Quo'] : []), 'No reply needed', 'Remind me Monday'],
    })
  }
  const name = new Map(contacts.map((c) => [c.id, c.name]))
  return rows.sort((a, b) => {
    if (a.waitingSince && b.waitingSince) return Date.parse(a.waitingSince) - Date.parse(b.waitingSince) || (name.get(a.contactId) ?? '').localeCompare(name.get(b.contactId) ?? '')
    if (a.waitingSince || b.waitingSince) return a.waitingSince ? -1 : 1
    return (name.get(a.contactId) ?? '').localeCompare(name.get(b.contactId) ?? '')
  })
}

/** A note's day come back: the row returns to Follow up that morning, with the note (v1.128). */
export interface BackRow {
  kind: 'back'
  contactId: string
  noteId: string
  /** "back today", or "back since Thu Oct 1" for a day already gone by. */
  pill: string
  /** "the note by Rosa, Fri Oct 2". */
  noteBy: string
  note: string
  dayYmd: string
}

/** One paper waiting on a customer, as their portal row lists it. */
export interface PortalPaperLine {
  /** The paper's own id (`PaperView.id`: a change order's is its `gc_change_orders` row). */
  id: string
  /** "Change order 2 · a sink in exam 3". */
  name: string
  sentYmd: string
  /** Days since it was sent. */
  days: number
  openedYmd: string | null
  /** "Change order 2 · a sink in exam 3 · sent Wed Sep 30, 2 days · not opened". */
  label: string
}

/**
 * A customer's portal, one row per customer (v1.162): they wrote on their page, or papers sat opened or unopened. A
 * write leads the row, since they are waiting on us; their papers follow, the oldest first. The pill, sub and snippet
 * read the row's lead.
 */
export interface PortalRow {
  kind: 'portal'
  contactId: string
  /** After "portal ·": "wrote in the portal", "opened, not signed" or "not opened". */
  pill: string
  sub: string
  snippet: string
  /** The pill's hover. */
  why: string
  /** The portal write the row opens the thread at. */
  landOnId?: string
  /** Every paper waiting on them, the oldest first. */
  papers: PortalPaperLine[]
  /** What else the row carries after its lead: "and 1 more paper not signed". Null when nothing does. */
  more: string | null
}

export type NeedsYouRow = BackRow | PortalRow

/** A team note that carries a day to come back, as a date or as words. */
function hasBackDay(m: QueueMessage): boolean {
  return m.channel === 'note' && !!(m.backOn || m.backWords?.trim())
}

/**
 * Each person's standing note: their newest note that carries a day to come back. A newer note with a day replaces an
 * older one, as the prototype's one `c.back` per person does, so Follow up has one note row per person. Once *Done with
 * it* clears it, nothing older comes back.
 */
function standingNotes(messages: ReadonlyArray<QueueMessage>): Map<string, QueueMessage> {
  const out = new Map<string, QueueMessage>()
  for (const m of messages) {
    if (!hasBackDay(m)) continue
    const best = out.get(m.contactId)
    if (!best || byTime(m, best) > 0) out.set(m.contactId, m)
  }
  return out
}

/** The note whose day stands for this person, for the thread's pill. Null once it is dealt with, or with none. */
export function standingBackNote(messages: ReadonlyArray<QueueMessage>, contactId: string): QueueMessage | null {
  const note = standingNotes(messages.filter((m) => m.contactId === contactId)).get(contactId)
  return note && !note.backDoneAt ? note : null
}

/**
 * The notes whose day has come, one per person, oldest day first. A note with only words for a day has no morning to
 * come back on.
 */
export function backToday(messages: ReadonlyArray<QueueMessage>, todayYmd: string): BackRow[] {
  return [...standingNotes(messages).values()]
    .filter((m) => m.backOn && m.backOn <= todayYmd && !m.backDoneAt)
    .sort((a, b) => a.backOn!.localeCompare(b.backOn!) || byTime(a, b))
    .map((m) => ({
      kind: 'back' as const,
      contactId: m.contactId,
      noteId: m.id,
      pill: m.backOn === todayYmd ? 'back today' : `back since ${dayLabel(m.backOn!)}`,
      noteBy: `the note by ${m.backBy || 'the team'}, ${dayLabel(m.backOn!)}`,
      note: m.body,
      dayYmd: m.backOn!,
    }))
}

/** "Fri Oct 2 9:14 AM": a day and a time in the app's zone. */
function dayAndTime(iso: string): string {
  return `${dayLabel(calendarYmdInAppTzFromIso(iso))} ${formatDenverTimeOnly(Date.parse(iso)).replace(/\u202f/g, ' ')}`
}

/** The papers waiting on one customer: to sign, unanswered two days or more, the oldest first. */
function papersWaiting(papers: ReadonlyArray<CustomerPaper>, contactId: string, todayYmd: string): PortalPaperLine[] {
  const lines: PortalPaperLine[] = []
  for (const { contactId: id, paper } of papers) {
    if (id !== contactId || paper.answered || paper.kind === 'payApp') continue
    const sentYmd = calendarYmdInAppTzFromIso(paper.sentAt)
    const days = ymdDaysBetween(sentYmd, todayYmd) ?? 0
    if (days < PORTAL_PAPER_DAYS) continue
    const name = `${paper.title}${paper.detail ? ` · ${paper.detail}` : ''}`
    const openedYmd = paper.viewedAt ? calendarYmdInAppTzFromIso(paper.viewedAt) : null
    const sent = `sent ${dayLabel(sentYmd)}, ${days} days`
    lines.push({ id: paper.id, name, sentYmd, days, openedYmd, label: `${name} · ${sent} · ${openedYmd ? 'opened, not signed' : 'not opened'}` })
  }
  return lines.sort((a, b) => a.sentYmd.localeCompare(b.sentYmd) || a.name.localeCompare(b.name))
}

/** "and 1 more paper not signed", "and 2 papers not signed". */
function morePapers(n: number, afterAPaper: boolean): string | null {
  if (n <= 0) return null
  return `and ${n}${afterAPaper ? ' more' : ''} paper${n === 1 ? '' : 's'} not signed`
}

/**
 * The portal's Needs you rows, one per customer: one who wrote on their page and is waiting on us, and the papers to
 * sign sent through the page that sat unanswered two days or more, opened or not. A pay application is paid, not
 * signed, so it has no row here. A paper on each of two jobs is one row, never one per job. The prototype's write row
 * tested a state no contact has, so it never showed; it reads the open state here.
 */
export function portalNeeds(
  contacts: ReadonlyArray<QueueContact>,
  messages: ReadonlyArray<QueueMessage>,
  papers: ReadonlyArray<CustomerPaper>,
  todayYmd: string,
): PortalRow[] {
  const rows: PortalRow[] = []
  const newest = newestIn(messages)
  for (const c of contacts) {
    if (c.kind !== 'customer') continue
    const last = newest.get(c.id)
    const wrote = last?.channel === 'portal' && stateToday(c, todayYmd) === 'waiting' ? last : null
    const waiting = papersWaiting(papers, c.id, todayYmd)
    if (wrote) {
      rows.push({
        kind: 'portal',
        contactId: c.id,
        pill: 'wrote in the portal',
        sub: `${dayAndTime(wrote.at)} · lands here like a text`,
        snippet: wrote.body,
        why: 'A customer who writes on the page is a customer who wrote. The row reads the same as a text. The reply goes by text or email.',
        landOnId: wrote.id,
        papers: waiting,
        more: morePapers(waiting.length, false),
      })
      continue
    }
    const lead = waiting[0]
    if (!lead) continue
    const first = firstName(c) || 'They'
    rows.push({
      kind: 'portal',
      contactId: c.id,
      pill: lead.openedYmd ? 'opened, not signed' : 'not opened',
      sub: `${lead.name} · sent ${dayLabel(lead.sentYmd)}, ${lead.days} days`,
      snippet: lead.openedYmd
        ? `${first} opened it ${dayLabel(lead.openedYmd)} and did not sign. A call beats a reminder.`
        : `${first} has not opened it. A text with the link, or a call.`,
      why: 'A paper opened and left is a different nudge than one never opened. The row says which.',
      papers: waiting,
      more: morePapers(waiting.length - 1, true),
    })
  }
  return rows
}

/**
 * Whether a portal row already shows a step's paper, in the shape `flows/nudges.ts` asks it (`NudgeOptions.skip`): the
 * person, the paper's kind, and the open round's key, which for a change order is its `gc_change_orders` row id, the
 * same id as `PaperView.id`. The kind alone cannot tell change order 1 from change order 2, so the key decides.
 */
export type OnPortal = (contactId: string, paper: string, key: string | null) => boolean

/**
 * The papers the portal rows show, as the question the nudges and the step card ask: a paper with a portal row
 * (opened and left, or not opened) is never nudged as well, so the queue never shows the same paper twice (the lead,
 * 2026-10-12).
 */
export function onPortal(rows: ReadonlyArray<PortalRow>): OnPortal {
  const shown = new Map<string, Set<string>>()
  for (const r of rows) for (const p of r.papers) (shown.get(r.contactId) ?? shown.set(r.contactId, new Set()).get(r.contactId)!).add(p.id)
  return (contactId, _paper, key) => key !== null && (shown.get(contactId)?.has(key) ?? false)
}

/** One row of We owe them. */
export interface OwedRow {
  contactId: string
  owed: Owed
  /** "we owe the start date · by Mon Oct 5". */
  pill: string
  /** Its day has gone by. */
  late: boolean
}

/** Each person's open record: one per person, the newest marked when more than one is open. */
function openByPerson(owed: ReadonlyArray<OwedRecord>): OwedRecord[] {
  const out = new Map<string, OwedRecord>()
  for (const o of owed) {
    if (o.doneAt) continue
    const best = out.get(o.contactId)
    if (!best || Date.parse(o.markedAt) > Date.parse(best.markedAt)) out.set(o.contactId, o)
  }
  return [...out.values()]
}

/**
 * We owe them, one row per person: the soonest day first, the ones with no date after them by when they were marked.
 * `contact_owed` keeps one open row per person; the newest marked stands if the table ever holds two.
 */
export function weOwe(owed: ReadonlyArray<OwedRecord>, todayYmd: string): OwedRow[] {
  return openByPerson(owed)
    .sort((a, b) => {
      if (a.byYmd && b.byYmd) return a.byYmd.localeCompare(b.byYmd) || Date.parse(a.markedAt) - Date.parse(b.markedAt)
      if (a.byYmd || b.byYmd) return a.byYmd ? -1 : 1
      return Date.parse(a.markedAt) - Date.parse(b.markedAt)
    })
    .map((o) => {
      const owed: Owed = { what: o.what, byYmd: o.byYmd, byWords: o.byWords, markedBy: o.markedBy, markedAt: o.markedAt }
      return { contactId: o.contactId, owed, pill: owedPill(owed), late: !!o.byYmd && o.byYmd < todayYmd }
    })
}

/** Everything Follow up reads, from the rows the app keeps. */
export interface FollowUpInput {
  contacts: ReadonlyArray<QueueContact>
  messages: ReadonlyArray<QueueMessage>
  heard?: ReadonlyArray<HeardLine>
  owed?: ReadonlyArray<OwedRecord>
  /** The calls to make (v2.5596), drawn in We owe them. */
  calls?: ReadonlyArray<CallTaskRecord>
  portalPapers?: ReadonlyArray<CustomerPaper>
  todayYmd: string
}

/**
 * The queue as the Follow up tab draws it. `C` is a clause waiting on approval (`contracts/approval.ts`); `N` is a
 * nudge row (`flows/nudges.ts` → `NudgeRow`), already one per person and in its order.
 */
export interface FollowUpQueue<C = never, N extends { contactId: string } = never> {
  /** What came in and still needs sorting (residential R7), drawn first. Its people are not in Needs a reply. */
  newLane: NewLaneRow[]
  needsYou: NeedsYouRow[]
  /** Clause edits waiting on this person's approval, drawn in Needs you after the notes. */
  clauses: C[]
  needsReply: NeedsReplyRow[]
  weOwe: OwedRow[]
  /** The calls to make (v2.5596), drawn in We owe them after what we owe, soonest first. */
  calls: CallTaskRow[]
  /** Nudges from the flow, after We owe them, as `nudgeRows` returns them. */
  nudges: N[]
  /** The papers the portal rows show, for the step card's options (`flows/card.ts`), so the card agrees with the queue. */
  onPortal: OnPortal
  /**
   * The badge: each person once across New, Needs you, Needs a reply and We owe them, as `follow_up_count` and the
   * Dashboard's line count them. New holds only people Needs a reply would, so it adds nobody to the count. A clause waiting on approval counts in Needs you's heading only, since the Dashboard gives the
   * clauses a line of their own (the lead, 2026-10-12).
   */
  count: number
}

/**
 * What other kernels hand the queue to draw as they made it: the clause rows, and the nudge rows. The nudges come as a
 * builder that is told which papers the portal rows show (`flows/nudges.ts` → `nudgeRows(people, now, { skip })`), so
 * a paper on a portal row stays out of its nudge row before that row's line is written.
 */
export interface FollowUpPassThrough<C, N extends { contactId: string }> {
  clauses?: ReadonlyArray<C>
  nudges?: (skip: OnPortal) => ReadonlyArray<N>
  /**
   * The New lane's rows (`newLane.ts`), built for the people Needs a reply holds, since the lane sorts what came in
   * before anyone answers it. A row for anyone else is dropped.
   */
  newLane?: (people: ReadonlySet<string>) => ReadonlyArray<NewLaneRow>
}

/**
 * The input with everyone `OFF_FOLLOW_UP` left out: the people, and every message, record and paper of theirs, so no
 * section and no count can reach them.
 */
function onlyOnFollowUp(input: FollowUpInput): { input: FollowUpInput; on: (row: { contactId: string }) => boolean } {
  const off = new Set(input.contacts.filter((c) => !onFollowUp(c.kind)).map((c) => c.id))
  const on = (row: { contactId: string }) => !off.has(row.contactId)
  if (off.size === 0) return { input, on }
  return {
    input: {
      ...input,
      contacts: input.contacts.filter((c) => !off.has(c.id)),
      messages: input.messages.filter(on),
      heard: input.heard?.filter(on),
      owed: input.owed?.filter(on),
      portalPapers: input.portalPapers?.filter(on),
    },
    on,
  }
}

export function followUpQueue<C = never, N extends { contactId: string } = never>(
  all: FollowUpInput,
  passThrough: FollowUpPassThrough<C, N> = {},
): FollowUpQueue<C, N> {
  const { input, on } = onlyOnFollowUp(all)
  const portal = portalNeeds(input.contacts, input.messages, input.portalPapers ?? [], input.todayYmd)
  const needsYou: NeedsYouRow[] = [...backToday(input.messages, input.todayYmd), ...portal]
  const waiting = needsReply(input.contacts, input.messages, input.heard ?? [], input.todayYmd)
  const replying = new Set(waiting.map((r) => r.contactId))
  const newLane = (passThrough.newLane?.(replying) ?? []).filter((r) => replying.has(r.contactId))
  const sorting = new Set(newLane.map((r) => r.contactId))
  const reply = waiting.filter((r) => !sorting.has(r.contactId))
  const owing = weOwe(input.owed ?? [], input.todayYmd)
  const calls = callRows(all.calls ?? [], input.todayYmd).filter(on)
  const clauses = [...(passThrough.clauses ?? [])]
  const shows = onPortal(portal)
  const nudges = (passThrough.nudges?.(shows) ?? []).filter(on)
  const people = new Set<string>([...newLane, ...needsYou, ...reply, ...owing, ...calls].map((r) => r.contactId))
  return { newLane, needsYou, clauses, needsReply: reply, weOwe: owing, calls, nudges, onPortal: shows, count: people.size }
}

/** The Needs you heading's count: every row, as the prototype counts them. */
export function needsYouCount(queue: Pick<FollowUpQueue<unknown, { contactId: string }>, 'needsYou' | 'clauses'>): number {
  return queue.needsYou.length + queue.clauses.length
}

/** What a note's day says on the thread: "↩ back Fri Oct 2", or the words with no day. */
export function backPill(note: Pick<QueueMessage, 'backOn' | 'backWords'>): string | null {
  if (note.backOn) return `↩ back ${dayLabel(note.backOn)}`
  const words = note.backWords?.trim()
  return words ? `↩ back ${words} · no day` : null
}

/**
 * The sentence a note's day adds to the box's toast after a note goes (`messages/compose.ts` → `sentWords` says the
 * note was added): when it comes back, or that words with no day never bring it back. Null for a note with no day.
 */
export function noteBackToast(back: DayKept | null): string | null {
  if (back?.ymd) return `It comes back to Follow up ${dayLabel(back.ymd)}.`
  if (back?.words) return 'It has no day, so it will not come back.'
  return null
}

/** The reply box's press beside *Add the note* that opens a note's day to come back (`NoteBackDay`). */
export const NOTE_BACK_PRESS = '↩ Bring it back on a day…'

/** Its hover: what a day does, and that it is optional. */
export const NOTE_BACK_TIP = 'Adds a day to this note. The row comes back to Follow up that morning, under Needs you, with the note on it. Without a day, the note just closes the row.'

/** *Another day* on a note brought back: the next working day, and what the office reads. */
export function anotherDay(todayYmd: string): { backOn: string; toast: string } {
  const backOn = nextWorkday(todayYmd)
  return { backOn, toast: `Comes back ${dayLabel(backOn)}.` }
}

/** What the office reads after *Done with it*. */
export const BACK_CLEARED_TOAST = 'Cleared. The note stays in the thread.'

/** What moves the state: their message, our reply, a team note, or a press in the row or the ⋯. */
export type StateMove = 'inbound' | 'reply' | 'note' | 'noReplyNeeded' | 'remindMonday' | 'reopen'

/** The state a move leaves, and whether it puts the conversation back for whoever answers first. */
export interface StateAfter {
  state: ContactState
  snoozedUntil: string | null
  clearHas: boolean
}

/**
 * The state a move leaves. Their message opens it, from Done or Snoozed. Our reply, a team note and *No reply needed*
 * close it and clear who has it: whoever writes the note has looked. *Remind me Monday* snoozes it to the coming
 * Monday and keeps who has it.
 */
export function stateAfter(move: StateMove, todayYmd: string): StateAfter {
  if (move === 'inbound' || move === 'reopen') return { state: 'waiting', snoozedUntil: null, clearHas: false }
  if (move === 'remindMonday') return { state: 'snoozed', snoozedUntil: nextMonday(todayYmd), clearHas: false }
  return { state: 'done', snoozedUntil: null, clearHas: true }
}

/** The move a new message makes: theirs opens, ours closes, a note closes; an event line moves nothing. */
export function stateMoveOf(message: Pick<QueueMessage, 'channel' | 'direction'>): StateMove | null {
  if (message.channel === 'event') return null
  if (message.direction === 'in') return 'inbound'
  if (message.direction === 'out') return 'reply'
  return message.channel === 'note' ? 'note' : null
}

/** What the office reads after a press moves the state. `name` is the person's full name. */
export function stateToast(move: StateMove, name: string): string | null {
  if (move === 'noReplyNeeded') return `${name} cleared from Follow up.`
  if (move === 'reopen') return `${name} is back in Follow up.`
  if (move === 'remindMonday') return `${name} comes back to Follow up on Monday.`
  return null
}

/** The thread's ⋯ rows for the state (v1.146): close or snooze an open row, reopen any other. */
export function stateMenu(state: ContactState): Array<{ move: StateMove; label: string; words: string }> {
  if (state === 'waiting')
    return [
      { move: 'noReplyNeeded', label: 'No reply needed', words: 'Takes the row off Follow up. Nothing is owed.' },
      { move: 'remindMonday', label: 'Remind me Monday', words: 'Out of Follow up until Monday morning.' },
    ]
  return [{ move: 'reopen', label: 'Reopen', words: 'Puts the row back on Follow up as waiting on us.' }]
}

/** How someone came to have it, as `contacts.has_how` keeps it. */
export type HasHow = 'took' | 'rule' | 'handed'

/** How a press in the who-has-it picker came to give it: taken by me, or handed to someone. */
export function hasHow(me: string, to: string | null): HasHow | null {
  if (!to) return null
  return to === me ? 'took' : 'handed'
}

/**
 * The gray event line a take or a hand-off writes, the way Intercom records an assignment. `name` is the person's
 * full name. Null when nothing changed.
 */
export function hasLine(me: string, name: string, before: string | null, after: string | null): string | null {
  if ((before || null) === (after || null)) return null
  if (!after) return `${me} put ${name} back for whoever answers first.`
  if (after === me) return before ? `${me} took ${name} from ${before}.` : `${me} took ${name}.`
  return before ? `${me} handed ${name} to ${after}.` : `${me} gave ${name} to ${after}.`
}

/** What the office reads after the picker. */
export function hasToast(me: string, name: string, after: string | null): string {
  if (!after) return 'Nobody has it.'
  return after === me ? `You have ${name}.` : `${after} has ${name}.`
}

/** The pill on the thread and on a Follow up row. */
export function hasPillWords(me: string, has: string | null | undefined): string {
  if (!has) return 'Nobody has it · Take it'
  return has === me ? 'You have this' : `${has} has this`
}

/** Since when, on the pill's hover (v1.90): "Since last Saturday, Sat Sep 26, 2:30 PM." */
export function hasSinceWords(when: string, exact: string): string {
  if (when.startsWith('today at ')) return `Since ${when}.`
  return `Since ${when.replace(/^on /, '')}, ${exact}.`
}

/** The picker's head line. */
export function whoPickerHead(me: string, name: string, has: string | null | undefined, since?: string | null): string {
  if (!has) return `Nobody has ${name} yet. Hand it to:`
  return `${has === me ? 'You have' : `${has} has`} ${name}${since ? ` since ${since}` : ''}. Hand it to:`
}

/** *I'll take it*'s second line. */
export function takeItWords(has: string | null | undefined): string {
  return has ? `${has} sees it move to you. The thread says so.` : 'So nobody else answers it too.'
}

/** How many open conversations a teammate has, on their picker row. */
export function holdCount(contacts: ReadonlyArray<QueueContact>, teammate: string, todayYmd: string): number {
  return contacts.filter((c) => c.has === teammate && stateToday(c, todayYmd) === 'waiting').length
}

// The rule and its seats live in `assignSeats.ts`, light enough for the edge copy (R5's push). They are the queue's too.
export { whoGetsIt, type AssignSeats } from './assignSeats'

/** The day *Remind me Monday* sets, as the thread's pill says it: "snoozed until Mon Oct 5". */
export function snoozedWords(contact: Pick<QueueContact, 'state' | 'snoozedUntil'>): string | null {
  if (contact.state !== 'snoozed') return null
  return contact.snoozedUntil ? `snoozed until ${dayLabel(contact.snoozedUntil)}` : 'snoozed'
}

/** What we owe, for the row's pill and the move line, from the open record; null when nothing is owed. */
export function openOwed(owed: ReadonlyArray<OwedRecord>, contactId: string): Owed | null {
  const row = openByPerson(owed.filter((o) => o.contactId === contactId))[0]
  if (!row) return null
  return { what: row.what, byYmd: row.byYmd, byWords: row.byWords, markedBy: row.markedBy, markedAt: row.markedAt }
}
