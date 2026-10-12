/**
 * Messages, cut 1's screens: the jobs a person is on by the facts, beside the ones the office tied them to. A customer's
 * GC projects in each of its three roles (the owner we build for, the property owner, the architect) and a trade
 * partner's asks (`gc_invites` through its packages) put a job on the rail without anyone tying it. Pure.
 *
 * The rail reads the office's ties first, in the order they were added, then the facts' jobs. The star stays on a tie:
 * starring a job the facts give ties it first (`set_default_job` does both).
 */
import type { Contact } from '../contacts/kernel'
import { jobKey } from './load'

/** A GC project and the customers it names, by role. */
export interface ProjectRolesRow {
  project_id: string
  customer_id: string | null
  property_owner_customer_id: string | null
  architect_customer_id: string | null
}

/** A trade partner's ask: the company and the project its package is on. */
export interface InviteJobRow {
  company_id: string
  project_id: string
}

/** Each contact's jobs by the facts, as keys, through the customer or the trade partner they are or are at. */
export function factJobKeys(
  contacts: readonly Pick<Contact, 'id' | 'customerId' | 'gcCompanyId'>[],
  rows: { projects?: readonly ProjectRolesRow[]; invites?: readonly InviteJobRow[] },
): Record<string, string[]> {
  const byCustomer = new Map<string, string[]>()
  for (const p of rows.projects ?? []) {
    for (const id of [p.customer_id, p.property_owner_customer_id, p.architect_customer_id]) {
      if (!id) continue
      const keys = byCustomer.get(id) ?? []
      const key = jobKey({ kind: 'project', id: p.project_id })
      if (!keys.includes(key)) byCustomer.set(id, [...keys, key])
    }
  }
  const byCompany = new Map<string, string[]>()
  for (const i of rows.invites ?? []) {
    const keys = byCompany.get(i.company_id) ?? []
    const key = jobKey({ kind: 'project', id: i.project_id })
    if (!keys.includes(key)) byCompany.set(i.company_id, [...keys, key])
  }
  return Object.fromEntries(
    contacts.map((c) => [
      c.id,
      [...(c.customerId ? (byCustomer.get(c.customerId) ?? []) : []), ...(c.gcCompanyId ? (byCompany.get(c.gcCompanyId) ?? []) : [])],
    ]),
  )
}

/** The rail: the office's ties in their order, then the facts' jobs not tied. */
export function railJobKeys(c: Pick<Contact, 'jobIds'>, facts: readonly string[] = []): string[] {
  return [...c.jobIds, ...facts.filter((k, i) => !c.jobIds.includes(k) && facts.indexOf(k) === i)]
}
