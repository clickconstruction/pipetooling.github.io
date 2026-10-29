/**
 * Quickfill → Messages, the read (v2.6098, punch list #178): one read of Follow up's queue through `loadQueue`,
 * built as the page builds it, serves the station's lanes and the Texts ledger folded under them, so Quickfill reads
 * the queue once where v2.5816 and the Customers line read it twice. Went out's lines and Today's sends come with it
 * as the ledger always read them. No new fetch shape: the station can never disagree with the page.
 */
import { queueFromRows, readTextsLedgerSources, type TextsLedgerReads } from './textsLedgerIo'
import { textsLedger, type TextsLedger } from './textsLedger'
import { messagesStation, type MessagesStation } from './messagesStation'

export interface MessagesStationRead {
  station: MessagesStation
  ledger: TextsLedger
  /** Texts the app prepared that wait on Today's sends; the ledger's quiet line points at them. */
  todaysSends: number
}

export async function loadMessagesStation(todayYmd: string, now: Date = new Date(), reads: TextsLedgerReads = {}): Promise<MessagesStationRead> {
  const { rows, wentOut, sends } = await readTextsLedgerSources(todayYmd, now, reads)
  const nowMs = now.getTime()
  const { queue, lines, contacts } = queueFromRows(rows, todayYmd, now.toISOString())
  const ledger = textsLedger({ needsReply: queue.needsReply, newLane: queue.newLane, lines, contacts, wentOut, todayYmd, nowMs })
  const station = messagesStation({ queue, contacts, lines, nowMs })
  return { station, ledger, todaysSends: sends }
}
