/**
 * Bid history, Undo a whole action (punch list #73, PR 6). The History window shows one line per
 * action (an import of 23 rows is one), and **Undo** on that line takes the whole action back in
 * one press, newest change first:
 *
 * - a changed value goes back through `put_back_bid_change` (every column the change touched);
 * - a removed row comes back through `restore_bid_removed_row`, with what was removed with it, so a
 *   row whose count row was removed in the same action rides with that count row;
 * - a row the action added is removed from the client under the presser's own policies, tagged
 *   `put-back` (PUNCHLIST, 2026-10-09). Only from a table the delete archive keeps, so the removal
 *   lands there and each row's own Put back brings it back. An added count row takes what the action
 *   hung on it, as a delete on the Counts tab does.
 *
 * Undo is withheld, with the reason said, when it could not take the action back whole: a row it
 * added in a table Undo cannot remove, a later change that hangs on a row it added (Undo would take
 * that with it), a row it changed that was removed since, or a removal the archive no longer holds.
 *
 * Pure: the plan, the loop over injected writes, and the words.
 */
import { bidHistoryColumnName, bidHistoryNoun, type BidHistoryAction, type BidHistoryRow } from './bidHistory'
import {
  bidPutBackFailWords,
  bidRemovedPutBackTarget,
  type BidPutBackResult,
  type BidRestoreResult,
} from './bidHistoryPutBack'

/**
 * The tables whose added rows Undo removes: the ledger's tables that the delete archive keeps
 * (`zzz_archive_on_delete`), so a removal can be put back. Not `bids` or `bid_sov_lines`, which the
 * archive does not keep row by row, and not `bid_versions` or `cost_estimates`, whose rows carry
 * whole tabs the ledger cannot key back to them. `bidHistoryUndo.test.ts` checks the list against
 * the migrations.
 */
export const BID_UNDO_REMOVABLE_TABLES: ReadonlySet<string> = new Set([
  'bids_count_rows',
  'bid_count_row_custom_prices',
  'bid_count_row_custom_costs',
  'bid_pricing_assignments',
  'bids_takeoff_rough_part_lines',
  'bid_takeoff_stage_splits',
  'cost_estimate_labor_rows',
  'cost_estimate_labor_rows_unmatched',
  'cost_estimate_equipment_rows',
  'cost_estimate_other_rows',
  'cost_estimate_permit_rows',
  'cost_estimate_subcontractor_rows',
  'cost_estimate_waste_rows',
  'bid_payment_schedule_rows',
])

/** Ledger tables the delete archive does not keep row by row: a row removed from one cannot come back. */
const NOT_ARCHIVED_TABLES: ReadonlySet<string> = new Set(['bids', 'bid_sov_lines'])

/** The columns `put_back_bid_change` never writes (keys and stamps). A change of only these has nothing to put back. */
const PUT_BACK_KEY_COLUMNS = new Set(['id', 'bid_id', 'bid_version_id', 'count_row_id', 'cost_estimate_id', 'created_at', 'updated_at', 'updated_by', 'created_by'])

export type BidUndoStep =
  | { kind: 'value'; changeId: number; table: string; what: string }
  | { kind: 'restore'; archiveId: string; table: string; what: string }
  | { kind: 'remove'; table: string; ids: string[]; what: string }

export type BidUndoPlan =
  | {
      ready: true
      /** Newest change first. */
      steps: BidUndoStep[]
      /** The action's changes the steps take back (a removed count row's hangers ride with it). */
      changes: number
      /** Values the action set that a later change set again: Undo writes over those. */
      writesOver: number
      /** Rows the action added that Undo removes. */
      removes: number
    }
  | { ready: false; reason: string }

const rowKey = (r: Pick<BidHistoryRow, 'table' | 'recordId'>) => `${r.table}:${r.recordId}`
const lineKey = (r: BidHistoryRow) => `${r.source}-${r.id ?? r.archiveId}`
const newestFirst = (a: BidHistoryRow, b: BidHistoryRow) => Date.parse(b.changedAt) - Date.parse(a.changedAt) || (b.id ?? 0) - (a.id ?? 0)

/** A later change in words: "Lav-1 price" (an addition, by its table), "Lav-1 count" (a change, by its column). */
function laterWords(r: BidHistoryRow): string {
  const name = r.table === 'bids' ? 'Bid' : r.label?.trim() || 'a row'
  if (r.op !== 'update') return `${name} ${bidHistoryNoun(r.table, 1)}`
  const col = r.changed.find((c) => !PUT_BACK_KEY_COLUMNS.has(c))
  return col ? `${name} ${bidHistoryColumnName(col)}` : name
}

const nameList = (names: ReadonlyArray<string>) => {
  const unique = [...new Set(names)]
  if (unique.length <= 3) return unique.length === 1 ? unique[0]! : `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`
  return `${unique.slice(0, 3).join(', ')} and ${unique.length - 3} more`
}

/**
 * What Undo on an action does, or why it is off, or null when the line offers neither: another
 * bid's action, the app's own writes (it would only make them again), an action cut at the page's
 * edge, or one with nothing left to take back.
 *
 * `history` is every row the window has read. Rows newer than the action are always among them,
 * since the read runs newest first.
 */
export function bidUndoPlan(
  action: BidHistoryAction,
  ctx: { openBidId: string; restorable: ReadonlyMap<string, string>; history: ReadonlyArray<BidHistoryRow> },
): BidUndoPlan | null {
  if (action.bidId !== ctx.openBidId || action.continues || action.rows.some((r) => r.byApp)) return null

  const mine = new Set(action.rows.map(lineKey))
  const start = Math.min(...action.rows.map((r) => Date.parse(r.changedAt)))
  const later = ctx.history.filter((r) => r.bidId === ctx.openBidId && !mine.has(lineKey(r)) && Date.parse(r.changedAt) >= start).sort(newestFirst)
  // The newest later write to each row: a delete means the row is gone now.
  const lastLater = new Map<string, BidHistoryRow>()
  for (const r of later) if (!lastLater.has(rowKey(r))) lastLater.set(rowKey(r), r)
  const goneNow = (r: BidHistoryRow) => lastLater.get(rowKey(r))?.op === 'delete'
  // A person's later writes. The app's own (book picks minted for new count rows, the labor sync)
  // are made again whenever they are missing, so Undo may take them with a row and write over them.
  const laterByPeople = later.filter((r) => !r.byApp)

  const rows = [...action.rows].sort(newestFirst)
  const inserted = new Set(rows.filter((r) => r.op === 'insert').map(rowKey))
  const deleted = new Set(rows.filter((r) => r.op === 'delete').map(rowKey))
  const countRowsAdded = new Set(rows.filter((r) => r.op === 'insert' && r.table === 'bids_count_rows').map((r) => r.recordId))
  const countRowsRemoved = new Set(rows.filter((r) => r.op === 'delete' && r.table === 'bids_count_rows').map((r) => r.recordId))
  /** A row of a count row the action added: it goes when that count row goes. */
  const onAddedCountRow = (r: BidHistoryRow) => r.table !== 'bids_count_rows' && r.countRowId != null && countRowsAdded.has(r.countRowId)

  const steps: BidUndoStep[] = []
  const cannotRemove: string[] = []
  const notKept: string[] = []
  const hanging: BidHistoryRow[] = []
  const removedSince: BidHistoryRow[] = []
  let gone = 0
  let changes = 0
  let removes = 0
  const overwritten = new Set<string>()

  for (const r of rows) {
    if (r.op === 'update') {
      const cols = r.changed.filter((c) => !PUT_BACK_KEY_COLUMNS.has(c))
      if (r.source !== 'ledger' || r.id == null || cols.length === 0) continue
      // A row the action added goes whole, with this change.
      if (inserted.has(rowKey(r)) || onAddedCountRow(r)) {
        changes += 1
        continue
      }
      // A row the action itself removed after changing it comes back first (newest first), so only a later removal blocks.
      if (!deleted.has(rowKey(r)) && goneNow(r)) {
        removedSince.push(r)
        continue
      }
      for (const c of cols) {
        if (laterByPeople.some((x) => x.op === 'update' && rowKey(x) === rowKey(r) && x.changed.includes(c) && Date.parse(x.changedAt) > Date.parse(r.changedAt))) overwritten.add(`${rowKey(r)}:${c}`)
      }
      steps.push({ kind: 'value', changeId: r.id, table: r.table, what: r.table === 'bids' ? 'Bid' : r.label?.trim() || 'A value' })
      changes += 1
      continue
    }

    if (r.op === 'delete') {
      // Added and removed inside the action: nothing to take back.
      if (inserted.has(rowKey(r))) continue
      // Its count row's Put back brings it back.
      if (r.table !== 'bids_count_rows' && r.countRowId && countRowsRemoved.has(r.countRowId)) {
        changes += 1
        continue
      }
      if (NOT_ARCHIVED_TABLES.has(r.table)) {
        notKept.push(r.table)
        continue
      }
      const target = bidRemovedPutBackTarget(r, ctx.openBidId, ctx.restorable, countRowsRemoved)
      if (target) {
        steps.push({ kind: 'restore', archiveId: target.archiveId, table: r.table, what: target.what })
        changes += 1
      } else if (lastLater.has(rowKey(r)) && !goneNow(r)) {
        // Put back since: it is on the bid again.
        continue
      } else {
        gone += 1
      }
      continue
    }

    // An addition.
    if (deleted.has(rowKey(r))) continue
    // A row hung on a count row the action added goes with it.
    if (onAddedCountRow(r)) {
      changes += 1
      continue
    }
    // Removed since: already gone, and what hung on it with it.
    if (goneNow(r)) continue
    if (!BID_UNDO_REMOVABLE_TABLES.has(r.table)) {
      cannotRemove.push(r.table)
      continue
    }
    const hangs = laterByPeople.filter((x) => x.op !== 'delete' && (rowKey(x) === rowKey(r) || (r.table === 'bids_count_rows' && x.countRowId === r.recordId)))
    if (hangs.length > 0) {
      hanging.push(...hangs)
      continue
    }
    const prev = steps[steps.length - 1]
    if (prev?.kind === 'remove' && prev.table === r.table) {
      prev.ids.push(r.recordId)
      prev.what = `${prev.ids.length} ${bidHistoryNoun(r.table, prev.ids.length)}`
    } else {
      steps.push({ kind: 'remove', table: r.table, ids: [r.recordId], what: r.label?.trim() || `1 ${bidHistoryNoun(r.table, 1)}` })
    }
    changes += 1
    removes += 1
  }

  if (cannotRemove.length > 0) {
    const tables = [...new Set(cannotRemove)]
    const n = cannotRemove.length
    const what = tables.length === 1 ? `${n === 1 ? 'a' : n} ${bidHistoryNoun(tables[0]!, n)}` : `${n} rows`
    return { ready: false, reason: `Undo is off. It added ${what}, and Undo cannot remove ${n === 1 ? 'that' : 'those'}.` }
  }
  if (notKept.length > 0) {
    const n = notKept.length
    const what = `${n === 1 ? 'a' : n} ${bidHistoryNoun(notKept[0]!, n)}`
    return { ready: false, reason: `Undo is off. It removed ${what}, and the archive does not keep ${n === 1 ? 'that' : 'those'}.` }
  }
  if (hanging.length > 0) {
    const n = new Set(hanging.map(lineKey)).size
    return { ready: false, reason: `Undo is off. ${n === 1 ? 'A later change hangs' : `${n} later changes hang`} on rows it added: ${nameList(hanging.map(laterWords))}.` }
  }
  if (removedSince.length > 0) {
    const n = new Set(removedSince.map(rowKey)).size
    return { ready: false, reason: `Undo is off. ${n === 1 ? 'A row it changed was' : `${n} rows it changed were`} removed since: ${nameList(removedSince.map((r) => r.label?.trim() || 'a row'))}. Put ${n === 1 ? 'it' : 'them'} back first.` }
  }
  if (gone > 0) {
    return { ready: false, reason: `Undo is off. ${gone === 1 ? 'A row it removed' : `${gone} rows it removed`} can no longer come back. The archive keeps a removed row 90 days.` }
  }
  if (steps.length === 0) return null
  return { ready: true, steps, changes, writesOver: overwritten.size, removes }
}

/** The button's name for a screen reader: "Undo Brushed 6 prices". */
export function bidUndoLabel(action: Pick<BidHistoryAction, 'caption'>): string {
  return `Undo ${action.caption}`
}

/** What the button does, said on hover: "Puts back its 6 changes, newest first." */
export function bidUndoTitle(plan: Extract<BidUndoPlan, { ready: true }>): string {
  return plan.changes === 1 ? 'Puts back its change.' : `Puts back its ${plan.changes} changes, newest first.`
}

/** The writes Undo makes; the window passes the real ones, a test stands them in. */
export type BidUndoIo = {
  putBack: (changeId: number, column: string | null) => Promise<BidPutBackResult>
  restore: (archiveId: string) => Promise<BidRestoreResult>
  /** Removes rows by id under the presser's policies, tagged put-back; resolves how many went. */
  remove: (table: string, ids: ReadonlyArray<string>) => Promise<number>
}

export type BidUndoOutcome = {
  /** Steps that went through. */
  done: number
  /** Each refused step, in the function's own words. */
  refusals: Array<{ what: string; words: string }>
  /** The tables written, for the open bid's tabs. */
  tables: string[]
  /** Rows removed. */
  removed: number
  /** Fields a restored row brought back empty, because what they pointed at is gone. */
  cleared: number
}

/** A removal's refusal in words: PostgREST's message, or the function-style sentence it already is. */
function removeFailWords(message: string): string {
  const m = message.trim()
  if (/^(That|Only|Another|What|You|Its) .*\.$/.test(m)) return m
  return `It was not removed: ${m}`
}

/** Runs the plan's steps newest first. A refused step is said and the rest still run, so Undo takes back all it can. */
export async function runBidUndo(plan: Extract<BidUndoPlan, { ready: true }>, io: BidUndoIo): Promise<BidUndoOutcome> {
  const out: BidUndoOutcome = { done: 0, refusals: [], tables: [], removed: 0, cleared: 0 }
  const touched = new Set<string>()
  for (const step of plan.steps) {
    try {
      if (step.kind === 'value') {
        await io.putBack(step.changeId, null)
      } else if (step.kind === 'restore') {
        const result = await io.restore(step.archiveId)
        out.cleared += result.warnings?.length ?? 0
      } else {
        const n = await io.remove(step.table, step.ids)
        if (n === 0) {
          out.refusals.push({ what: step.what, words: 'You cannot change this bid, or those rows are gone already.' })
          continue
        }
        out.removed += n
      }
      out.done += 1
      touched.add(step.table)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      out.refusals.push({ what: step.what, words: step.kind === 'remove' ? removeFailWords(message) : bidPutBackFailWords(message) })
    }
  }
  out.tables = [...touched]
  return out
}

/**
 * The line at the top after Undo: "“Brushed 6 prices” is undone.", what it removed and where that
 * went, what it wrote over; or what was refused, in the function's words.
 */
export function bidUndoDoneWords(
  action: Pick<BidHistoryAction, 'caption'>,
  plan: Extract<BidUndoPlan, { ready: true }>,
  outcome: BidUndoOutcome,
): { text: string; ok: boolean } {
  const parts: string[] = []
  if (outcome.refusals.length === 0) parts.push(`“${action.caption}” is undone.`)
  else if (outcome.done > 0) parts.push(`“${action.caption}” is partly undone.`)
  else parts.push('Nothing was undone.')
  const [first, ...rest] = outcome.refusals
  if (first) {
    parts.push(`${first.what}: ${first.words}`)
    if (rest.length > 0) parts.push(`${rest.length} more ${rest.length === 1 ? 'step' : 'steps'} could not be undone.`)
  }
  if (outcome.removed > 0) {
    parts.push(outcome.removed === 1 ? 'The row it added is in the delete archive now. Its Put back brings it back.' : `The ${outcome.removed} rows it added are in the delete archive now. Each one's Put back brings it back.`)
  }
  if (outcome.done > 0 && plan.writesOver > 0) {
    parts.push(plan.writesOver === 1 ? 'One of its values had changed again since. Undo wrote over that later change.' : `${plan.writesOver} of its values had changed again since. Undo wrote over those later changes.`)
  }
  if (outcome.cleared > 0) {
    parts.push(outcome.cleared === 1 ? 'One field pointed at a row that is gone, so it is empty now.' : `${outcome.cleared} fields pointed at rows that are gone, so they are empty now.`)
  }
  return { text: parts.join(' '), ok: outcome.refusals.length === 0 }
}
