/**
 * Punch list #205, row 2 (PR 5): a trade partner company's thread as its portal reads it and writes to it, the shape of
 * the customer's (`gcPortalThread.ts`) keyed by the company. One company, one thread, on the company's own contact row
 * (`contacts` with `gc_company_id` set and `name` null, the row the trade flow reads).
 *
 * - **Read**: a line is the company's to see only when it went between us and the company by text, email or its portal
 *   (`direction` in or out, `channel` text, email or portal) and, when it is tied to a job, the job is one the company has
 *   an invite on. A line tied to a bid or a Pipeline job is never a trade's. A team note or event, a call, a voicemail
 *   and a missed call never leave here, nor a line's who_user_id, a text's subject, its opt-out line, a note's back day
 *   or its step. Of ours, only the writer's first name passes.
 * - **Write**: the company's line from its portal, on that contact and tied to the job it picked (one of its own, else
 *   none). The service role writes it; `submit-gc-trade-portal` checks the link first, as every portal write does. A
 *   company with no contact yet gets its own row.
 *
 * Pure but for `findTradeContact`, `loadTradeThread` and `writeTradeLine`; vitest imports the rest
 * (`src/lib/gc/tradeThread.test.ts`).
 */
import type { PortalThreadLine, ThreadRow } from './gcPortalThread.ts'

export type { PortalThreadLine, ThreadRow }

const DOORS: ReadonlySet<string> = new Set(['portal', 'text', 'email'])

/** How many lines the portal reads, newest kept. */
export const TRADE_THREAD_LINES = 200

/** The most lines from the portal in an hour; past it the page asks the company to call. The customer's cap. */
export const TRADE_PORTAL_LINES_PER_HOUR = 20

/** The longest line the portal sends. */
export const TRADE_PORTAL_LINE_MAX = 2000

/** Whether a row is the company's to see: between us and it by text, email or its portal, and on no job but its own. */
export function isTradeLine(row: ThreadRow, projects: ReadonlySet<string>): boolean {
  if (row.direction !== 'in' && row.direction !== 'out') return false
  if (!DOORS.has(row.channel)) return false
  if (row.bid_id || row.jobs_ledger_id) return false
  if (row.project_id) return projects.has(row.project_id)
  return true
}

/** The company's thread, oldest first, the newest `TRADE_THREAD_LINES` of it, with nothing of ours but the writer's first name. */
export function tradeThreadLines(rows: readonly ThreadRow[], projects: ReadonlySet<string>): PortalThreadLine[] {
  return rows
    .filter((r) => isTradeLine(r, projects))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .slice(-TRADE_THREAD_LINES)
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

// deno-lint-ignore no-explicit-any
type Admin = any

const rowsOf = (r: { data: unknown }): Record<string, unknown>[] => (Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [])
const ids = (rows: Record<string, unknown>[], f = 'id'): string[] => [...new Set(rows.map((r) => String(r[f] ?? '')).filter(Boolean))]

/** The company's own contact row, as the trade flow reads it; null when it has none yet. */
export async function findTradeContact(admin: Admin, companyId: string): Promise<string | null> {
  const own = (await admin.from('contacts').select('id').eq('gc_company_id', companyId).is('name', null).maybeSingle()).data as { id: string } | null
  return own?.id ?? null
}

/** The projects the company has an invite on: a line tied to any other job is not its. */
export async function tradeProjects(admin: Admin, companyId: string): Promise<Set<string>> {
  const invites = rowsOf(await admin.from('gc_invites').select('package_id').eq('company_id', companyId))
  const packageIds = ids(invites, 'package_id')
  if (packageIds.length === 0) return new Set()
  const packages = rowsOf(await admin.from('gc_trade_packages').select('project_id').in('id', packageIds))
  return new Set(ids(packages, 'project_id'))
}

/** The company's thread for its portal; [] when it has no contact yet. */
export async function loadTradeThread(admin: Admin, companyId: string): Promise<PortalThreadLine[]> {
  const contactId = await findTradeContact(admin, companyId)
  if (!contactId) return []
  const [rows, projects] = await Promise.all([
    admin
      .from('messages')
      .select('id, channel, direction, project_id, bid_id, jobs_ledger_id, who_text, at, subject, body')
      .eq('contact_id', contactId)
      .in('direction', ['in', 'out'])
      .in('channel', [...DOORS])
      .order('at', { ascending: false })
      .limit(TRADE_THREAD_LINES * 2)
      .then(rowsOf) as Promise<ThreadRow[]>,
    tradeProjects(admin, companyId),
  ])
  return tradeThreadLines(rows, projects)
}

export type TradeLineResult = { ok: true; line: PortalThreadLine } | { ok: false; key: 'notYours' | 'tooMany' | 'failed' }

/**
 * The company's line from its portal, on its contact and tied to the job it picked (one it has an invite on, else none).
 * At most `TRADE_PORTAL_LINES_PER_HOUR` an hour. The caller has checked the link and the text.
 */
export async function writeTradeLine(admin: Admin, input: { companyId: string; projectId: string | null; text: string }): Promise<TradeLineResult> {
  if (input.projectId) {
    const projects = await tradeProjects(admin, input.companyId)
    if (!projects.has(input.projectId)) return { ok: false, key: 'notYours' }
  }
  let contactId = await findTradeContact(admin, input.companyId)
  if (!contactId) {
    // Two first lines at once both make the row; the one that loses reads the winner's.
    const made = await admin.from('contacts').insert({ kind: 'trade', gc_company_id: input.companyId }).select('id').single()
    contactId = made.error || !made.data ? await findTradeContact(admin, input.companyId) : String((made.data as { id: string }).id)
    if (!contactId) return { ok: false, key: 'failed' }
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('contact_id', contactId).eq('channel', 'portal').eq('direction', 'in').gte('at', since)
  if ((recent.count ?? 0) >= TRADE_PORTAL_LINES_PER_HOUR) return { ok: false, key: 'tooMany' }
  const wrote = await admin
    .from('messages')
    .insert({ contact_id: contactId, project_id: input.projectId, channel: 'portal', direction: 'in', body: input.text })
    .select('id, at')
    .single()
  if (wrote.error || !wrote.data) return { ok: false, key: 'failed' }
  const row = wrote.data as { id: string; at: string }
  return { ok: true, line: { id: row.id, at: row.at, dir: 'in', door: 'portal', who: null, subject: null, body: input.text } }
}
