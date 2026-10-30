/**
 * Quickfill → Texts, the read (v2.5816, punch list #157): the ledger from the reads Messages already makes. Follow
 * up's queue through `loadQueue`, built as the page builds it (`followUpInputFromRows`, `followUpQueue` with the New
 * lane, the way `customerCountsIo.ts` does for the Customers line), Went out's lines through `loadWentOut`, and, for
 * the quiet line, how many texts the app prepared wait on Today's sends (`offers`). No new fetch shape: the station
 * can never disagree with the page. The hook imports this file on demand, after first paint.
 */
import { supabaseFollowUpIo, type FollowUpIo } from '../followUp/followUpIo'
import { followUpInputFromRows, followUpNewLane } from '../followUp/followUpRows'
import { followUpQueue } from '../followUp/queue'
import { loadWentOut } from '../messages/wentOutIo'
import type { WentOutLine } from '../messages/wentOut'
import { todaysSends } from '../offers/offers'
import { supabaseOffersIo } from '../offers/offersIo'
import { textsLedger, type LedgerContact, type LedgerLine, type TextsLedger } from './textsLedger'

export interface TextsLedgerReads {
  queue?: Pick<FollowUpIo, 'loadQueue'>
  wentOut?: (now: Date) => Promise<WentOutLine[]>
  /** How many texts wait on Today's sends; a failure reads as none. */
  todaysSends?: () => Promise<number>
}

export interface TextsLedgerRead {
  ledger: TextsLedger
  /** Texts the app prepared that wait on Today's sends; pointed at, never counted here. */
  todaysSends: number
}

async function countTodaysSends(): Promise<number> {
  return todaysSends(await supabaseOffersIo().loadOpen()).length
}

/** Follow up's queue built as the page builds it, with the lines by id and the contacts as the ledger names them (v2.6098: one read serves the Messages station and its Texts fold). */
export function queueFromRows(rows: Awaited<ReturnType<FollowUpIo['loadQueue']>>, todayYmd: string, nowIso: string): { queue: ReturnType<typeof followUpQueue>; lines: Map<string, LedgerLine>; contacts: LedgerContact[] } {
  const input = followUpInputFromRows(rows, todayYmd, {})
  const queue = followUpQueue(input, { newLane: followUpNewLane(input, rows.jobStates ?? {}, nowIso) })
  const lines = new Map<string, LedgerLine>()
  for (const m of input.messages) {
    if (m.direction !== 'in' && m.direction !== 'out') continue
    lines.set(m.id, { id: m.id, contactId: m.contactId, channel: m.channel, direction: m.direction, body: m.body, at: m.at })
  }
  const contacts: LedgerContact[] = input.contacts.map((c) => ({ id: c.id, name: c.name, kind: c.kind, company: c.company, phone: c.phone ?? null }))
  return { queue, lines, contacts }
}

/** The three reads behind the ledger, made together; the sends fail soft to none. */
export async function readTextsLedgerSources(todayYmd: string, now: Date, reads: TextsLedgerReads = {}): Promise<{ rows: Awaited<ReturnType<FollowUpIo['loadQueue']>>; wentOut: WentOutLine[]; sends: number }> {
  const queueIo = reads.queue ?? supabaseFollowUpIo()
  const readWentOut = reads.wentOut ?? loadWentOut
  const readSends = reads.todaysSends ?? countTodaysSends
  const [rows, wentOut, sends] = await Promise.all([queueIo.loadQueue(todayYmd), readWentOut(now), readSends().catch(() => 0)])
  return { rows, wentOut, sends }
}

export async function loadTextsLedger(todayYmd: string, now: Date = new Date(), reads: TextsLedgerReads = {}): Promise<TextsLedgerRead> {
  const { rows, wentOut, sends } = await readTextsLedgerSources(todayYmd, now, reads)
  const { queue, lines, contacts } = queueFromRows(rows, todayYmd, now.toISOString())
  const ledger = textsLedger({ needsReply: queue.needsReply, newLane: queue.newLane, lines, contacts, wentOut, todayYmd, nowMs: now.getTime() })
  return { ledger, todaysSends: sends }
}
