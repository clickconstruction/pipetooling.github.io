/**
 * Messages, cut 5: what `quo-webhook` and `quo-send` share. They place a number on its contact (`quo_place_number`),
 * write a line through `quo_write_line` over the revision they read, and send a text through Quo's API. Every decision
 * is a kernel's (`./gcKernels/index.ts`, from `src/lib/quo/`); this file reads, writes and calls.
 *
 * Secrets: QUO_API_KEY (Quo's key, sent as the Authorization header), QUO_PHONE_NUMBER_ID (the company number's `PN…`
 * id, every text's From), QUO_SEATS (`{"US…": "<our user id>"}`, the seats until Settings → Phone and texts has a
 * table), QUO_COMPANY_NAME, QUO_COMPANY_PHONE and QUO_COMPANY_MAILBOX (the words a HELP answer and a stop's confirmation
 * carry).
 */
// deno-lint-ignore-file no-explicit-any
// The Quo kernels straight from the copy, not its index: the index re-exports every kernel in it, which the check would
// then walk too.
import { toE164, unknownContact, type QuoLine, type QuoPlanContext } from './gcKernels/lib/quo/events.ts'
import {
  MESSAGE_ROW_COLUMNS,
  contactKindOf,
  contactWords,
  defaultJob,
  jobOf,
  lineFromRow,
  quoSeatUserIds,
  quoSeats,
  seatsSource,
  rowFromLine,
  type JobAt,
  type MessageRow,
} from './gcKernels/lib/quo/rows.ts'
import { planSend, sendOver, sentQuoId, type QuoSendInput } from './gcKernels/lib/quo/send.ts'

/** Quo's send endpoint. */
export const QUO_MESSAGES_URL = 'https://api.quo.com/v1/messages'

/** How many times a line is read, merged and written before the caller gives up (the webhook then asks Quo again). */
const WRITE_TRIES = 5

/** Our company as a text names it, from the secrets. */
export function quoCompany(): QuoPlanContext['company'] {
  return {
    name: Deno.env.get('QUO_COMPANY_NAME')?.trim() || 'Click Construction',
    phone: Deno.env.get('QUO_COMPANY_PHONE')?.trim() ?? '',
    mailbox: Deno.env.get('QUO_COMPANY_MAILBOX')?.trim() ?? '',
  }
}

/**
 * Quo's seats with our users' names: the Settings row (`app_settings` `messages_quo_seats_v1`) once it names a seat,
 * else the `QUO_SEATS` secret (`seatsSource`). A row not there yet reads as empty.
 */
export async function loadSeats(admin: any): Promise<QuoPlanContext['users']> {
  const { data: row } = await admin.from('app_settings').select('value_text').eq('key', 'messages_quo_seats_v1').maybeSingle()
  const raw = seatsSource((row as { value_text: string | null } | null)?.value_text, Deno.env.get('QUO_SEATS'))
  const ids = quoSeatUserIds(raw)
  if (ids.length === 0) return {}
  const { data, error } = await admin.from('users').select('id, name').in('id', ids)
  if (error) throw new Error(`users: ${error.message}`)
  return quoSeats(raw, (data ?? []) as { id: string; name: string | null }[])
}

/** Where a number lands: its contact, made when nobody has the number, the channel and its STOP, the words, the star. */
export interface Placed {
  contactId: string
  channelId: string
  /** The number as Quo takes it. */
  number: string
  optedOut: boolean
  /** What its lines call them: "Greg", or the number. */
  words: string
  /** The contact's default job, where a new line lands. */
  star: JobAt | null
}

/** Places a number on its contact (`quo_place_number`). Null for an identifier that is not a phone number. */
export async function placeNumber(admin: any, raw: string): Promise<Placed | null> {
  const number = toE164(raw)
  if (!number) return null
  const { data, error } = await admin.rpc('quo_place_number', { p_value: number, p_name: unknownContact(number).name })
  if (error) throw new Error(`quo_place_number: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as
    | { placed_contact: string; placed_channel: string; stopped_at: string | null; placed_kind: string; placed_name: string; placed_goes_by: string | null }
    | undefined
  if (!row) throw new Error('quo_place_number answered nothing')
  const { data: jobs, error: jobsError } = await admin
    .from('contact_jobs')
    .select('bid_id, project_id, jobs_ledger_id, is_default')
    .eq('contact_id', row.placed_contact)
  if (jobsError) throw new Error(`contact_jobs: ${jobsError.message}`)
  const kind = contactKindOf(row.placed_kind)
  return {
    contactId: row.placed_contact,
    channelId: row.placed_channel,
    number,
    optedOut: Boolean(row.stopped_at),
    words: contactWords({ name: row.placed_name, goesBy: row.placed_goes_by, kind }, number),
    star: defaultJob(jobs ?? []),
  }
}

/**
 * Reads the line under `quoId`, asks `merge` for the next one, and writes it over the revision read. A write refused
 * because the line changed meanwhile is read and merged again. A null line writes nothing. `then` is what the merge
 * decided beside the line, from the read the write went over.
 */
export async function writeLine<T>(
  admin: any,
  quoId: string,
  tie: JobAt | null,
  merge: (prev: QuoLine | null) => { line: QuoLine | null; then: T },
): Promise<{ id: string | null; then: T }> {
  for (let i = 0; i < WRITE_TRIES; i += 1) {
    const { data, error } = await admin.from('messages').select(MESSAGE_ROW_COLUMNS).eq('quo_id', quoId).maybeSingle()
    if (error) throw new Error(`messages: ${error.message}`)
    const row = (data ?? null) as MessageRow | null
    const read = row ? lineFromRow(row) : null
    if (row && !read) throw new Error(`the line under ${quoId} is not one Quo wrote`)
    const next = merge(read?.line ?? null)
    if (!next.line) return { id: row?.id ?? null, then: next.then }
    const jobs = [row ? jobOf(row) : null, tie].filter((j): j is JobAt => j !== null)
    const columns = rowFromLine(next.line, jobs)
    if (!columns.ok) throw new Error(columns.why)
    const { data: wrote, error: writeError } = await admin.rpc('quo_write_line', {
      p_quo_id: quoId,
      p_rev: read?.rev ?? null,
      p_row: columns.columns,
    })
    if (writeError) throw new Error(`quo_write_line: ${writeError.message}`)
    const answer = (Array.isArray(wrote) ? wrote[0] : wrote) as { written: boolean; id: string | null } | undefined
    if (answer?.written) return { id: answer.id, then: next.then }
  }
  throw new Error(`the line under ${quoId} kept changing`)
}

/** When we last texted this number (ms), for the opt-out line's silence rule; null when we never did. */
export async function lastOurTextAt(admin: any, channelId: string): Promise<number | null> {
  const { data, error } = await admin
    .from('messages')
    .select('at')
    .eq('channel_id', channelId)
    .eq('channel', 'text')
    .eq('direction', 'out')
    .order('at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`messages: ${error.message}`)
  return data ? Date.parse((data as { at: string }).at) : null
}

export type SendOutcome =
  | { ok: true; messageId: string | null; quoId: string | null; segments: number }
  | { ok: false; refused: string; words: string; status: number }

/**
 * A text out: planned by `planSend` (which refuses a number that sent STOP, and adds the opt-out line when a rule
 * says), posted to Quo from the company number, and written under the id Quo answers with (`sendOver`, so Quo's own
 * delivery event, before or after, ends on the same line). `tie` is the job the line goes on.
 */
export async function sendText(admin: any, input: Omit<QuoSendInput, 'fromNumberId'>, tie: JobAt | null): Promise<SendOutcome> {
  const apiKey = Deno.env.get('QUO_API_KEY')
  const fromNumberId = Deno.env.get('QUO_PHONE_NUMBER_ID')
  if (!apiKey || !fromNumberId) {
    return { ok: false, refused: 'not-set-up', words: 'Texts are not set up yet. Add the Quo key and the company number first.', status: 503 }
  }
  const plan = planSend({ ...input, fromNumberId })
  if (!plan.ok) return { ok: false, refused: plan.refused, words: plan.words, status: 422 }
  const res = await fetch(QUO_MESSAGES_URL, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(plan.request),
  })
  const answer = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, refused: 'quo', words: `Quo did not take the text. It answered ${res.status}.`, status: 502 }
  const quoId = sentQuoId(answer)
  if (!quoId) {
    // Nothing to key the line by: it is written as it went, and Quo's delivery event will not find it.
    const columns = rowFromLine(sendOver(null, plan.line, 'unkeyed'), tie ? [tie] : [])
    if (!columns.ok) throw new Error(columns.why)
    const { data, error } = await admin.from('messages').insert(columns.columns).select('id').single()
    if (error) throw new Error(`messages: ${error.message}`)
    return { ok: true, messageId: (data as { id: string }).id, quoId: null, segments: plan.segments }
  }
  const wrote = await writeLine(admin, quoId, tie, (prev) => ({ line: sendOver(prev, plan.line, quoId), then: null }))
  return { ok: true, messageId: wrote.id, quoId, segments: plan.segments }
}
