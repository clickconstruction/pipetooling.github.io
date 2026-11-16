/**
 * The run window's one count (v2.7477, punch list #362; the owner's ask of 2026-11-16 and his go on the drawing,
 * `to-dos/lien-to-do-one-run/run-window.html`: *"I think this run window is great for the notices … I like the run
 * window and think we can build it"*).
 *
 * The window counted one batch six ways on one screen. Its title, its checklist and the checklist's presses counted
 * notices; its journey and its print press counted envelopes; and each half had its own rule for what is held (the
 * journey split by the signature, the foot by the run's holds). Nobody could check one number against another.
 *
 * Here every number is a count of **notices**, and every notice is in exactly one part, in the same words wherever
 * the window says them:
 *
 * - **held**: the run cannot send it as it stands (no mailing address, an owner nobody confirmed, nothing to claim).
 * - **wait**: it waits on the leader's signature.
 * - **ready**: it can print now.
 * - **owe**: it printed, and an envelope it is in still owes its mail number.
 * - **record**: it printed and every envelope it is in has its number, so it can be recorded.
 *
 * Envelopes are named as envelopes, where the paper is: how many the ready notices print into, how many numbers are
 * typed. The journey is the run's three steps (get them right, print, mail and record), not the envelope's six, and
 * the foot has one press, for the step the run is on.
 *
 * Pure: the checklist's rows and the envelopes in, words out.
 */
import { countedLabel } from '../batchWords'
import type { LienRunRow } from './lienRunChecklist'
import type { RunEnvelope } from './runEnvelopes'

export type LienRunPartKey = 'held' | 'wait' | 'ready' | 'owe' | 'record'

type Row = Pick<LienRunRow, 'itemId' | 'held' | 'signed' | 'printed' | 'paperless' | 'mailed'>
type Envelope = Pick<RunEnvelope, 'key' | 'method' | 'tracking'> & { contents: ReadonlyArray<{ notice: { itemId: string }; recipient: { via?: string | null } }> }

/** The one part a notice is in. A hold comes first: an address can be fixed, a signature cannot lift it. */
export function lienRunPartOf(r: Row): LienRunPartKey {
  if (r.held) return 'held'
  if (r.signed === null) return 'wait'
  if (!r.printed && !r.paperless) return 'ready'
  return r.mailed ? 'record' : 'owe'
}

export type LienRunPart = { key: LienRunPartKey | 'printed'; n: number; words: string; tone: 'ready' | 'wait' | 'held' }

export type LienRunStep = 1 | 2 | 3

export type LienRunNode = { step: LienRunStep; label: string; count: string; state: 'done' | 'now' | 'todo' }

export type LienRunPress = {
  act: 'print' | 'record' | 'none'
  label: string
  dead: boolean
  /** The bold line beside the press: what it takes, and what stays. */
  line1: string
  /** The quiet line under it: what pressing does, or what to do first. */
  line2: string
}

export type LienRunParts = {
  /** Every notice in the run. */
  total: number
  counts: Record<LienRunPartKey, number>
  /** Which part each notice is in, by its item id, for the window's groups. */
  partOf: ReadonlyMap<string, LienRunPartKey>
  /** The step the run is on, or null once nothing is left in it. */
  step: LienRunStep | null
  nodes: LienRunNode[]
  /** *15 notices = 8 ready · 5 wait on Malachi's signature · 2 held*: the total's parts for the step the run is on. */
  line: { total: { n: number; words: string }; parts: LienRunPart[] }
  /** The paper envelopes: all of them, the ones the ready notices print into, and the numbers owed and typed for what printed. */
  envelopes: { total: number; forReady: number; numbersOwed: number; numbersTyped: number }
  press: LienRunPress
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const notices = (n: number) => `${n} ${plural(n, 'notice', 'notices')}`

/** An envelope that goes on paper and so carries a mail number: not an email copy, not one a mail service sends. */
function onPaper(e: Envelope): boolean {
  return e.method !== 'email' && !e.contents.some((c) => c.recipient.via === 'docsmit')
}

export function lienRunParts(rows: ReadonlyArray<Row>, envelopes: ReadonlyArray<Envelope>, opts: { leaderName?: string | null } = {}): LienRunParts {
  const leader = (opts.leaderName ?? '').trim() || 'the leader'
  const partOf = new Map<string, LienRunPartKey>()
  const counts: Record<LienRunPartKey, number> = { held: 0, wait: 0, ready: 0, owe: 0, record: 0 }
  for (const r of rows) {
    const part = lienRunPartOf(r)
    partOf.set(r.itemId, part)
    counts[part] += 1
  }
  const total = rows.length
  const printed = counts.owe + counts.record
  const stopped = counts.held + counts.wait

  const paper = envelopes.filter(onPaper)
  const holds = (e: Envelope, parts: ReadonlyArray<LienRunPartKey>) => e.contents.some((c) => parts.includes(partOf.get(c.notice.itemId) ?? 'held'))
  const forReady = paper.filter((e) => holds(e, ['ready'])).length
  const ofPrinted = paper.filter((e) => holds(e, ['owe', 'record']))
  const numbersTyped = ofPrinted.filter((e) => e.tracking.trim() !== '').length

  // The step the run is on. It opens on what stops a notice while nothing has printed, since a paper that needs
  // something needs it before the print; once everything left can print it is on the print; with nothing left to print
  // it is on the mail numbers.
  const step: LienRunStep | null = total === 0 ? null : counts.ready > 0 ? (stopped > 0 && printed === 0 ? 1 : 2) : printed > 0 ? 3 : 1
  const state = (n: LienRunStep): LienRunNode['state'] => (step == null ? 'todo' : n < step ? 'done' : n === step ? 'now' : 'todo')
  const right = total - stopped
  const nodes: LienRunNode[] = [
    { step: 1, label: 'Get them right', count: `${right} of ${total} ${step != null && step > 1 ? plural(right, 'was', 'were') : plural(right, 'is', 'are')} ready`, state: state(1) },
    { step: 2, label: 'Print', count: `${printed} of ${total} printed`, state: state(2) },
    { step: 3, label: 'Mail and record', count: step === 3 ? `${numbersTyped} of ${ofPrinted.length} ${plural(ofPrinted.length, 'number', 'numbers')} typed` : `${counts.record} of ${total} ready to record`, state: state(3) },
  ]

  const waitWords = `${plural(counts.wait, 'waits', 'wait')} on ${leader}’s signature`
  const stoppedParts: LienRunPart[] = [
    ...(counts.wait ? [{ key: 'wait' as const, n: counts.wait, words: waitWords, tone: 'wait' as const }] : []),
    ...(counts.held ? [{ key: 'held' as const, n: counts.held, words: 'held', tone: 'held' as const }] : []),
  ]
  const line: LienRunParts['line'] =
    step === 3
      ? {
          // On the mail numbers the count that matters is what printed: what can be recorded, and what still owes a number.
          total: { n: printed, words: 'printed' },
          parts: [
            ...(counts.record ? [{ key: 'record' as const, n: counts.record, words: 'ready to record', tone: 'ready' as const }] : []),
            ...(counts.owe ? [{ key: 'owe' as const, n: counts.owe, words: `${plural(counts.owe, 'owes', 'owe')} a number`, tone: 'held' as const }] : []),
          ],
        }
      : {
          total: { n: total, words: plural(total, 'notice', 'notices') },
          parts: [
            ...(counts.ready ? [{ key: 'ready' as const, n: counts.ready, words: 'ready', tone: 'ready' as const }] : []),
            ...(printed ? [{ key: 'printed' as const, n: printed, words: 'printed', tone: 'ready' as const }] : []),
            ...stoppedParts,
          ],
        }

  const stay = total - counts.ready
  let press: LienRunPress
  if (total === 0) press = { act: 'none', label: 'Nothing to send', dead: true, line1: 'Nothing is in this run.', line2: 'Approve a notice, or put one back in.' }
  else if (counts.ready > 0)
    press = {
      act: 'print',
      label: countedLabel('Print', counts.ready, 'notice'),
      dead: false,
      line1: `${counts.ready} can print now.${stay > 0 ? ` ${stay} ${plural(stay, 'stays', 'stay')} for the next packet.` : ''}`,
      line2: `The packet prints with its checklist sheet, in envelope order: ${forReady} ${plural(forReady, 'envelope', 'envelopes')}.`,
    }
  else if (counts.record > 0)
    press = {
      act: 'record',
      label: countedLabel('Record', counts.record, 'mailing'),
      dead: false,
      line1: `${counts.record} ${plural(counts.record, 'is', 'are')} ready to record.${counts.owe ? ` ${counts.owe} ${plural(counts.owe, 'stays', 'stay')} here until ${plural(counts.owe, 'its numbers are', 'their numbers are')} typed.` : ''}`,
      line2: 'Recording writes each notice to its job with how it went and every month it covered.',
    }
  else if (counts.owe > 0) {
    const owed = ofPrinted.length - numbersTyped
    press = { act: 'record', label: 'Record the mailing', dead: true, line1: `${owed} ${plural(owed, 'envelope owes', 'envelopes owe')} a number.`, line2: 'Type each from its green slip, or scan it with a phone.' }
  } else
    press = {
      act: 'print',
      label: countedLabel('Print', 0, 'notice'),
      dead: true,
      line1: 'Nothing can print yet.',
      line2: [counts.wait ? `${counts.wait} ${waitWords}.` : '', counts.held ? `${notices(counts.held)} ${plural(counts.held, 'is', 'are')} held, each with its reason.` : ''].filter(Boolean).join(' '),
    }

  return { total, counts, partOf, step, nodes, line, envelopes: { total: paper.length, forReady, numbersOwed: ofPrinted.length, numbersTyped }, press }
}

/** The window's second line: *30 copies in 16 envelopes · last day to mail Mon Nov 16*. `copies` is every recipient of every notice; '' with nothing in the run. */
export function lienRunSubLine(c: { copies: number; envelopes: number; mailByWords?: string | null }): string {
  if (c.copies <= 0) return ''
  const day = (c.mailByWords ?? '').trim()
  return `${c.copies} ${plural(c.copies, 'copy', 'copies')} in ${c.envelopes} ${plural(c.envelopes, 'envelope', 'envelopes')}${day ? ` · last day to mail ${day}` : ''}`
}

/** The groups the window draws its rows in, in this order; a group with no notice is not drawn. */
export const LIEN_RUN_GROUPS: ReadonlyArray<{ key: LienRunPartKey; head: (n: number, leader: string) => string; tone: 'ready' | 'wait' | 'held' }> = [
  { key: 'held', head: (n) => `Held · ${notices(n)}`, tone: 'held' },
  { key: 'wait', head: (n, leader) => `${plural(n, 'Waits', 'Wait')} on ${leader}’s signature · ${notices(n)}`, tone: 'wait' },
  { key: 'ready', head: (n) => `Ready · ${notices(n)}`, tone: 'ready' },
  { key: 'owe', head: (n) => `Printed · ${notices(n)} · ${plural(n, 'owes', 'owe')} a number`, tone: 'held' },
  { key: 'record', head: (n) => `Ready to record · ${notices(n)}`, tone: 'ready' },
]
