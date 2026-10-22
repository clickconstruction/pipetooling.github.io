// messages-notify's push for a reply (residential R5, PR 2): the reads, the sends and the record. The rule is the
// planner's (src/lib/messages/notifyPlan.ts, through the edge copy); this reads the rows it takes, sends each push it
// says is due to every device of each person, and writes one notification_history row per person reached, with the
// line in message_id, so no line is pushed twice. It writes nothing to contacts.
//
// Two bodies, server to server with X-Cron-Secret: { message_ids: [...] } (1 to 50, for a line's writer right after
// its insert; the writers call it in a later PR) and { sweep: true } (the cron, R5's PR 3, every minute). Both send
// nothing while the owner's switch (REPLY_PUSH_ON_KEY, R5's PR 3, 'false' as it ships) is off. The sweep reads the lines
// in from the last wait plus thirty minutes plus five (sweepSince).
//
// The walk kit (punch list #142 PR 6): walk_kit_v1 is read once per run; a line on the kit's contact pushes the real
// dev accounts alone (notifyPlan's kit branch), so a walk buzzes nobody in the office.
// deno-lint-ignore-file no-explicit-any
// The kernels straight from the copy, not its index: the index re-exports every kernel in it, which the check would
// then walk too.
import { ASSIGN_RULE_KEY, parseAssignSeats } from './gcKernels/lib/followUp/assignSeats.ts'
import { OFFICE_HOURS_KEY, parseOfficeHours } from './gcKernels/lib/messages/hasRule.ts'
import { legalSendsFromDemandLetters, legalSendsFromFilings, type LegalSend } from './gcKernels/lib/messages/legalRoute.ts'
import { NOTIFY_LINES_MAX, planReplyPushes, PUSH_KINDS, REPLY_PUSH_ON_KEY, sweepSince, type PlanContact, type PlanLine, type PlanOut, type PlanUser } from './gcKernels/lib/messages/notifyPlan.ts'
import { OFFICE_WAIT_KEY, PUSH_CHANNELS, pushSentRow, type Push } from './gcKernels/lib/messages/notifyRule.ts'
import { MESSAGES_OFFICE_ROLES, MESSAGES_TECH_ROLES } from './messagesTeams.ts'
import { REAL_ACCOUNT } from './realAccount.ts'
import { loadWalkKit } from './walkKit.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The most lines a writer names in one call. */
export const MESSAGE_IDS_MAX = 50

/** How far before the oldest line the reads of our lines out reach: a tech's text the day before still names them. */
const OUTS_BEFORE_MS = 36 * 3_600_000

export type ReplyPushBody = { message_ids: string[] } | { sweep: true }

/** The body, read: the lines a writer names, or the sweep. Words for anything else. */
export function readReplyPushBody(json: unknown): ReplyPushBody | { error: string } {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  if (o.sweep === true) return { sweep: true }
  if (Array.isArray(o.message_ids)) {
    const ids = [...new Set(o.message_ids)]
    if (ids.some((x) => typeof x !== 'string' || !UUID.test(x))) return { error: 'Name the lines by id' }
    if (ids.length === 0 || ids.length > MESSAGE_IDS_MAX) return { error: `Name between 1 and ${MESSAGE_IDS_MAX} lines` }
    return { message_ids: ids as string[] }
  }
  return { error: 'Send message_ids or sweep' }
}

export interface ReplyPushResult {
  /** The owner's switch is off (or its row is not there yet): nothing was read or sent. */
  off?: true
  lines: number
  /** Pushes sent, one a push however many people it reached. */
  sent: number
  /** People reached, one a person a push. */
  reached: number
  waiting: number
  answered: number
  late: number
}

/** Sends one push's payload to every device of one person; resolves to how many took it. */
export type PushToPerson = (userId: string, payload: string) => Promise<number>

const LINE_COLUMNS = 'id, contact_id, channel, direction, at, body, subject'

export async function runReplyPushes(admin: any, body: ReplyPushBody, sendTo: PushToPerson, now: string = new Date().toISOString()): Promise<ReplyPushResult> {
  const empty: ReplyPushResult = { lines: 0, sent: 0, reached: 0, waiting: 0, answered: 0, late: 0 }

  const { data: settingRows } = await admin
    .from('app_settings')
    .select('key, value_text, value_num')
    .in('key', [REPLY_PUSH_ON_KEY, ASSIGN_RULE_KEY, OFFICE_HOURS_KEY, OFFICE_WAIT_KEY])
  const setting = (key: string) => ((settingRows ?? []) as Array<{ key: string; value_text: string | null; value_num: number | null }>).find((r) => r.key === key)
  // The owner's switch, for a writer's call as for the cron's: off until it reads 'true'.
  if (setting(REPLY_PUSH_ON_KEY)?.value_text !== 'true') return { ...empty, off: true }
  const waitRaw = setting(OFFICE_WAIT_KEY)?.value_num
  const waitMinutes = typeof waitRaw === 'number' && Number.isFinite(waitRaw) ? waitRaw : null

  // The lines in.
  const lineQuery = admin.from('messages').select(LINE_COLUMNS).eq('direction', 'in')
  const { data: lineData } =
    'sweep' in body
      ? await lineQuery.in('channel', [...PUSH_CHANNELS]).gte('at', sweepSince(now, waitMinutes)).order('at', { ascending: false }).limit(NOTIFY_LINES_MAX)
      : await lineQuery.in('id', body.message_ids)
  const lines: PlanLine[] = ((lineData ?? []) as any[]).map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    channel: r.channel,
    direction: r.direction,
    at: r.at,
    body: r.body ?? '',
    subject: r.subject ?? null,
  }))
  if (lines.length === 0) return empty

  // Their contacts, for the kinds that push.
  const contactIds = [...new Set(lines.map((l) => l.contactId))]
  const { data: contactData } = await admin
    .from('contacts')
    .select('id, kind, goes_by, customer_id, customer_contact_person_id, has_user_id, has_how, has_until')
    .in('id', contactIds)
    .in('kind', [...PUSH_KINDS])
  const contactRows = (contactData ?? []) as any[]
  if (contactRows.length === 0) return { ...empty, lines: lines.length }
  const names = await Promise.all(
    contactRows.map(async (c) => {
      const { data } = await admin.rpc('contact_display_name', { p_contact_id: c.id })
      return typeof data === 'string' ? data : ''
    }),
  )
  const contacts: PlanContact[] = contactRows.map((c, i) => ({
    id: c.id,
    kind: c.kind,
    name: names[i] || 'them',
    goesBy: c.goes_by ?? null,
    hasUserId: c.has_user_id ?? null,
    hasHow: c.has_how ?? null,
    hasUntil: c.has_until ?? null,
  }))
  const pushIds = contacts.map((c) => c.id)
  const oldest = Math.min(...lines.map((l) => Date.parse(l.at)))

  const [{ data: outData }, { data: userData }, { data: sentData }, legal, kit] = await Promise.all([
    admin
      .from('messages')
      .select('contact_id, channel, direction, at, who_user_id')
      .in('contact_id', pushIds)
      .eq('direction', 'out')
      .gte('at', new Date(oldest - OUTS_BEFORE_MS).toISOString())
      .limit(2000),
    admin.from('users').select('id, name, role').match(REAL_ACCOUNT).in('role', [...MESSAGES_OFFICE_ROLES, ...MESSAGES_TECH_ROLES]).is('archived_at', null),
    admin.from('notification_history').select('message_id, template_type').in('message_id', lines.map((l) => l.id)),
    legalSendsFor(admin, contactRows.filter((c) => c.kind === 'customer')),
    loadWalkKit(admin),
  ])
  const outs: PlanOut[] = ((outData ?? []) as any[]).map((r) => ({ contactId: r.contact_id, channel: r.channel, direction: r.direction, at: r.at, whoUserId: r.who_user_id ?? null }))
  const users = (userData ?? []) as Array<{ id: string; name: string | null; role: string }>
  const person = (u: { id: string; name: string | null }): PlanUser => ({ id: u.id, name: (u.name ?? '').trim() })

  const plan = planReplyPushes({
    now,
    lines,
    contacts,
    outs,
    techs: users.filter((u) => MESSAGES_TECH_ROLES.includes(u.role)).map(person),
    office: users.filter((u) => MESSAGES_OFFICE_ROLES.includes(u.role)).map(person),
    seats: parseAssignSeats(setting(ASSIGN_RULE_KEY)?.value_text),
    hours: parseOfficeHours(setting(OFFICE_HOURS_KEY)?.value_text),
    waitMinutes,
    legal,
    sent: (sentData ?? []) as Array<{ message_id: string; template_type: 'message_reply' | 'message_reply_wait' }>,
    kit: kit ? { contactId: kit.contactId } : null,
    devs: users.filter((u) => u.role === 'dev').map(person),
  })

  let sent = 0
  let reached = 0
  for (const push of plan.send) {
    const got = await sendPush(push, sendTo)
    if (got.length === 0) continue
    const { error } = await admin.from('notification_history').insert(pushSentRow(push, got))
    if (error) console.error('messages-notify reply push record error', error.message)
    sent++
    reached += got.length
  }
  return { lines: lines.length, sent, reached, waiting: plan.waiting, answered: plan.answered, late: plan.late }
}

/** One push to each of its people; the ones at least one device took. */
async function sendPush(push: Push, sendTo: PushToPerson): Promise<string[]> {
  const payload = JSON.stringify({ title: push.title, body: push.body, url: push.url, tag: push.tag })
  const got: string[] = []
  for (const userId of push.userIds) {
    if ((await sendTo(userId, payload)) > 0) got.push(userId)
  }
  return got
}

/**
 * The Lien desk's sends to each residential customer's contact, from their Pipeline jobs: the owner's copies of each
 * filing and every demand letter that went. A person at a customer reads the customer's.
 */
async function legalSendsFor(admin: any, contacts: any[]): Promise<Record<string, LegalSend[]>> {
  const out: Record<string, LegalSend[]> = {}
  if (contacts.length === 0) return out
  const personIds = contacts.map((c) => c.customer_contact_person_id).filter(Boolean)
  const { data: personData } = personIds.length
    ? await admin.from('customer_contact_persons').select('id, customer_id').in('id', personIds)
    : { data: [] }
  const customerOfPerson = new Map(((personData ?? []) as any[]).map((p) => [p.id, p.customer_id]))
  const customerOf = (c: any): string | null => c.customer_id ?? customerOfPerson.get(c.customer_contact_person_id) ?? null
  const customerIds = [...new Set(contacts.map(customerOf).filter((id): id is string => !!id))]
  if (customerIds.length === 0) return out

  const { data: jobData } = await admin.from('jobs_ledger').select('id, customer_id').in('customer_id', customerIds)
  const jobs = (jobData ?? []) as Array<{ id: string; customer_id: string }>
  if (jobs.length === 0) return out
  const jobIds = jobs.map((j) => j.id)
  const [{ data: filingData }, { data: letterData }] = await Promise.all([
    admin.from('job_lien_filings').select('id, job_id, kind, created_at, filed_at, served_at, voided_at, sends').in('job_id', jobIds),
    admin.from('job_demand_letters').select('id, job_id, created_at, sent_at, sent_method, voided_at').in('job_id', jobIds),
  ])
  const filings = (filingData ?? []) as any[]
  const { data: itemData } = filings.length
    ? await admin.from('job_lien_desk_items').select('sent_filing_id, fields, voided_at').in('sent_filing_id', filings.map((f) => f.id))
    : { data: [] }
  const items = (itemData ?? []) as any[]
  const letters = (letterData ?? []) as any[]

  for (const c of contacts) {
    const customer = customerOf(c)
    if (!customer) continue
    const theirJobs = new Set(jobs.filter((j) => j.customer_id === customer).map((j) => j.id))
    out[c.id] = [
      ...legalSendsFromFilings(
        filings.filter((f) => theirJobs.has(f.job_id)),
        { items, recipient: 'owner' },
      ),
      ...legalSendsFromDemandLetters(letters.filter((d) => theirJobs.has(d.job_id))),
    ]
  }
  return out
}
