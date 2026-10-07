/**
 * GC mode, the real build: a project's change orders and their days, moved word for word from the GC
 * mode prototype (branch spike/gc-mode, `gcOwnerBilling.ts`) by the schedule's PR 1a, which reads them.
 * The Owner Billing lane's lift (O2) adds the rest of `gcOwnerBilling.ts` here.
 */
import type { ChangeOrder, GcProject } from './types'

export function projectChangeOrders(project: GcProject): ChangeOrder[] {
  return project.changeOrders ?? []
}

export function signedChangeOrders(project: GcProject): ChangeOrder[] {
  return projectChangeOrders(project).filter((co) => co.status === 'signed')
}

/** The days a change order adds to the job. 0: none, or only said in its schedule words. */
export function changeOrderDays(co: ChangeOrder): number {
  return co.days ?? 0
}

/** The days the owner's signed change orders add to the contract time, added up. */
export function contractDaysAdded(project: GcProject): number {
  return signedChangeOrders(project).reduce((t, co) => t + changeOrderDays(co), 0)
}
