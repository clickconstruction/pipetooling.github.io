/**
 * Cut 2's data on the Messages prototype's demo people (v1.178, `to-dos/gc-mode/messages/prototype.html` on
 * spike/gc-mode): who has each conversation and its state, what we owe, the days heard and the portal's paper. The
 * people, their jobs and their twenty messages are the spine's shared fixture (`messages/messagesDemo.ts`); this file
 * adds only what Follow up keeps. Nothing here is a real row.
 */
import { DEMO_CONTACTS, DEMO_JOBS, DEMO_MESSAGES, DEMO_NOW } from '../messages/messagesDemo'
import type { HeardLine } from '../messages/promises'
import type { CustomerPaper, OwedRecord, QueueContact, QueueMessage } from './queue'

export { DEMO_NOW }

/** The prototype's day: Fri Oct 2 2026. */
export const DEMO_TODAY = '2026-10-02'

/** Who is signed in: the estimator. */
export const DEMO_ME = 'Robert'

/** The six jobs' names, by the prototype's ids. */
export const DEMO_JOB_NAMES: Readonly<Record<string, string>> = Object.fromEntries(DEMO_JOBS.map((j) => [j.id, j.name]))

/** Each conversation's state and who has it, as the prototype opens. */
const FOLLOW_UP_STATE: Readonly<Record<string, Pick<QueueContact, 'state' | 'has'>>> = {
  greg: { state: 'waiting', has: null },
  elena: { state: 'waiting', has: null },
  priya: { state: 'waiting', has: 'Rosa' },
  bill: { state: 'done', has: null },
  tom: { state: 'done', has: null },
  jonah: { state: 'done', has: null },
  marcus: { state: 'done', has: null },
  unk1: { state: 'waiting', has: null },
}

/** The eight people, with the conversation's state and who has it. */
export const DEMO_FOLLOW_UP_CONTACTS: ReadonlyArray<QueueContact & { trade?: string }> = DEMO_CONTACTS.map((c) => ({ ...c, ...FOLLOW_UP_STATE[c.id]! }))

/** The twenty messages, as Follow up reads them. */
export const DEMO_FOLLOW_UP_MESSAGES: ReadonlyArray<QueueMessage> = DEMO_MESSAGES

/** When Rosa took Priya, and when she marked what we owe her: Sat Sep 26, 2:30 PM. */
export const DEMO_PRIYA_SINCE = '2026-09-26T19:30:00.000Z'

/** A message's time, by its id. */
const atOf = (id: string): string => DEMO_MESSAGES.find((m) => m.id === id)!.at

/** What the lines were read as: Greg's two days and his plans question, Elena's check. */
export const DEMO_HEARD: ReadonlyArray<HeardLine> = [
  { messageId: '1', contactId: 'greg', at: atOf('1'), kind: 'quote', state: 'written', dayYmd: '2026-09-30' },
  { messageId: '3', contactId: 'greg', at: atOf('3'), kind: null, state: 'offered', dayYmd: '2026-10-07' },
  { messageId: '4', contactId: 'greg', at: atOf('4'), kind: 'question', state: 'offered' },
  { messageId: '15', contactId: 'elena', at: atOf('15'), kind: null, state: 'offered', dayYmd: '2026-10-09' },
]

/** What we owe: Priya the start date by Mon Oct 5, marked by Rosa. */
export const DEMO_OWED: ReadonlyArray<OwedRecord> = [
  { contactId: 'priya', what: 'the start date', byYmd: '2026-10-05', byWords: null, markedBy: 'Rosa', markedAt: DEMO_PRIYA_SINCE },
]

/** Priya's change order 2, sent through her page Wed Sep 30 and not opened. */
export const DEMO_PORTAL_PAPERS: ReadonlyArray<CustomerPaper> = [
  {
    contactId: 'priya',
    paper: { id: 'co2', kind: 'changeOrder', title: 'Change order 2', detail: 'a sink in exam 3', sentAt: '2026-09-30T15:00:00.000Z', answered: false, viewedAt: null },
  },
]

/** The flows' our-move steps, with the words each carries as what we owe (Settings → Flows, v1.96). */
export const DEMO_OUR_STEPS = {
  customer: [
    { name: 'Our bid', owedWords: 'our bid' },
    { name: 'Start date', owedWords: 'the start date' },
    { name: 'On site', owedWords: 'the day we are on site' },
    { name: 'Closeout', owedWords: 'the closeout papers' },
    { name: 'Warranty', owedWords: 'the warranty papers' },
  ],
  trade: [
    { name: 'Invited', owedWords: 'the invitation' },
    { name: 'Compared', owedWords: 'our decision on their quote' },
  ],
  arch: [],
  unknown: [{ name: 'Who is this?' }],
} as const
