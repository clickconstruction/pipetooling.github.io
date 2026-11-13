/**
 * Done with no reply this week (v2.7030, punch list #324 PR 4): the fold under Follow up's lanes that says where a
 * closed conversation went. Every lane on Messages means something waits, so a thread closed with **No reply needed**
 * left them all, and the only way back was to search *Everyone we have talked with*. The dev looked at the lanes on
 * 2026-11-12 and concluded a thread could not be closed.
 *
 * Built like New's *notices set aside this week* (`setAsideFold.ts`): a fold, shut until pressed, with a count and one
 * press a row. Two kinds of row, one per person, the newer fact winning: a person the office closed with the press
 * (the grey line `noReply.ts` writes), and a person whose old mail was filed for the record this week and asked nobody
 * (`messages.history`). Only people whose conversation is Done today are read. **Reopen** puts the row back on Follow
 * up, and takes the mark off filed mail (`set_state`). It is not a lane: no segment on the bar, nothing on the badge.
 * Pure; the read is `doneFoldIo.ts`, the fold `components/followUp/DoneFold.tsx`.
 */
import { whenWords } from '../messages/thread'
import { noReplyOf } from './noReply'

/** How far back the fold reads. */
export const DONE_FOLD_DAYS = 7

export const REOPEN = 'Reopen'

/** A grey line a No reply needed press wrote, with whose thread it is on. */
export interface DoneSaidRow {
  contactId: string
  /** The person's name, else their number or address, else null. */
  name: string | null
  body: string
  at: string
}

/** One mail of theirs filed for the record, with whose thread it is on and when it landed. */
export interface DoneFiledRow {
  contactId: string
  name: string | null
  landedAt: string
}

export interface DoneFoldLine {
  contactId: string
  who: string
  how: 'noReply' | 'filed'
  /** "No reply needed · Rosa, on Tuesday", or "Old mail filed on Monday · 6 mails". */
  words: string
  /** The row's hover. */
  why: string
}

/** "3 done with no reply this week", "1 done with no reply this week". */
export function doneFoldTitle(count: number): string {
  return `${count} done with no reply this week`
}

/** What Reopen says once it lands. `name` is the person's name, or their number or address. */
export function reopenedWords(name: string): string {
  return `${name} is back in Follow up.`
}

export const DONE_FOLD_WHY = {
  noReply: 'Someone on the team closed it with No reply needed. Reopen puts it back on Follow up.',
  filed: 'Old mail, filed for the record. It asked nobody for a reply. Reopen puts it on Follow up.',
} as const

const UNNAMED = 'A sender nobody has named'

/**
 * The fold's rows, newest first, one per person. A press closed them, or old mail of theirs was filed, whichever came
 * later. A grey line that is not the press's own is skipped.
 */
export function doneFoldLines(said: readonly DoneSaidRow[], filed: readonly DoneFiledRow[], nowIso: string): DoneFoldLine[] {
  const best = new Map<string, { atMs: number; line: DoneFoldLine }>()
  const put = (contactId: string, atMs: number, line: DoneFoldLine) => {
    const have = best.get(contactId)
    if (!have || atMs > have.atMs) best.set(contactId, { atMs, line })
  }
  for (const row of said) {
    const read = noReplyOf(row.body)
    if (!read) continue
    put(row.contactId, Date.parse(row.at), {
      contactId: row.contactId,
      who: row.name?.trim() || UNNAMED,
      how: 'noReply',
      words: `No reply needed · ${read.who}, ${whenWords(row.at, nowIso)}`,
      why: DONE_FOLD_WHY.noReply,
    })
  }
  const mails = new Map<string, { count: number; newest: string; name: string | null }>()
  for (const row of filed) {
    const have = mails.get(row.contactId)
    if (!have) mails.set(row.contactId, { count: 1, newest: row.landedAt, name: row.name })
    else {
      have.count += 1
      if (row.landedAt > have.newest) have.newest = row.landedAt
    }
  }
  for (const [contactId, m] of mails) {
    put(contactId, Date.parse(m.newest), {
      contactId,
      who: m.name?.trim() || UNNAMED,
      how: 'filed',
      words: `Old mail filed ${whenWords(m.newest, nowIso)} · ${m.count} ${m.count === 1 ? 'mail' : 'mails'}`,
      why: DONE_FOLD_WHY.filed,
    })
  }
  return [...best.values()].sort((a, b) => b.atMs - a.atMs || a.line.who.localeCompare(b.line.who)).map((b) => b.line)
}
