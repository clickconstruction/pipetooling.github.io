/**
 * Messages, cut 8b-i (the portals): what the customer's page (shape B, `to-dos/gc-mode/messages/BUILD_PLAN.md` on branch
 * spike/gc-mode) reads for each GC job beyond the job's own block in `gcPortal.ts`: the money for Money (our contract's
 * sum, the change orders, the pay applications), this week's line from the daily log, the people to call, the
 * schedule's moves since the schedule went, and the three switches the office keeps per job. `customer-portal` lays
 * `page` on each job after `loadGcPortalJobs`, as it lays the schedule; the page runs the kernels (`src/lib/portal/`).
 *
 * Nothing of ours: no trade names, no costs, no office notes (a move reads by its reason, never its note; the daily log
 * by its customer line, never the superintendent's own words). The photos link shows only while the job's photos switch
 * is on. A failed read leaves `page` off, so a function deployed before its columns (20261012130000, 20261012200000)
 * reads the page as it did. Pure but for the loader.
 */
import type { PortalGcJob } from './gcPortal.ts'

/** A change order on the page: one waiting on them, or one they signed. */
export type PortalGcPageChange = {
  id: string
  number: number
  description: string
  descriptionEs: string | null
  /** What it adds to the sum; below zero, a credit. */
  price: number
  days: number
  state: 'signed' | 'open'
  signedOn: string | null
}

/** A pay application that went to them. Paid or not is read from its bill on the statement. */
export type PortalGcPagePayApp = {
  id: string
  number: number
  final: boolean
  /** The last day of the work it bills; its month is the card's. */
  periodTo: string
  sentOn: string
  /** What it asks, in dollars. */
  due: number
  certifiedOn: string | null
  /** The bill it went on (`jobs_ledger_invoices`), for paid and the day. */
  invoiceId: string | null
  customerLine: string | null
  customerLineEs: string | null
}

/** A move of the schedule since it went, by its reason; never the office's note. */
export type PortalGcPageMove = { activity: string; madeOn: string; from: string; to: string; reason: string }

export type PortalGcPage = {
  /** Our contract's sum before any change: the contract's lines (`gc_owner_contract_now` less the signed changes). */
  contract: number
  contractSignedOn: string | null
  /** Their architect, by the record's name; null when none is on the job. */
  architect: string | null
  /** The days to pay after the certificate, from the job's terms. */
  payDays: number | null
  changes: PortalGcPageChange[]
  payApps: PortalGcPagePayApp[]
  /** The newest customer line on the daily log, with the log's photos link while the photos switch is on. */
  week: { on: string; line: string; lineEs: string | null; photosUrl: string | null } | null
  /** The project manager and the superintendent, by name, with a phone when their record has one. */
  people: { role: 'pm' | 'super'; name: string; phone: string | null }[]
  moves: PortalGcPageMove[]
  switches: { photos: boolean; forecast: boolean; spanish: boolean }
}

/** The rows the page is drawn from, as `loadGcPortalPages` selects them for the jobs. */
export type GcPortalPageRows = {
  terms: {
    project_id: string
    owner_pay_days: number | null
    owner_contract_signed_on: string | null
    architect_customer_id: string | null
    project_manager_user_id: string | null
    superintendent_user_id: string | null
    portal_photos_on: boolean
    portal_forecast_on: boolean
    portal_spanish_on: boolean
  }[]
  /** Our price with the customer today, by project (`gc_owner_contract_now`: the contract's lines plus the signed changes). */
  contractNow: Record<string, number>
  contractSends: { project_id: string; signed_on: string | null; created_at: string }[]
  changeOrders: { id: string; project_id: string; number: number; description: string; description_es: string | null; price: number | string; days: number; status: string; answered_on: string | null }[]
  payApps: {
    id: string
    project_id: string
    number: number
    final: boolean
    period_to: string
    sent_on: string
    due: number | string
    certified_on: string | null
    invoice_id: string | null
    customer_line: string | null
    customer_line_es: string | null
  }[]
  architects: { id: string; name: string }[]
  users: { id: string; name: string | null; phone: string | null }[]
  logs: { project_id: string; log_date: string; customer_line: string | null; customer_line_es: string | null; photos_url: string | null }[]
  scheduleSends: { project_id: string; sent_on: string }[]
  moves: { project_id: string; activity_name: string; made_on: string; from_start: string; to_start: string; reason: string; undone_on: string | null }[]
}

const num = (v: number | string | null | undefined): number => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v))

/** One job's page. Null when its terms are not read (not a GC job of theirs). */
export function gcPortalPage(rows: GcPortalPageRows, projectId: string): PortalGcPage | null {
  const terms = rows.terms.find((t) => t.project_id === projectId)
  if (!terms) return null
  const switches = { photos: terms.portal_photos_on === true, forecast: terms.portal_forecast_on === true, spanish: terms.portal_spanish_on === true }
  const changes: PortalGcPageChange[] = rows.changeOrders
    .filter((c) => c.project_id === projectId && (c.status === 'signed' || c.status === 'sent'))
    .sort((a, b) => a.number - b.number)
    .map((c) => ({
      id: c.id,
      number: c.number,
      description: c.description.trim(),
      descriptionEs: c.description_es?.trim() || null,
      price: num(c.price),
      days: c.days,
      state: c.status === 'signed' ? 'signed' : 'open',
      signedOn: c.status === 'signed' ? c.answered_on : null,
    }))
  const signedSum = changes.filter((c) => c.state === 'signed').reduce((a, c) => a + c.price, 0)
  const newestSend = rows.contractSends.filter((s) => s.project_id === projectId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const person = (id: string | null, role: 'pm' | 'super') => {
    const u = id ? rows.users.find((x) => x.id === id) : undefined
    return u?.name?.trim() ? [{ role, name: u.name.trim(), phone: u.phone?.trim() || null }] : []
  }
  const log = rows.logs
    .filter((l) => l.project_id === projectId && l.customer_line && l.customer_line.trim())
    .sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
  const firstSend = rows.scheduleSends
    .filter((s) => s.project_id === projectId)
    .map((s) => s.sent_on)
    .sort()[0]
  return {
    contract: Math.max(0, (rows.contractNow[projectId] ?? 0) - signedSum),
    contractSignedOn: newestSend?.signed_on ?? terms.owner_contract_signed_on,
    architect: rows.architects.find((a) => a.id === terms.architect_customer_id)?.name?.trim() || null,
    payDays: terms.owner_pay_days,
    changes,
    payApps: rows.payApps
      .filter((a) => a.project_id === projectId)
      .sort((a, b) => a.number - b.number)
      .map((a) => ({
        id: a.id,
        number: a.number,
        final: a.final,
        periodTo: a.period_to,
        sentOn: a.sent_on,
        due: num(a.due),
        certifiedOn: a.certified_on,
        invoiceId: a.invoice_id,
        customerLine: a.customer_line?.trim() || null,
        customerLineEs: a.customer_line_es?.trim() || null,
      })),
    week: log
      ? { on: log.log_date, line: (log.customer_line ?? '').trim(), lineEs: log.customer_line_es?.trim() || null, photosUrl: switches.photos ? log.photos_url : null }
      : null,
    people: [...person(terms.project_manager_user_id, 'pm'), ...person(terms.superintendent_user_id, 'super')],
    moves: firstSend
      ? rows.moves
          .filter((m) => m.project_id === projectId && !m.undone_on && m.made_on >= firstSend)
          .sort((a, b) => a.made_on.localeCompare(b.made_on))
          .map((m) => ({ activity: m.activity_name, madeOn: m.made_on, from: m.from_start, to: m.to_start, reason: m.reason }))
      : [],
    switches,
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any

/** Every sentence of ours on the customer's page as the office keeps it (`customer_page_words`); [] when none is read. */
export async function loadCustomerPageWords(admin: Admin): Promise<{ key: string; en: string; es: string }[]> {
  try {
    const { data, error } = await admin.from('customer_page_words').select('key, en, es')
    return error ? [] : ((data ?? []) as { key: string; en: string; es: string }[])
  } catch {
    return []
  }
}

/** Lays `page` on each job. A failed read leaves every job as it was. */
export async function loadGcPortalPages(admin: Admin, jobs: PortalGcJob[]): Promise<void> {
  const ids = jobs.map((j) => j.projectId)
  if (ids.length === 0) return
  try {
    const must = <T>(r: { data: T | null; error: unknown }): T => {
      if (r.error) throw r.error
      return (r.data ?? []) as T
    }
    const [terms, sends, changeOrders, payApps, logs, scheduleSends, moves] = await Promise.all([
      admin
        .from('gc_projects')
        .select('project_id, owner_pay_days, owner_contract_signed_on, architect_customer_id, project_manager_user_id, superintendent_user_id, portal_photos_on, portal_forecast_on, portal_spanish_on')
        .in('project_id', ids),
      admin.from('gc_owner_contract_sends').select('project_id, signed_on, created_at').in('project_id', ids),
      admin.from('gc_change_orders').select('id, project_id, number, description, description_es, price, days, status, answered_on').in('project_id', ids).in('status', ['sent', 'signed']),
      admin
        .from('gc_owner_pay_apps')
        .select('id, project_id, number, final, period_to, sent_on, due, certified_on, invoice_id, customer_line, customer_line_es')
        .in('project_id', ids),
      admin
        .from('gc_daily_logs')
        .select('project_id, log_date, customer_line, customer_line_es, photos_url')
        .in('project_id', ids)
        .not('customer_line', 'is', null)
        .order('log_date', { ascending: false })
        .limit(50),
      admin.from('gc_schedule_sends').select('project_id, sent_on').in('project_id', ids),
      admin.from('gc_schedule_moves').select('project_id, activity_name, made_on, from_start, to_start, reason, undone_on').in('project_id', ids),
    ])
    const termRows = must<GcPortalPageRows['terms']>(terms)
    const architectIds = termRows.map((t) => t.architect_customer_id).filter((x): x is string => !!x)
    const userIds = termRows.flatMap((t) => [t.project_manager_user_id, t.superintendent_user_id]).filter((x): x is string => !!x)
    const [architects, users] = await Promise.all([
      architectIds.length ? admin.from('customers').select('id, name').in('id', architectIds) : Promise.resolve({ data: [], error: null }),
      userIds.length ? admin.from('users').select('id, name, phone').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    ])
    const contractNow: Record<string, number> = {}
    for (const id of ids) {
      const { data } = await admin.rpc('gc_owner_contract_now', { p_project_id: id })
      if (data !== null && data !== undefined) contractNow[id] = Number(data)
    }
    const rows: GcPortalPageRows = {
      terms: termRows,
      contractNow,
      contractSends: must(sends),
      changeOrders: must(changeOrders),
      payApps: must(payApps),
      architects: must(architects),
      users: must(users),
      logs: must(logs),
      scheduleSends: must(scheduleSends),
      moves: must(moves),
    }
    for (const job of jobs) {
      const page = gcPortalPage(rows, job.projectId)
      if (page) job.page = page
    }
  } catch (e) {
    console.error('loadGcPortalPages', e)
  }
}
