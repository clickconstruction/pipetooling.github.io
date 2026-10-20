/**
 * A round window's detail from the GC projects page's own state (Messages cut 4): the flow panel opens a round with the
 * person's reading only, since `flow_rows` carries days and marks, so the page fills in the change order or the pay
 * application it is about. A change order is matched by the round's key (its id), a pay application by its number.
 * The money (what it adds, the sum after, the amount) only for a reader who may see it.
 */
import { ownerContractWorthOf } from '../gc/ownerBilling'
import type { GcProject } from '../gc/types'
import { shortDate } from '../gc/words'
import type { ChangeOrderDetail, PayAppDetail } from './roundWindow'
import type { FlowStep, RoundReading } from './state'

export function roundDetailFromProject(
  project: GcProject | undefined,
  step: Pick<FlowStep, 'facts'>,
  round: Pick<RoundReading, 'key' | 'name'>,
  canSeeMoney: boolean,
): { changeOrder?: ChangeOrderDetail; payApp?: PayAppDetail } {
  if (!project) return {}
  if (step.facts.includes('co_answered')) {
    const co = project.changeOrders?.find((c) => c.id === round.key)
    if (!co) return {}
    const signedBefore = (project.changeOrders ?? []).filter((c) => c.status === 'signed' && c.id !== co.id).reduce((sum, c) => sum + c.price, 0)
    const contract = Object.values(ownerContractWorthOf(project)).reduce((sum, v) => sum + v, 0)
    return {
      changeOrder: {
        what: co.description,
        adds: canSeeMoney ? co.price : null,
        days: co.schedule && co.schedule !== 'none' ? co.schedule : null,
        sumBefore: canSeeMoney ? contract + signedBefore : null,
        sentOn: co.sentOn,
        openedOn: null,
      },
    }
  }
  if (step.facts.includes('payapp_paid')) {
    const n = Number(/\d+/.exec(round.name)?.[0])
    const a = project.ownerBilling?.payApps?.find((p) => p.number === n)
    if (!a) return {}
    const architect = project.architect || 'the architect'
    return {
      payApp: {
        covers: `work through ${shortDate(a.periodTo)}`,
        amount: canSeeMoney ? a.due : null,
        certifiedBy: a.certifiedOn ? architect : null,
        certifiedOn: a.certifiedOn ?? null,
        withArchitect: a.certified === null ? { name: architect, since: a.sentOn } : null,
        paidOn: a.paidOn,
        waivers: null,
        tradesPaidOn: null,
      },
    }
  }
  return {}
}
