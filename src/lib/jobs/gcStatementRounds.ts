/**
 * GC statement marks kernel (v2.2072 → punch list #49). One mark per GC per
 * week records the statement going out and the word coming back: the channels
 * and temperatures, who the word came from, the tooltip, the account-man
 * fallback, and last-sent merged from marks. The week's list itself — which
 * GC needs which step — is `gcWorklist.ts`; IO lives in gcStatementRoundIo.ts.
 */


/** Outstanding (non-collections) threshold for joining the weekly round. */
export const GC_ROUND_THRESHOLD = 10000

/** How a statement went out (v2.2761). Rows from before the column read as email. */
export type StatementSendChannel = 'email' | 'text' | 'call' | 'in_person' | 'other'

export const STATEMENT_SEND_CHANNELS: ReadonlyArray<{ value: StatementSendChannel; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'in_person', label: 'In person' },
  { value: 'other', label: 'Other' },
]

export function isStatementSendChannel(v: unknown): v is StatementSendChannel {
  return typeof v === 'string' && STATEMENT_SEND_CHANNELS.some((c) => c.value === v)
}

/** Display label for a stored channel; null/unknown (pre-v2.2761 rows) read as Email. */
export function sendChannelLabel(channel: string | null | undefined): string {
  return STATEMENT_SEND_CHANNELS.find((c) => c.value === channel)?.label ?? 'Email'
}

/**
 * The account man's read of a GC after a contact (v2.2813): hot = pay date in
 * hand, warm = fine with no date, cool = dodging the date, cold = disputing or
 * upset. Required on a contacted mark, optional on a send.
 */
export type Temperature = 'hot' | 'warm' | 'cool' | 'cold'

export const TEMPERATURES: ReadonlyArray<{ value: Temperature; label: string; hint: string }> = [
  { value: 'hot', label: 'Hot', hint: 'pay date in hand' },
  { value: 'warm', label: 'Warm', hint: 'fine, no date' },
  { value: 'cool', label: 'Cool', hint: 'dodging the date' },
  { value: 'cold', label: 'Cold', hint: 'disputing or upset' },
]

export function isTemperature(v: unknown): v is Temperature {
  return typeof v === 'string' && TEMPERATURES.some((t) => t.value === v)
}

/** Cold first — the review order everywhere temperatures are listed. */
export function temperatureRank(t: Temperature | null | undefined): number {
  return t === 'cold' ? 0 : t === 'cool' ? 1 : t === 'warm' ? 2 : t === 'hot' ? 3 : 4
}

export type RoundMarkAction = 'sent' | 'skipped' | 'contacted'

export type RoundMarkRow = {
  gc_customer_id: string
  week_start: string
  /** contacted (v2.2813) = spoke with the GC, no statement — never counts as sent. */
  action: RoundMarkAction
  acted_by: string | null
  acted_by_name: string
  acted_at: string
  /** v2.2761 — null on rows written before the column existed (those were emails). */
  channel: string | null
  /** v2.2761 — optional free text from whoever marked it sent; on a contacted mark, the answer to "what's their temperature?". */
  note: string | null
  /** v2.2813 — the temperature read; required on contacted. */
  temperature: string | null
  /** v2.2813 — when they said they'd pay, YYYY-MM-DD, if they said. */
  expected_pay_by: string | null
  /** Whose read of the GC the word is — usually the account man. Absent or null = the person who marked it (rows from before the columns). */
  word_from_user_id?: string | null
  word_from_name?: string | null
  /** How the person entering the word heard it from its source; null when the source entered it. */
  word_heard_via?: string | null
  word_entered_by?: string | null
  word_entered_by_name?: string | null
  /** When the word was recorded; null = with the mark (acted_at). */
  word_at?: string | null
}

/** Who the word came from, and who typed it in when that is someone else. */
export function markWordFrom(mark: Pick<RoundMarkRow, 'acted_by_name' | 'word_from_name' | 'word_entered_by_name'>): { name: string; enteredBy: string | null } {
  const name = mark.word_from_name?.trim() || mark.acted_by_name?.trim() || ''
  const typist = mark.word_entered_by_name?.trim() || (mark.word_from_name?.trim() ? mark.acted_by_name?.trim() : '') || ''
  return { name, enteredBy: typist && typist !== name ? typist : null }
}

/** "Malachi — entered by Taunya", or just "Malachi" when he typed it himself. */
export function markWordByline(mark: Pick<RoundMarkRow, 'acted_by_name' | 'word_from_name' | 'word_entered_by_name'>): string {
  const w = markWordFrom(mark)
  return w.enteredBy ? `${w.name || '—'} — entered by ${w.enteredBy}` : w.name || '—'
}

/** When the word was recorded: its own stamp, else the mark's. */
export function markWordAt(mark: Pick<RoundMarkRow, 'acted_at' | 'word_at'>): string {
  return mark.word_at || mark.acted_at
}

/**
 * Tooltip for a sent mark: who, when, how, and the note if any. Dates are
 * formatted by the caller so the kernel stays timezone-free.
 */
export function describeRoundMark(
  mark: Pick<RoundMarkRow, 'acted_by_name' | 'channel' | 'note'> & Partial<Pick<RoundMarkRow, 'action' | 'temperature' | 'expected_pay_by' | 'word_from_name' | 'word_entered_by_name'>>,
  whenLabel: string,
): string {
  const contacted = mark.action === 'contacted'
  // A word names its source; a statement names whoever marked it sent, with the word's source after the read.
  const wordBy = mark.word_from_name?.trim() ? markWordByline(mark) : ''
  const head = `${contacted ? 'Spoke with them' : 'Marked sent'} by ${(contacted && wordBy) || mark.acted_by_name || '—'} · ${whenLabel} · ${sendChannelLabel(mark.channel).toLowerCase()}${
    mark.temperature ? ` · ${mark.temperature}${!contacted && wordBy ? ` (${wordBy})` : ''}` : ''
  }${contacted ? ' · no statement' : ''}`
  const note = mark.note?.trim()
  const pay = mark.expected_pay_by ? `\nThey said they'd pay by ${mark.expected_pay_by}` : ''
  return (note ? `${head}\n${contacted ? 'Temperature' : 'Note'}: ${note}` : head) + pay
}

/**
 * Most-common Account Man per GC from the billed rows — the assignment
 * fallback when no standing sender is set on the customer.
 */
export function deriveGcAccountMen(
  rows: readonly { job: { gc_customer_id?: string | null; account_manager_user_id?: string | null } }[],
): Map<string, string> {
  const tallies = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const gc = r.job.gc_customer_id
    const am = r.job.account_manager_user_id
    if (!gc || !am) continue
    const t = tallies.get(gc) ?? new Map<string, number>()
    t.set(am, (t.get(am) ?? 0) + 1)
    tallies.set(gc, t)
  }
  const out = new Map<string, string>()
  for (const [gc, t] of tallies) {
    let best: string | null = null
    let bestN = 0
    for (const [am, n] of t) {
      if (n > bestN) {
        best = am
        bestN = n
      }
    }
    if (best) out.set(gc, best)
  }
  return out
}

/**
 * Last-sent map with personal round marks merged in: a "Sent it" mark counts
 * exactly like an app-sent email for the pills, this-week checks, and week
 * progress. Later timestamp wins.
 */
export function mergeMarksIntoLastSent(lastSentByGcId: Record<string, string>, marks: readonly RoundMarkRow[]): Record<string, string> {
  const out = { ...lastSentByGcId }
  for (const m of marks) {
    if (m.action !== 'sent') continue
    const prev = out[m.gc_customer_id]
    if (!prev || m.acted_at > prev) out[m.gc_customer_id] = m.acted_at
  }
  return out
}

/**
 * The certifier's Pipeline card headline (B6 / J20-F7). `held.count` is a
 * count of GCs — one group each waiting on certification — never of rounds,
 * and the verb agrees with it: "1 GC statement waits on sign-off — $12,700",
 * "5 GC statements wait on sign-off — $154,166". `totalLabel` is formatted
 * by the caller so the kernel stays locale-free.
 */
export function heldRoundHeadline(count: number, totalLabel: string): string {
  const n = Math.max(0, Math.floor(count))
  const noun = n === 1 ? 'GC statement waits' : 'GC statements wait'
  return `${n} ${noun} on sign-off — ${totalLabel}`
}
