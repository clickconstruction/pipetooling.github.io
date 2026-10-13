/**
 * Messages, residential R8 · 1 (the app's own emails in the thread): every automatic send is a line marked the app,
 * folded by default and opened in place on a press, with the small print its sent copy carries. The lines themselves
 * are `sentLines.ts`'s, read from `sent_documents`; this file folds them and words their stamps. Lifted from the
 * Messages integrations mockups (branch spike/gc-mode, `to-dos/gc-mode/messages/customer-messages-integrations-mockups.html`
 * v0.2, card 1). Days are Chicago's, read through `utils/dateUtils`. Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { SentCopy } from '../sent/sentCopies'
import { clockTime, type ThreadMessage } from './thread'

/**
 * The who of a line the app sent with nobody pressing Send: a reminder, a scheduled notice, a bill a cron sent. A sent
 * copy is the app's when `sent_by` is null, which leaves `sent_by_name` empty. The flows' automatic texts fold with
 * them once they write this who.
 */
export const APP_WHO = 'the app'

/** Whether a line is the app's own. */
export function isAppLine(m: Pick<ThreadMessage, 'who'>): boolean {
  return m.who === APP_WHO
}

/**
 * A sent copy with the stamps its small print reads. `sent_documents` has none of the three: the loader fills them
 * from `email_send_log` (by `resend_email_id`) and from the payments of the invoice the copy's `source_table` and
 * `source_id` name. The kernel reads no table.
 */
export type SentCopyStamps = Pick<SentCopy, 'id'> & {
  /** The address it went from, `email_send_log.from_email`. Null: not known. */
  fromEmail: string | null
  /**
   * When it was opened: `email_send_log.last_event_at` while `last_event` is `opened` or `clicked`. Resend's webhook
   * keeps only the last event, so a later one overwrites the open. Null means not known, never unopened, and the
   * small print says nothing.
   */
  openedAt: string | null
  /** The bill it carried was paid: when, and how in the payment's own word ("card", "check"). Null: not a bill, or unpaid. */
  paid: { at: string; how: string } | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** A day in Chicago as the small print writes it: "Oct 10". */
function monthDay(iso: string): string {
  const ymd = calendarYmdInAppTzFromIso(iso)
  const [, m, d] = ymd ? ymd.split('-').map(Number) : []
  return m && d ? `${MONTHS[m - 1]} ${d}` : iso
}

/**
 * The small print under a sent copy's line, one fact each, only those the row has: "from office@…", "opened Oct 10,
 * 6:12 PM", "paid Oct 11 by card". The screen sets them side by side.
 */
export function sentCopyFacts(row: SentCopyStamps): string[] {
  const facts: string[] = []
  const from = row.fromEmail?.trim()
  if (from) facts.push(`from ${from}`)
  if (row.openedAt) facts.push(`opened ${monthDay(row.openedAt)}, ${clockTime(row.openedAt)}`)
  if (row.paid) {
    const how = row.paid.how.trim()
    facts.push(`paid ${monthDay(row.paid.at)}${how ? ` by ${how}` : ''}`)
  }
  return facts
}

/** A thread line, or a run of the app's lines folded into one row that opens them in place. */
export type AppFoldRow =
  | { kind: 'line'; message: ThreadMessage }
  | {
      kind: 'fold'
      /** Stable across reads while the run's first line stands: `fold:<first line's id>`. */
      id: string
      who: typeof APP_WHO
      /** "3 emails, Oct 8 to Oct 10". */
      words: string
      /** The folded lines, oldest first, drawn in place on a press. */
      lines: ThreadMessage[]
    }

const CHANNEL_PLURAL: Partial<Record<ThreadMessage['channel'], string>> = { email: 'emails', text: 'texts' }

/** What a folded run says: how many of what, and the days they span. */
export function foldWords(lines: readonly ThreadMessage[]): string {
  const channels = new Set(lines.map((m) => m.channel))
  const [only] = channels
  const what = channels.size === 1 && only && CHANNEL_PLURAL[only] ? CHANNEL_PLURAL[only] : 'messages'
  const first = monthDay(lines[0]!.at)
  const last = monthDay(lines[lines.length - 1]!.at)
  return `${lines.length} ${what}, ${first === last ? first : `${first} to ${last}`}`
}

/**
 * The thread with each run of two or more of the app's lines, with no line of a person's between them, folded into one
 * row. A lone app line stays a line. Lines come oldest first, as the thread draws them; the day dividers are the
 * thread's own and are not drawn here.
 */
export function foldAppLines(lines: readonly ThreadMessage[]): AppFoldRow[] {
  const rows: AppFoldRow[] = []
  let run: ThreadMessage[] = []
  const flush = () => {
    if (run.length === 1) rows.push({ kind: 'line', message: run[0]! })
    else if (run.length > 1) rows.push({ kind: 'fold', id: `fold:${run[0]!.id}`, who: APP_WHO, words: foldWords(run), lines: run })
    run = []
  }
  for (const m of lines) {
    if (isAppLine(m)) {
      run.push(m)
      continue
    }
    flush()
    rows.push({ kind: 'line', message: m })
  }
  flush()
  return rows
}
