/**
 * Messages, cut 8e: a customer's thread as their page reads it and writes to it. One customer, one thread, on the
 * page's contact: the customer's own row in `contacts` (customer_id set, name null), else the first person at that
 * customer in the seed's order (the lead's rule for the page's contact).
 *
 * - **Read**: a line is theirs to see only when it went between us and them by text, email or their page
 *   (`direction` in or out, `channel` text, email or portal) and, when it is tied to a job, the job is one of theirs.
 *   A team note or event, a call, a voicemail and a missed call never leave here, nor a line's who_user_id, a text's
 *   subject, its opt-out line, a note's back day or its step. Of ours, only the writer's first name passes.
 * - **Write**: their line from the page, on that contact and tied to the job of the page they wrote on. The service role
 *   writes it; `submit-portal-request` checks the link first, as every portal write does. A customer with no contact
 *   yet gets their own row, the one the seed makes for a customer with nobody named.
 *
 * Pure but for `loadPortalThread` and `writePortalLine`; vitest imports the rest (`src/lib/portal/portalThread.test.ts`).
 */

/** One line of their thread, as their page draws it. */
export type PortalThreadLine = {
  id: string
  at: string
  /** in: from them. out: from us. */
  dir: 'in' | 'out'
  /** How it came: their page, a text or an email. */
  door: 'portal' | 'text' | 'email'
  /** Who of ours wrote an out line, by first name; null on theirs or when the line names nobody. */
  who: string | null
  /** An email's subject; null on a text or a line from their page. */
  subject: string | null
  body: string
}

/** A `messages` row, as the read selects it. */
export type ThreadRow = {
  id: string
  channel: string
  direction: string
  project_id: string | null
  bid_id: string | null
  jobs_ledger_id: string | null
  who_text: string | null
  at: string
  subject: string | null
  body: string | null
}

/** The jobs a customer has with us, by kind: a line tied to any other job is not theirs. */
export type TheirJobs = { projects: ReadonlySet<string>; bids: ReadonlySet<string>; ledger: ReadonlySet<string> }

const DOORS: ReadonlySet<string> = new Set(['portal', 'text', 'email'])

/** How many lines the page reads, newest kept. */
export const THREAD_LINES = 100

/** The most lines from their page in an hour; past it the page asks them to call. */
export const PORTAL_LINES_PER_HOUR = 20

/** The longest line their page sends. */
export const PORTAL_LINE_MAX = 2000

/** Whether a row is theirs to see: between us and them by text, email or their page, and on no job but theirs. */
export function isTheirLine(row: ThreadRow, jobs: TheirJobs): boolean {
  if (row.direction !== 'in' && row.direction !== 'out') return false
  if (!DOORS.has(row.channel)) return false
  if (row.project_id) return jobs.projects.has(row.project_id)
  if (row.bid_id) return jobs.bids.has(row.bid_id)
  if (row.jobs_ledger_id) return jobs.ledger.has(row.jobs_ledger_id)
  return true
}

/** Their thread, oldest first, the newest `THREAD_LINES` of it, with nothing of ours but the writer's first name. */
export function portalThreadLines(rows: readonly ThreadRow[], jobs: TheirJobs): PortalThreadLine[] {
  return rows
    .filter((r) => isTheirLine(r, jobs))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .slice(-THREAD_LINES)
    .map((r) => {
      const dir = r.direction as 'in' | 'out'
      const first = dir === 'out' ? ((r.who_text ?? '').split(' · ')[0] ?? '').trim().split(/\s+/)[0] ?? '' : ''
      return {
        id: r.id,
        at: r.at,
        dir,
        door: r.channel as PortalThreadLine['door'],
        who: first || null,
        subject: r.channel === 'email' && r.subject?.trim() ? r.subject.trim() : null,
        body: r.body ?? '',
      }
    })
}

/** The page's contact: the customer's own row, else the first person at that customer in the seed's order. */
export function pageContactOf(own: { id: string } | null, persons: readonly { id: string; created_at: string }[]): string | null {
  if (own) return own.id
  const first = [...persons].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0]
  return first?.id ?? null
}

// deno-lint-ignore no-explicit-any
type Admin = any

const rowsOf = (r: { data: unknown }): Record<string, unknown>[] => (Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [])
const ids = (rows: Record<string, unknown>[], f = 'id'): string[] => [...new Set(rows.map((r) => String(r[f] ?? '')).filter(Boolean))]

/** The page's contact for a customer, by the rule above; null when the customer has none yet. */
export async function findPageContact(admin: Admin, customerId: string): Promise<string | null> {
  const own = (await admin.from('contacts').select('id').eq('customer_id', customerId).is('name', null).maybeSingle()).data as { id: string } | null
  if (own) return own.id
  const people = ids(rowsOf(await admin.from('customer_contact_persons').select('id').eq('customer_id', customerId)))
  if (!people.length) return null
  const persons = rowsOf(await admin.from('contacts').select('id, created_at').in('customer_contact_person_id', people)) as { id: string; created_at: string }[]
  return pageContactOf(null, persons)
}

/** Their thread for their page; [] when they have no contact yet. */
export async function loadPortalThread(admin: Admin, customerId: string): Promise<PortalThreadLine[]> {
  const contactId = await findPageContact(admin, customerId)
  if (!contactId) return []
  const rows = rowsOf(
    await admin
      .from('messages')
      .select('id, channel, direction, project_id, bid_id, jobs_ledger_id, who_text, at, subject, body')
      .eq('contact_id', contactId)
      .in('direction', ['in', 'out'])
      .in('channel', [...DOORS])
      .order('at', { ascending: false })
      .limit(THREAD_LINES * 2),
  ) as ThreadRow[]
  // Each job a line is tied to is checked against the customer's own: a project, a bid or a Pipeline job of theirs.
  const want = (f: 'project_id' | 'bid_id' | 'jobs_ledger_id') => [...new Set(rows.map((r) => r[f]).filter((x): x is string => !!x))]
  const theirs = async (table: string, refs: string[]): Promise<Set<string>> =>
    refs.length ? new Set(ids(rowsOf(await admin.from(table).select('id').in('id', refs).eq('customer_id', customerId)))) : new Set()
  const [projects, bids, ledger] = await Promise.all([theirs('projects', want('project_id')), theirs('bids', want('bid_id')), theirs('jobs_ledger', want('jobs_ledger_id'))])
  return portalThreadLines(rows, { projects, bids, ledger })
}

export type PortalLineResult = { ok: true; line: PortalThreadLine } | { ok: false; key: 'notTheirs' | 'tooMany' | 'failed' }

/**
 * Their line from the page, on the page's contact and tied to the job they wrote on (one of their GC projects, else
 * none). At most `PORTAL_LINES_PER_HOUR` an hour. The caller has checked the link and the text.
 */
export async function writePortalLine(admin: Admin, input: { customerId: string; projectId: string | null; text: string }): Promise<PortalLineResult> {
  if (input.projectId) {
    const project = (await admin.from('projects').select('id').eq('id', input.projectId).eq('customer_id', input.customerId).maybeSingle()).data
    const gc = project ? (await admin.from('gc_projects').select('project_id').eq('project_id', input.projectId).maybeSingle()).data : null
    if (!gc) return { ok: false, key: 'notTheirs' }
  }
  let contactId = await findPageContact(admin, input.customerId)
  if (!contactId) {
    // Two first lines at once both make the row; the one that loses reads the winner's.
    const made = await admin.from('contacts').insert({ kind: 'customer', customer_id: input.customerId }).select('id').single()
    contactId = made.error || !made.data ? await findPageContact(admin, input.customerId) : String((made.data as { id: string }).id)
    if (!contactId) return { ok: false, key: 'failed' }
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('channel', 'portal')
    .eq('direction', 'in')
    .gte('at', since)
  if ((recent.count ?? 0) >= PORTAL_LINES_PER_HOUR) return { ok: false, key: 'tooMany' }
  const wrote = await admin
    .from('messages')
    .insert({ contact_id: contactId, project_id: input.projectId, channel: 'portal', direction: 'in', body: input.text })
    .select('id, at')
    .single()
  if (wrote.error || !wrote.data) return { ok: false, key: 'failed' }
  const row = wrote.data as { id: string; at: string }
  return { ok: true, line: { id: row.id, at: row.at, dir: 'in', door: 'portal', who: null, subject: null, body: input.text } }
}
