/**
 * The Costs tab inside the job window reads the job as it was loaded; the form beside it holds
 * what the office has typed since, and saves it by itself. These two put the form's own price
 * and other job charges over the loaded ones, so the tab says what the Bill tab says without
 * the window being closed and opened again.
 */
import { buildJobChargeEvents, type JobChargeEvent } from '../jobChargesTimeline'

/** What the open form holds, in the shape the Costs tab reads. */
export type JobCostsLiveValues = {
  /** The Job Total with riders — what the form shows and the billing slice saves as revenue. */
  priceUsd: number
  otherCharges: Array<{ dateKey: string | null; amount: number; description: string | null }>
}

/**
 * The form's other job charges as the Costs tab's rows: only the rows autosave would save (a
 * description or an amount), each dated as the loaded row of the same id was, or today when the
 * row is new to this form.
 */
export function liveOtherCharges(
  formRows: ReadonlyArray<{ id: string; description: string; amount: number }>,
  loadedRows: ReadonlyArray<{ id: string; dateKey: string | null }>,
  todayYmd: string,
): JobCostsLiveValues['otherCharges'] {
  const loadedDate = new Map(loadedRows.map((r) => [r.id, r.dateKey]))
  return formRows
    .filter((m) => (m.description ?? '').trim() !== '' || Number(m.amount) !== 0)
    .map((m) => ({
      dateKey: loadedDate.has(m.id) ? (loadedDate.get(m.id) ?? null) : todayYmd,
      amount: Number(m.amount ?? 0),
      description: m.description.trim() || null,
    }))
}

/**
 * The loaded inputs with the form's price and other charges in place of the loaded ones. Every
 * other cost — labor, supply houses, card charges, tally parts — is left as it was read. With no
 * live values the inputs come back untouched.
 */
export function withLiveJobFormValues<T extends { revenue: number | null; chargeEvents: JobChargeEvent[] }>(inputs: T, live: JobCostsLiveValues | null | undefined): T {
  if (!live) return inputs
  const kept = inputs.chargeEvents.filter((e) => e.source !== 'billed_material')
  const other = buildJobChargeEvents({ teamLaborBreakdown: [], subLabor: [], mercury: [], supplyHouse: [], tallyParts: [], billedMaterials: live.otherCharges })
  return { ...inputs, revenue: live.priceUsd, chargeEvents: [...kept, ...other] }
}
