/**
 * Bids → Labor: the direct-cost list's add / edit / remove, one factory for the five tables
 * (region L5 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`). Until now `BidsLaborTab`
 * carried fifteen handlers — three per table, the same three times five.
 *
 * The model, as it was: a field edit changes state only (the tab's debounced autosave writes
 * it); **add** inserts a blank row at the end and appends what the database returns;
 * **remove** drops the row from the list first and then deletes it — a failed delete says so
 * and the row stays gone until the next load (the map's quirk 9).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { DIRECT_COST_KIND_TABLE, DIRECT_COST_KINDS, type DirectCostKind } from './costEstimateDirectCosts'
import type {
  CostEstimateEquipmentRow,
  CostEstimateOtherRow,
  CostEstimatePermitRow,
  CostEstimateSubcontractorRow,
  CostEstimateWasteRow,
} from './bidPricingEngineTypes'

/** What the failure messages call a row of each kind — "Other" rows are just "row". */
export const DIRECT_COST_KIND_NOUN: Record<DirectCostKind, string> = {
  equipment: 'equipment row',
  permit: 'permit row',
  sub: 'subcontractor row',
  waste: 'waste row',
  other: 'row',
}

export type DirectCostRowUpdates = Partial<Pick<CostEstimateEquipmentRow, 'note' | 'rough_in' | 'top_out' | 'trim_set'>>

export type DirectCostHandlers = {
  add: () => Promise<void>
  update: (rowId: string, updates: DirectCostRowUpdates) => void
  remove: (rowId: string) => Promise<void>
}

type RowBase = { id: string; sequence_order: number }

export type DirectCostTableBinding<R extends RowBase> = { rows: ReadonlyArray<R>; setRows: Dispatch<SetStateAction<R[]>> }

export type DirectCostTableBindings = {
  equipment: DirectCostTableBinding<CostEstimateEquipmentRow>
  permit: DirectCostTableBinding<CostEstimatePermitRow>
  sub: DirectCostTableBinding<CostEstimateSubcontractorRow>
  waste: DirectCostTableBinding<CostEstimateWasteRow>
  other: DirectCostTableBinding<CostEstimateOtherRow>
}

/** A new row goes after the last one: the highest order on the list plus one, 1 on an empty list. */
export function nextDirectCostSequenceOrder(rows: ReadonlyArray<{ sequence_order: number }>): number {
  return rows.reduce((m, r) => Math.max(m, r.sequence_order), 0) + 1
}

/** The blank row an add inserts. */
export function blankDirectCostRow(costEstimateId: string, rows: ReadonlyArray<{ sequence_order: number }>) {
  return { cost_estimate_id: costEstimateId, note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: nextDirectCostSequenceOrder(rows) }
}

/** One table's three handlers. */
export function directCostHandlersFor<R extends RowBase>(
  client: SupabaseClient,
  kind: DirectCostKind,
  args: DirectCostTableBinding<R> & {
    /** Null until the bid's cost estimate exists — an add waits for it. */
    costEstimateId: string | null | undefined
    setError: (message: string | null) => void
  },
): DirectCostHandlers {
  const { rows, setRows, costEstimateId, setError } = args
  const table = DIRECT_COST_KIND_TABLE[kind]
  const noun = DIRECT_COST_KIND_NOUN[kind]
  return {
    update(rowId, updates) {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)))
    },
    async add() {
      if (!costEstimateId) return
      const { data, error: insErr } = await client.from(table).insert(blankDirectCostRow(costEstimateId, rows)).select('*').single()
      if (insErr) {
        setError(`Failed to add ${noun}: ${insErr.message}`)
        return
      }
      setRows((prev) => [...prev, data as R])
    },
    async remove(rowId) {
      setRows((prev) => prev.filter((r) => r.id !== rowId))
      const { error: delErr } = await client.from(table).delete().eq('id', rowId)
      if (delErr) setError(`Failed to remove ${noun}: ${delErr.message}`)
    },
  }
}

/** One direct-cost list, five tables (v2.3295): the section hands every edit back with its kind. */
export function directCostHandlersByKind(
  client: SupabaseClient,
  args: { costEstimateId: string | null | undefined; setError: (message: string | null) => void; tables: DirectCostTableBindings },
): Record<DirectCostKind, DirectCostHandlers> {
  const { costEstimateId, setError, tables } = args
  return {
    equipment: directCostHandlersFor(client, 'equipment', { ...tables.equipment, costEstimateId, setError }),
    permit: directCostHandlersFor(client, 'permit', { ...tables.permit, costEstimateId, setError }),
    sub: directCostHandlersFor(client, 'sub', { ...tables.sub, costEstimateId, setError }),
    waste: directCostHandlersFor(client, 'waste', { ...tables.waste, costEstimateId, setError }),
    other: directCostHandlersFor(client, 'other', { ...tables.other, costEstimateId, setError }),
  }
}

export { DIRECT_COST_KINDS }
