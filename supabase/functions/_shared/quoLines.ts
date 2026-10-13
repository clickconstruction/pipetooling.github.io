/**
 * Messages, cut 5: what `quo-webhook` and `quo-send` share. They place a number on its contact (`quo_place_number`),
 * write a line through `quo_write_line` over the revision they read, and send a text through Quo's API. Every decision
 * is a kernel's (`./gcKernels/index.ts`, from `src/lib/quo/`); this file reads, writes and calls.
 *
 * Secrets: QUO_API_KEY (Quo's key, sent as the Authorization header), QUO_PHONE_NUMBER_ID (the company number's `PN…`
 * id, every text's From), QUO_SEATS (`{"US…": "<our user id>"}`, the seats until Settings → Phone and texts has a
 * table), QUO_COMPANY_NAME, QUO_COMPANY_PHONE and QUO_COMPANY_MAILBOX (the words a HELP answer and a stop's confirmation
 * carry).
 *
 * The pause: a text Quo turns away for the account's money pauses texts, and the next text it takes ends the pause
 * (`app_settings` `messages_quo_paused_v1`, `quo/paused.ts`).
 *
 * R6 (two boxes, two numbers): each box's number is Settings' (`app_settings` `messages_boxes_v1`), read by `loadBoxes`,
 * with QUO_PHONE_NUMBER_ID, QUO_COMPANY_PHONE and QUO_COMPANY_MAILBOX as the team box's while the row leaves them empty.
 * A line keeps the box it came through (`messages.mailbox`), a STOP is kept per box (`contact_channels.opted_out_by_box`),
 * and a text goes from its box's number.
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
import { QUO_PAUSED_KEY, notePause, readQuoRefusal, type PauseChange, type PauseStore } from './gcKernels/lib/quo/paused.ts'
import { BOXES_SETTINGS_KEY, boxSetting, parseBoxSettings, stopScope, stoppedOn, type BoxFallback, type BoxSettings, type Mailbox, type StopChannel } from './gcKernels/lib/messages/boxes.ts'

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

/**
 * Both boxes (`messages_boxes_v1`, `parseBoxSettings`), each field the row leaves empty filled from today's secrets
 * (`boxSetting`), so the functions keep the one company number until the owner types the boxes in. A row not there yet
 * reads as empty.
 */
export async function loadBoxes(admin: any): Promise<BoxSettings> {
  const { data: row, error } = await admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
  if (error) throw new Error(`app_settings: ${error.message}`)
  const settings = parseBoxSettings((row as { value_text: string | null } | null)?.value_text)
  const fallback: BoxFallback = {
    team: {
      numberId: Deno.env.get('QUO_PHONE_NUMBER_ID') ?? '',
      phone: Deno.env.get('QUO_COMPANY_PHONE') ?? '',
      address: Deno.env.get('QUO_COMPANY_MAILBOX') ?? '',
    },
    bids: {},
  }
  return { team: boxSetting('team', settings, fallback), bids: boxSetting('bids', settings, fallback) }
}

/** Where a number lands: its contact, made when nobody has the number, the channel and its STOP, the words, the star. */
export interface Placed {
  contactId: string
  channelId: string
  /** The number as Quo takes it. */
  number: string
  /** The number sent STOP to the box `placeNumber` was asked about (`stoppedOn`). */
  optedOut: boolean
  /** Its STOPs: the older one to every box and the one per box, for `writeStops`. */
  stops: StopChannel
  /** What its lines call them: "Greg", or the number. */
  words: string
  /** The contact's default job, where a new line lands. */
  star: JobAt | null
}

/**
 * Places a number on its contact (`quo_place_number`), with its STOP to `box`. Null for an identifier that is not a
 * phone number.
 */
export async function placeNumber(admin: any, raw: string, box: Mailbox): Promise<Placed | null> {
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
  const { data: stopRow, error: stopError } = await admin.from('contact_channels').select('opted_out_by_box').eq('id', row.placed_channel).single()
  if (stopError) throw new Error(`contact_channels: ${stopError.message}`)
  const stops: StopChannel = {
    channelId: row.placed_channel,
    optedOutAt: row.stopped_at,
    optedOutByBox: (stopRow as { opted_out_by_box: StopChannel['optedOutByBox'] }).opted_out_by_box ?? {},
  }
  const kind = contactKindOf(row.placed_kind)
  return {
    contactId: row.placed_contact,
    channelId: row.placed_channel,
    number,
    optedOut: stoppedOn(stops, box),
    stops,
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

/**
 * A STOP or a START (`stopScope`): for the box it came to, or both when `to` is null, written as the whole
 * `opted_out_by_box`. The older `opted_out_at` is read, never written by a new word.
 */
export async function writeStops(admin: any, stops: StopChannel, word: 'stop' | 'start', to: Mailbox | null, at: string): Promise<void> {
  const write = stopScope(stops, word, to, at)
  const { error } = await admin.from('contact_channels').update({ opted_out_by_box: write.optedOutByBox }).eq('id', write.channelId)
  if (error) throw new Error(`contact_channels: ${error.message}`)
}

/**
 * When we last texted this number from `box` (ms), for the opt-out line's first-text and silence rule, which is per pair
 * of numbers; null when we never did. A line from before two boxes is the team box's, today's one number.
 */
export async function lastOurTextAt(admin: any, channelId: string, box: Mailbox): Promise<number | null> {
  const query = admin.from('messages').select('at').eq('channel_id', channelId).eq('channel', 'text').eq('direction', 'out')
  const { data, error } = await (box === 'team' ? query.or('mailbox.eq.team,mailbox.is.null') : query.eq('mailbox', box))
    .order('at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`messages: ${error.message}`)
  return data ? Date.parse((data as { at: string }).at) : null
}

/**
 * A text's word on the pause (`notePause`), over the `app_settings` row: a write goes only over the words it read, so
 * two texts' words never cross. Never throws: a word not written is logged, and the text's own answer stands.
 */
export async function notePauseRow(admin: any, change: PauseChange): Promise<void> {
  const settings = () => admin.from('app_settings')
  const store: PauseStore = {
    read: async () => {
      const { data, error } = await settings().select('value_text').eq('key', QUO_PAUSED_KEY).maybeSingle()
      if (error) throw new Error(`app_settings: ${error.message}`)
      return data ? ((data as { value_text: string | null }).value_text ?? null) : undefined
    },
    write: async (prev, next) => {
      const write =
        prev === undefined
          ? settings().upsert({ key: QUO_PAUSED_KEY, value_text: next }, { onConflict: 'key', ignoreDuplicates: true })
          : prev === null
            ? settings().update({ value_text: next }).eq('key', QUO_PAUSED_KEY).is('value_text', null)
            : settings().update({ value_text: next }).eq('key', QUO_PAUSED_KEY).eq('value_text', prev)
      const { data, error } = await write.select('key')
      if (error) throw new Error(`app_settings: ${error.message}`)
      return (data ?? []).length > 0
    },
  }
  try {
    if ((await notePause(store, change)) === 'kept-changing') console.error(`[quo] the pause kept changing, so the ${change.kind} at ${change.at} was dropped`)
  } catch (e) {
    console.error('[quo] the pause was not written:', e instanceof Error ? e.message : String(e))
  }
}

export type SendOutcome =
  | { ok: true; messageId: string | null; quoId: string | null; segments: number }
  | { ok: false; refused: string; words: string; status: number }

/**
 * A text out: planned by `planSend` (which refuses a number that sent STOP, and adds the opt-out line when a rule
 * says), posted to Quo from `box`'s number (chosen by the caller with `sendBox`, so a box with no number is never
 * asked), and written under the id Quo answers with (`sendOver`, so Quo's own delivery event, before or after, ends on
 * the same line), stamped with the box. `tie` is the job the line goes on. Quo turning it away is read by
 * `readQuoRefusal`: for money it pauses texts, and a text Quo takes ends the pause.
 */
export async function sendText(
  admin: any,
  input: Omit<QuoSendInput, 'fromNumberId' | 'mailbox'>,
  tie: JobAt | null,
  box: Mailbox,
  boxes: BoxSettings,
): Promise<SendOutcome> {
  const apiKey = Deno.env.get('QUO_API_KEY')
  const fromNumberId = boxes[box].numberId
  if (!apiKey || !fromNumberId) {
    return { ok: false, refused: 'not-set-up', words: 'Texts are not set up yet. Add the Quo key and the company number first.', status: 503 }
  }
  const plan = planSend({ ...input, mailbox: box, fromNumberId })
  if (!plan.ok) return { ok: false, refused: plan.refused, words: plan.words, status: 422 }
  const res = await fetch(QUO_MESSAGES_URL, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(plan.request),
  })
  const answer = await res.json().catch(() => null)
  if (!res.ok) {
    const { refused, words, status, why } = readQuoRefusal(res.status, answer)
    console.error(`[quo] Quo turned a text away: ${why}`)
    if (refused === 'paused') await notePauseRow(admin, { kind: 'pause', at: plan.line.at })
    return { ok: false, refused, words, status }
  }
  await notePauseRow(admin, { kind: 'go', at: plan.line.at })
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
