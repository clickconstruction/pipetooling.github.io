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
import { SEED_FLOWS } from '../flows/seed'
import { flat } from '../flows/state'
import { jobKeyOfRow, jobRefOf } from '../messages/jobKeys'
import { supabaseReplyIo } from '../messages/replyIo'
import type { OfferRow, TodaysSend, TodaysSendsInput } from './offers'

export interface OfferMake {
  contactId: string
  stepKey: string
  jobKey: string | null
  body: string
  channelId: string | null
  /** YYYY-MM-DD, the morning the run sends it; null waits for a press on Today's sends (a moved first visit, v2.5597). */
  sendOn: string | null
}

export interface OffersIo {
  loadOpen(): Promise<TodaysSendsInput>
  countOpen(): Promise<number>
  /** Sends the words through quo-send and stamps the offer. Resolves to the text's line id. */
  send(row: Pick<TodaysSend, 'id' | 'contactId' | 'channelId' | 'jobKey'>, body: string): Promise<string>
  dismiss(id: string, why: 'not this one' | 'sent elsewhere'): Promise<void>
  holdUntil(row: Pick<TodaysSend, 'id' | 'contactId' | 'jobKey'> & { stepKey: string }, untilYmd: string): Promise<void>
  stop(row: Pick<TodaysSend, 'id' | 'contactId' | 'jobKey'> & { stepKey: string }, why: string): Promise<void>
  make(input: OfferMake): Promise<string>
}

const OFFER_COLUMNS = 'id, contact_id, step_key, bid_id, project_id, jobs_ledger_id, body, channel_id, prepared_at, prepared_by, send_on, held_why'

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

export function supabaseOffersIo(client: unknown = supabase): OffersIo {
  const db = client as SupabaseClient
  const open = () => db.from('nudge_offers').select(OFFER_COLUMNS).is('sent_at', null).is('dismissed_at', null).order('prepared_at')
  return {
    async loadOpen() {
      const result = await open()
      if (result.error) {
        if (isNotThereYetError(result.error)) return { offers: [], names: {}, numbers: {}, stepNames: {} }
        checkSupabaseError(result, 'read today’s sends')
      }
      const rows = (result.data ?? []) as OfferDbRow[]
      const contactIds = [...new Set(rows.map((o) => o.contact_id))]
      const channelIds = rows.flatMap((o) => (o.channel_id ? [o.channel_id] : []))
      const [contacts, channels, steps] = await Promise.all([
        contactIds.length ? db.from('contacts').select('id, kind, name, goes_by').in('id', contactIds) : Promise.resolve({ data: [], error: null }),
        channelIds.length ? db.from('contact_channels').select('id, value').in('id', channelIds) : Promise.resolve({ data: [], error: null }),
        db.from('flow_steps').select('step_key, name, flows!inner(kind)'),
      ])
      const kinds: Record<string, string> = {}
      const names: Record<string, string | null> = {}
      for (const c of (contacts.data ?? []) as Array<{ id: string; kind: string; name: string | null; goes_by: string | null }>) {
        kinds[c.id] = c.kind
        names[c.id] = c.goes_by?.trim() || c.name
      }
      const numbers: Record<string, string> = {}
      for (const ch of (channels.data ?? []) as Array<{ id: string; value: string }>) numbers[ch.id] = ch.value
      const offers: OfferRow[] = rows.map((r) => ({
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
        heldWhy: r.held_why,
      }))
      return { offers, names, numbers, stepNames: stepNamesFrom((steps.data ?? []) as unknown as Array<{ step_key: string; name: string; flows: { kind: string } | null }>) }
    },
    async countOpen() {
      const result = await db.from('nudge_offers').select('id', { count: 'exact', head: true }).is('sent_at', null).is('dismissed_at', null)
      if (result.error) return 0
      return result.count ?? 0
    },
    async send(row, body) {
      if (!row.channelId) throw new Error('No number to send to.')
      const messageId = await supabaseReplyIo().sendText({ contactId: row.contactId, channelId: row.channelId, jobKey: row.jobKey, body, held: false })
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
      const result = await db.rpc('nudge_offer_make', { p_contact: input.contactId, p_step: input.stepKey, ...jobArgs(input.jobKey), p_body: input.body, p_channel: input.channelId, p_send_on: input.sendOn })
      checkSupabaseError(result, 'prepare the text for the morning')
      return String(result.data)
    },
  }
}
