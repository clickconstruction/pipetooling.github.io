/**
 * Today's sends (v2.5595, punch list #115): what the window reads and writes (`offers.ts` is the kernel). One
 * interface, so the smoke hands it a fake; one implementation on the app's client. The open offers with the people,
 * their numbers and the steps' names; a send, which is the reply box's own path through `quo-send` then the offer
 * stamped sent (`nudge_offer_sent`, which records the reminder too); a hold (`nudge_hold_until`, then the offer put
 * away as held); a stop (`flow_skip_step`, then stopped); Not this one; and the office's own text for a morning
 * (`nudge_offer_make`, the sheet's Send in the morning). A client ahead of the push reads the table as empty.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { isNotThereYetError } from '../gcWordAskIo'
import type { ContactKind } from '../contacts/kernel'
import { contactFlowKindOf } from '../flows/facts'
import { OFFER_HELD } from '../flows/nudgeDispatch'
import { SEED_FLOWS } from '../flows/seed'
import { flat } from '../flows/state'
import { jobKeyOfRow, jobRefOf } from '../messages/jobKeys'
import { supabaseReplyIo } from '../messages/replyIo'
import { answeredAlready, answeredJobs, needsRatingLink, RATE_BLANK } from '../ratings/ratingAsk'
import { supabaseRatingLinkIo, type RatingLinkIo } from '../ratings/ratingLinkIo'
import { rateJobsOf, withAnsweredHolds, withSentHolds, type OfferRow, type SentRow, type TodaysSend, type TodaysSendsInput } from './offers'

export interface OfferMake {
  contactId: string
  stepKey: string
  jobKey: string | null
  body: string
  channelId: string | null
  /** YYYY-MM-DD, the morning the run sends it; null waits for a press on Today's sends (a moved first visit, v2.5597). */
  sendOn: string | null
  /** YYYY-MM-DD, the day the words are about (a moved visit's new day, v2.6387): past it the text is stale. Unset for a text about no day. */
  aboutOn?: string | null
  /** ISO, the instant the run sends it (v2.6774, Send later); unset for the morning's or a press. */
  sendAt?: string | null
}

export interface OffersIo {
  loadOpen(): Promise<TodaysSendsInput>
  countOpen(): Promise<number>
  /** Sends the words through quo-send and stamps the offer. Resolves to the text's line id. */
  send(row: Pick<TodaysSend, 'id' | 'contactId' | 'channelId' | 'jobKey'> & { who?: string | null }, body: string): Promise<string>
  dismiss(id: string, why: 'not this one' | 'sent elsewhere'): Promise<void>
  holdUntil(row: Pick<TodaysSend, 'id' | 'contactId' | 'jobKey'> & { stepKey: string }, untilYmd: string): Promise<void>
  stop(row: Pick<TodaysSend, 'id' | 'contactId' | 'jobKey'> & { stepKey: string }, why: string): Promise<void>
  make(input: OfferMake): Promise<string>
  /** Change the time (v2.6774): an open office-made text goes at this instant instead, through `nudge_offer_retime`. A smoke may leave it out. */
  retime?(id: string, sendAtIso: string): Promise<void>
}

const OFFER_COLUMNS = 'id, contact_id, step_key, bid_id, project_id, jobs_ledger_id, body, channel_id, prepared_at, prepared_by, send_on, send_at, about_on, held_why'
/** The columns a client ahead of the push reads: `send_at` lands with `20261109090000`; until then the row reads with no time. */
const OFFER_COLUMNS_BEFORE_SEND_AT = OFFER_COLUMNS.replace(', send_at', '')

type OfferDbRow = {
  id: string
  contact_id: string
  step_key: string
  bid_id: string | null
  project_id: string | null
  jobs_ledger_id: string | null
  body: string
  channel_id: string | null
  prepared_at: string
  prepared_by: string
  send_on: string | null
  send_at?: string | null
  about_on: string | null
  held_why: string | null
}

/** Every step's name by `<kind>:<step key>`: the seed's, then the office's edits over them. */
function stepNamesFrom(rows: readonly { step_key: string; name: string; flows: { kind: string } | null }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [kind, flow] of Object.entries(SEED_FLOWS)) for (const s of flat(flow)) out[`${kind}:${s.id}`] = s.name
  for (const r of rows) if (r.flows?.kind) out[`${r.flows.kind}:${r.step_key}`] = r.name
  return out
}

const jobArgs = (jobKey: string | null) => {
  const ref = jobRefOf(jobKey)
  return { p_job_kind: ref?.kind ?? null, p_job_id: ref?.id ?? null }
}

/**
 * Customer reviews (v2.5943, punch list #185): an offer's words that hold `{rate}` (the Review asked step's line) take a
 * fresh rating link at the press, minted the way the reply box mints one (`mint_customer_rating`, which reuses a fresh
 * unanswered ask), so an offer put away never counts as asked on The last 7 days. A job's offer names the job. Since
 * v2.6007 a job the customer answered already is kept back first, by the one rule the morning run keeps
 * (`ratings/ratingAsk.ts`'s `answeredAlready`): the press is refused with the hold's words and nothing is minted.
 */
export async function withRatingLink(body: string, row: Pick<TodaysSend, 'contactId' | 'jobKey'> & { who?: string | null }, links: RatingLinkIo): Promise<string> {
  if (!needsRatingLink(body)) return body
  const ref = jobRefOf(row.jobKey)
  const jobId = ref?.kind === 'pipeline' ? ref.id : null
  if (jobId && answeredAlready(await links.asksOn([jobId]), jobId)) throw new Error(OFFER_HELD.answered)
  const link = await links.mint(row.contactId, jobId, row.who ?? '')
  return body.replace(RATE_BLANK, link)
}

export function supabaseOffersIo(client: unknown = supabase, ratingLinks: RatingLinkIo = supabaseRatingLinkIo(client)): OffersIo {
  const db = client as SupabaseClient
  const open = (columns: string = OFFER_COLUMNS) => db.from('nudge_offers').select(columns).is('sent_at', null).is('dismissed_at', null).order('prepared_at')
  return {
    async loadOpen() {
      let result = await open()
      // A client ahead of the push (v2.6774): the table is there but `send_at` is not yet; read without it.
      if (result.error && /send_at/.test(result.error.message ?? '')) result = await open(OFFER_COLUMNS_BEFORE_SEND_AT)
      if (result.error) {
        if (isNotThereYetError(result.error)) return { offers: [], names: {}, numbers: {}, stepNames: {} }
        checkSupabaseError(result, 'read today’s sends')
      }
      const rows = (result.data ?? []) as unknown as OfferDbRow[]
      const contactIds = [...new Set(rows.map((o) => o.contact_id))]
      const channelIds = rows.flatMap((o) => (o.channel_id ? [o.channel_id] : []))
      // The reminders that went on the offers' people since the oldest was prepared (v2.6386), so a text whose step already
      // went another way is held. A read that fails holds nothing.
      const since = rows.map((r) => r.prepared_at).sort()[0] ?? null
      const [contacts, channels, steps, sentRows] = await Promise.all([
        // The person's record beside the contact (v2.6385): a residential customer's own contact is kind `customer` with no
        // name of its own, so their flow and their name are read from the customers row.
        contactIds.length ? db.from('contacts').select('id, kind, name, goes_by, customers(name, customer_type)').in('id', contactIds) : Promise.resolve({ data: [], error: null }),
        channelIds.length ? db.from('contact_channels').select('id, value').in('id', channelIds) : Promise.resolve({ data: [], error: null }),
        db.from('flow_steps').select('step_key, name, flows!inner(kind)'),
        contactIds.length && since ? db.from('nudge_sent').select('contact_id, step_key, bid_id, project_id, jobs_ledger_id, sent_at').in('contact_id', contactIds).gte('sent_at', since) : Promise.resolve({ data: [], error: null }),
      ])
      const kinds: Record<string, string> = {}
      const names: Record<string, string | null> = {}
      type ContactRead = { id: string; kind: string; name: string | null; goes_by: string | null; customers: { name: string | null; customer_type: string | null } | null }
      for (const c of (contacts.data ?? []) as unknown as ContactRead[]) {
        kinds[c.id] = contactFlowKindOf(c.kind as ContactKind, c.customers?.customer_type)
        names[c.id] = c.goes_by?.trim() || c.name || c.customers?.name || null
      }
      const numbers: Record<string, string> = {}
      for (const ch of (channels.data ?? []) as Array<{ id: string; value: string }>) numbers[ch.id] = ch.value
      type SentDbRow = { contact_id: string; step_key: string; bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null; sent_at: string }
      const sent: SentRow[] = ((sentRows.data ?? []) as SentDbRow[]).map((r) => ({ contactId: r.contact_id, stepKey: r.step_key, jobKey: jobKeyOfRow(r), sentAt: r.sent_at }))
      const read: OfferRow[] = rows.map((r) => ({
        id: r.id,
        contactId: r.contact_id,
        contactKind: kinds[r.contact_id] ?? null,
        stepKey: r.step_key,
        jobKey: jobKeyOfRow(r),
        body: r.body,
        channelId: r.channel_id,
        preparedAt: r.prepared_at,
        preparedBy: r.prepared_by === 'office' ? 'office' : 'app',
        sendOn: r.send_on,
        sendAt: r.send_at ?? null,
        aboutOn: r.about_on,
        heldWhy: r.held_why,
      }))
      const offers = withSentHolds(read, sent)
      // A review offer on a job answered already is held (v2.6007). A read of the asks that fails holds nothing: the press
      // asks again before it mints.
      const rateJobs = rateJobsOf(offers)
      const answered = rateJobs.length ? await ratingLinks.asksOn(rateJobs).then(answeredJobs, () => new Set<string>()) : new Set<string>()
      return { offers: withAnsweredHolds(offers, answered), names, numbers, stepNames: stepNamesFrom((steps.data ?? []) as unknown as Array<{ step_key: string; name: string; flows: { kind: string } | null }>) }
    },
    async countOpen() {
      const result = await db.from('nudge_offers').select('id', { count: 'exact', head: true }).is('sent_at', null).is('dismissed_at', null)
      if (result.error) return 0
      return result.count ?? 0
    },
    async send(row, body) {
      if (!row.channelId) throw new Error('No number to send to.')
      const words = await withRatingLink(body, row, ratingLinks)
      const messageId = await supabaseReplyIo().sendText({ contactId: row.contactId, channelId: row.channelId, jobKey: row.jobKey, body: words, held: false })
      const stamped = await db.rpc('nudge_offer_sent', { p_offer: row.id, p_message: messageId })
      checkSupabaseError(stamped, 'record the send')
      return messageId
    },
    async dismiss(id, why) {
      const result = await db.rpc('nudge_offer_dismiss', { p_offer: id, p_why: why })
      checkSupabaseError(result, 'put the text away')
    },
    async holdUntil(row, untilYmd) {
      const hold = await db.rpc('nudge_hold_until', { p_contact: row.contactId, p_step: row.stepKey, ...jobArgs(row.jobKey), p_until: untilYmd })
      checkSupabaseError(hold, 'hold the reminder')
      const result = await db.rpc('nudge_offer_dismiss', { p_offer: row.id, p_why: 'held' })
      checkSupabaseError(result, 'put the text away')
    },
    async stop(row, why) {
      const skip = await db.rpc('flow_skip_step', { p_contact: row.contactId, p_step: row.stepKey, ...jobArgs(row.jobKey), p_why: why })
      checkSupabaseError(skip, 'stop the reminders')
      const result = await db.rpc('nudge_offer_dismiss', { p_offer: row.id, p_why: 'stopped' })
      checkSupabaseError(result, 'put the text away')
    },
    async make(input) {
      const args = { p_contact: input.contactId, p_step: input.stepKey, ...jobArgs(input.jobKey), p_body: input.body, p_channel: input.channelId, p_send_on: input.sendOn, p_about_on: input.aboutOn ?? null }
      // Send later (v2.6774): the time rides as the ninth argument; a client ahead of the push falls back to the morning
      // alone, so the text still goes on its day.
      let result = input.sendAt ? await db.rpc('nudge_offer_make', { ...args, p_send_at: input.sendAt }) : await db.rpc('nudge_offer_make', args)
      if (result.error && input.sendAt && isNotThereYetError(result.error)) result = await db.rpc('nudge_offer_make', args)
      checkSupabaseError(result, 'prepare the text for later')
      return String(result.data)
    },
    async retime(id, sendAtIso) {
      const result = await db.rpc('nudge_offer_retime', { p_offer: id, p_send_at: sendAtIso })
      checkSupabaseError(result, 'change when the text goes')
    },
  }
}
