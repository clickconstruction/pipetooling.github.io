/**
 * Messages, cut 2's screens, PR C2: what cut 2 tells the move line (`courtOf`'s `CourtOptions` in `messages/thread.ts`),
 * so the Messages list and the thread window say one thing (the lead, 2026-10-12): what we owe, from the open
 * `contact_owed` row, and the day a written promise runs until, from `message_promises`. One map for the list, by
 * person; the window reads the same facts for the open person.
 */
import type { CourtOptions } from '../messages/thread'
import { owedForMove } from '../messages/owed'
import { runningPromise } from '../messages/promises'
import { heardLinesFromRows, owedRecordsFromRows, type ContactOwedRow, type MessagePromiseRow } from './followUpRows'
import { openOwed } from './queue'

/** What cut 2 adds to one person's move line. */
export type CourtFacts = Pick<CourtOptions, 'owed' | 'promisedUntil'>

/**
 * The facts by person: what we owe (the newest open record) and the running promise's day (`runningPromise`). A person
 * with neither is left out, so the list reads them as before.
 */
export function courtFactsFromRows(owedRows: readonly ContactOwedRow[], promiseRows: readonly MessagePromiseRow[], todayYmd: string): Map<string, CourtFacts> {
  const owed = owedRecordsFromRows(owedRows, {})
  const lines = heardLinesFromRows(promiseRows)
  const people = new Set<string>([...owed.filter((o) => !o.doneAt).map((o) => o.contactId), ...lines.map((l) => l.contactId)])
  const out = new Map<string, CourtFacts>()
  for (const id of people) {
    const open = openOwed(owed, id)
    const promise = runningPromise(lines, id, todayYmd)
    if (!open && !promise) continue
    out.set(id, { ...(open ? { owed: owedForMove(open) } : {}), ...(promise ? { promisedUntil: promise.until } : {}) })
  }
  return out
}
