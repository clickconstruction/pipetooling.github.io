/**
 * GC mode, Owner Billing's O7c: what a GC job's customer sees and presses in their portal. For each GC project of
 * theirs that we won: the change orders waiting on them, to sign or decline, and the work to accept once every line is
 * billed (gc_record_acceptance's own rule). customer-portal reads the rows (`loadGcPortalJobs`) and draws them
 * (`gcPortalJobs`); submit-portal-request checks a press against the same link (`gcPortalOwns`) and says the
 * database's refusals in the customer's words (`gcPortalRefusalWords`). The pure parts are tested from src.
 */

export type PortalGcChangeOrder = {
  id: string
  number: number
  description: string
  /** What it adds to their price; below zero, a credit. */
  price: number
  /** The working days it adds. */
  days: number
  sentOn: string
}

export type PortalGcJob = {
  projectId: string
  name: string
  /** Sent to them and not yet answered, lowest number first. */
  changeOrders: PortalGcChangeOrder[]
  /** Every line is billed and nothing is accepted yet: Accept the work shows. */
  canAccept: boolean
  /** The day the work was accepted, and whether at the office or here. Null before. */
  accepted: { on: string; how: 'office' | 'portal' } | null
}

export type GcPortalRows = {
  projects: { id: string; name: string; customer_id: string | null }[]
  gc: { project_id: string; stage: string }[]
  changeOrders: { id: string; project_id: string; number: number; description: string; price: number | string; days: number; sent_on: string | null; status: string }[]
  acceptances: { project_id: string; accepted_on: string; how: string }[]
  /** Each project's pay applications: its number, whether final, and its work so far. */
  payApps: { project_id: string; number: number; final: boolean; work_to_date: number | string }[]
  /** Our price with the customer today, by project (gc_owner_contract_now). */
  contractNow: Record<string, number>
}

/** The stages of a job we won, as the board stages them. */
const WON = new Set(['buyout', 'building', 'closed'])

/** Every line billed: the last progress pay application's work so far covers the price today (half a dollar's slack). */
function everyLineBilled(rows: GcPortalRows, projectId: string): boolean {
  const progress = rows.payApps.filter((a) => a.project_id === projectId && !a.final).sort((a, b) => b.number - a.number)[0]
  const contract = rows.contractNow[projectId]
  return progress !== undefined && contract !== undefined && Number(progress.work_to_date) >= contract - 0.5
}

/** The customer's GC jobs we won, each with something to show: a change order to answer, the work to accept, or the acceptance. */
export function gcPortalJobs(rows: GcPortalRows, customerId: string): PortalGcJob[] {
  const won = new Set(rows.gc.filter((g) => WON.has(g.stage)).map((g) => g.project_id))
  return rows.projects
    .filter((p) => p.customer_id === customerId && won.has(p.id))
    .map((p): PortalGcJob => {
      const acceptance = rows.acceptances.find((a) => a.project_id === p.id)
      return {
        projectId: p.id,
        name: p.name,
        changeOrders: rows.changeOrders
          .filter((c) => c.project_id === p.id && c.status === 'sent' && c.sent_on !== null)
          .sort((a, b) => a.number - b.number)
          .map((c) => ({ id: c.id, number: c.number, description: c.description.trim(), price: Number(c.price), days: c.days, sentOn: c.sent_on ?? '' })),
        canAccept: !acceptance && everyLineBilled(rows, p.id),
        accepted: acceptance ? { on: acceptance.accepted_on, how: acceptance.how === 'portal' ? 'portal' : 'office' } : null,
      }
    })
    .filter((j) => j.changeOrders.length > 0 || j.canAccept || j.accepted !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** A press is the link's: the project is this customer's. */
export function gcPortalOwns(project: { customer_id: string | null } | null | undefined, customerId: string): boolean {
  return Boolean(project && project.customer_id && project.customer_id === customerId)
}

/** The database's refusals, which speak to the office, in the customer's words. */
export function gcPortalRefusalWords(message: string): string {
  if (/is not waiting on the customer/.test(message)) return 'That change order is already answered.'
  if (/They accepted the work on/.test(message)) return 'The work is already accepted.'
  if (/Bill every line first/.test(message)) return 'The work can be accepted once every line of it is billed.'
  if (/Keep the reason to one short line/.test(message)) return 'Keep the reason to one short line.'
  if (/Only a job we won/.test(message)) return 'That job cannot be accepted here.'
  return 'Something went wrong. Please try again, or call our office.'
}

// deno-lint-ignore no-explicit-any
type Admin = any

/** The rows for one customer's GC jobs, read as the service role. Nothing on a failed read: the statement still shows. */
export async function loadGcPortalJobs(admin: Admin, customerId: string): Promise<PortalGcJob[]> {
  try {
    const { data: projects } = await admin.from('projects').select('id, name, customer_id').eq('customer_id', customerId)
    const ids = ((projects ?? []) as GcPortalRows['projects']).map((p) => p.id)
    if (ids.length === 0) return []
    const { data: gc } = await admin.from('gc_projects').select('project_id, stage').in('project_id', ids)
    const won = ((gc ?? []) as GcPortalRows['gc']).filter((g) => WON.has(g.stage)).map((g) => g.project_id)
    if (won.length === 0) return []
    const [changeOrders, acceptances, payApps] = await Promise.all([
      admin.from('gc_change_orders').select('id, project_id, number, description, price, days, sent_on, status').in('project_id', won).eq('status', 'sent'),
      admin.from('gc_owner_acceptances').select('project_id, accepted_on, how').in('project_id', won),
      admin.from('gc_owner_pay_apps').select('project_id, number, final, work_to_date').in('project_id', won),
    ])
    const contractNow: Record<string, number> = {}
    for (const id of won) {
      const { data } = await admin.rpc('gc_owner_contract_now', { p_project_id: id })
      if (data !== null && data !== undefined) contractNow[id] = Number(data)
    }
    return gcPortalJobs(
      {
        projects: (projects ?? []) as GcPortalRows['projects'],
        gc: (gc ?? []) as GcPortalRows['gc'],
        changeOrders: (changeOrders.data ?? []) as GcPortalRows['changeOrders'],
        acceptances: (acceptances.data ?? []) as GcPortalRows['acceptances'],
        payApps: (payApps.data ?? []) as GcPortalRows['payApps'],
        contractNow,
      },
      customerId,
    )
  } catch (e) {
    console.error('loadGcPortalJobs', e)
    return []
  }
}
