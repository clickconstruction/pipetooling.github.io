/**
 * Bid history, Undo a whole action (punch list #73, PR 6). The History window shows one line per
 * action (an import of 23 rows is one), and **Undo** on that line takes the whole action back in
 * one press, newest change first:
 *
 * - a changed value goes back through `put_back_bid_change` (every column the change touched);
 * - a removed row comes back through `restore_bid_removed_row`, with what was removed with it, so a
 *   row whose count row, version or estimate was removed in the same delete rides with that parent,
 *   and parents go first;
 * - a row the action added is removed from the client under the presser's own policies, tagged
 *   `put-back` (PUNCHLIST, 2026-10-09). Only from a table the delete archive keeps, so the removal
 *   lands there and each row's own Put back brings it back. An added count row takes what the action
 *   hung on it, as a delete on the Counts tab does.
 *
 * Undo is withheld, with the reason said, when it could not take the action back whole: a row it
 * added in a table Undo cannot remove, a later change that hangs on a row it added (Undo would take
 * that with it), a row it changed that was removed since, or a removal the archive no longer holds.
 * What hangs on an added count row outside the ledger (submittal ticks and items, rows hidden from
 * the pricing page) is read before Undo is offered and again on the press (`BID_UNDO_UNSEEN_TABLES`).
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
  /** `writesOver`: the columns of this change a person set again since, which Undo writes over. */
  | { kind: 'value'; changeId: number; table: string; what: string; writesOver: number }
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
/** Within one moment, parents first: a version's or an estimate's restore brings what hangs on it. */
const PARENT_RANK: Record<string, number> = { bid_versions: 0, cost_estimates: 1, bids_count_rows: 2 }
const undoOrder = (a: BidHistoryRow, b: BidHistoryRow) =>
  Date.parse(b.changedAt) - Date.parse(a.changedAt) || (PARENT_RANK[a.table] ?? 3) - (PARENT_RANK[b.table] ?? 3) || (b.id ?? 0) - (a.id ?? 0)

/** A later change in words: "Lav-1 price" (an addition, by its table), "Lav-1 count" (a change, by its column). */
function laterWords(r: BidHistoryRow): string {
  const name = r.table === 'bids' ? 'Bid' : r.label?.trim() || 'a row'
  if (r.op !== 'update') return `${name} ${bidHistoryNoun(r.table, 1)}`
  const col = r.changed.find((c) => !PUT_BACK_KEY_COLUMNS.has(c))
  return col ? `${name} ${bidHistoryColumnName(col)}` : name
}

/** "a version", "an estimate", "3 versions". */
const counted = (table: string, n: number) => {
  const word = bidHistoryNoun(table, n)
  return n === 1 ? `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}` : `${n} ${word}`
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

  const rows = [...action.rows].sort(undoOrder)
  const inserted = new Set(rows.filter((r) => r.op === 'insert').map(rowKey))
  const deleted = new Set(rows.filter((r) => r.op === 'delete').map(rowKey))
  const countRowsAdded = new Set(rows.filter((r) => r.op === 'insert' && r.table === 'bids_count_rows').map((r) => r.recordId))
  // A parent removed in the action, by its id, at the moment of its delete: a row of the same delete
  // that hangs on it comes back with its restore (restore_bid_removed_row bundles them).
  const removedAt = new Map<string, number>()
  for (const r of rows) if (r.op === 'delete' && r.table in PARENT_RANK) removedAt.set(`${r.table}:${r.recordId}`, Date.parse(r.changedAt))
  const ridesWithParent = (r: BidHistoryRow) => {
    const at = Date.parse(r.changedAt)
    const parents: Array<[string, unknown]> = [
      ['bid_versions', r.oldValues?.bid_version_id],
      ['cost_estimates', r.oldValues?.cost_estimate_id],
      ['bids_count_rows', r.countRowId],
    ]
    return parents.some(([table, id]) => table !== r.table && typeof id === 'string' && removedAt.get(`${table}:${id}`) === at)
  }
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
      const over = cols.filter((c) => laterByPeople.some((x) => x.op === 'update' && rowKey(x) === rowKey(r) && x.changed.includes(c) && Date.parse(x.changedAt) > Date.parse(r.changedAt)))
      for (const c of over) overwritten.add(`${rowKey(r)}:${c}`)
      steps.push({ kind: 'value', changeId: r.id, table: r.table, what: r.table === 'bids' ? 'Bid' : r.label?.trim() || 'A value', writesOver: over.length })
      changes += 1
      continue
    }

    if (r.op === 'delete') {
      // Added and removed inside the action: nothing to take back.
      if (inserted.has(rowKey(r))) continue
      // Its count row's, version's or estimate's restore brings it back.
      if (ridesWithParent(r)) {
        changes += 1
        continue
      }
      if (NOT_ARCHIVED_TABLES.has(r.table)) {
        notKept.push(r.table)
        continue
      }
      const target = bidRemovedPutBackTarget(r, ctx.openBidId, ctx.restorable)
      if (target) {
        steps.push({ kind: 'restore', archiveId: target.archiveId, table: r.table, what: target.what })
        changes += 1
      } else if (!lastLater.has(rowKey(r))) {
        gone += 1
      }
      // Else it came back since (and may have gone again, which that later line's Undo answers).
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
    // The row's own put back since (removed, then put back) is the same row again, not work hung on it.
    const hangs = laterByPeople.filter(
      (x) => x.op !== 'delete' && !(x.op === 'insert' && rowKey(x) === rowKey(r)) && (rowKey(x) === rowKey(r) || (r.table === 'bids_count_rows' && x.countRowId === r.recordId)),
    )
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
    const what = tables.length === 1 ? counted(tables[0]!, n) : `${n} rows`
    return { ready: false, reason: `Undo is off. It added ${what}, and Undo cannot remove ${n === 1 ? 'that' : 'those'}.` }
  }
  if (notKept.length > 0) {
    const n = notKept.length
    const what = counted(notKept[0]!, n)
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

// ---------------------------------------------------------------------------
// What hangs on a count row outside the ledger. Removing an added count row cascades into these
// (or, for a submittal item, empties its link), and the ledger never sees them, so the plan cannot
// tell a person's later tick from none. The window reads them for the count rows a plan removes,
// before it offers Undo and again on the press, and Undo is off while any is there. The SQL bed
// (supabase/tests/bid_changes, case 21) holds this list to every such key in the schema.
// ---------------------------------------------------------------------------

export type BidUndoUnseen = { ticks: number; hides: number; items: number; mappings: number }

export const BID_UNDO_UNSEEN_TABLES: ReadonlyArray<{ table: string; column: string; key: keyof BidUndoUnseen }> = [
  { table: 'bid_count_row_submission_hides', column: 'count_row_id', key: 'hides' },
  { table: 'bid_submittal_items', column: 'source_count_row_id', key: 'items' },
  { table: 'bid_submittal_takeoff_choices', column: 'count_row_id', key: 'ticks' },
  { table: 'bids_takeoff_template_mappings', column: 'count_row_id', key: 'mappings' },
]

/** Nothing hangs there. */
export const BID_UNDO_UNSEEN_NONE: BidUndoUnseen = { ticks: 0, hides: 0, items: 0, mappings: 0 }

/** The count rows a ready plan removes, whose unseen hangers are read first. */
export function bidUndoRemovedCountRows(plan: BidUndoPlan): string[] {
  return plan.ready ? plan.steps.flatMap((s) => (s.kind === 'remove' && s.table === 'bids_count_rows' ? s.ids : [])) : []
}

/** Why Undo is off for what hangs on its rows outside the ledger, or null when nothing does. */
export function bidUndoUnseenReason(u: BidUndoUnseen): string | null {
  const parts = [
    u.ticks > 0 ? `${u.ticks} submittal ${u.ticks === 1 ? 'tick' : 'ticks'}` : null,
    u.items > 0 ? `${u.items} submittal ${u.items === 1 ? 'item' : 'items'}` : null,
    u.hides > 0 ? `${u.hides} ${u.hides === 1 ? 'row' : 'rows'} hidden from the pricing page` : null,
    u.mappings > 0 ? `${u.mappings} By Stage ${u.mappings === 1 ? 'pick' : 'picks'}` : null,
  ].filter((x): x is string => x != null)
  if (parts.length === 0) return null
  return `Undo is off. Rows it added carry work History cannot see: ${nameList(parts)}.`
}

/** The words when what hangs on its rows could not be read: Undo stays off rather than guess. */
export const BID_UNDO_UNSEEN_UNREAD = 'Undo is off. What hangs on the rows it added could not be read.'

/**
 * The plan as the window offers it, once what hangs on its count rows outside the ledger is read:
 * `read` holds each count row's hangers (a row not in it has none), `'failed'` when the read
 * failed, and null while it is still out (Undo waits for it).
 */
export function bidUndoGateUnseen(plan: BidUndoPlan, read: ReadonlyMap<string, BidUndoUnseen> | 'failed' | null): BidUndoPlan | null {
  const ids = bidUndoRemovedCountRows(plan)
  if (ids.length === 0) return plan
  if (read === 'failed') return { ready: false, reason: BID_UNDO_UNSEEN_UNREAD }
  if (read === null) return null
  const sum = { ...BID_UNDO_UNSEEN_NONE }
  for (const id of ids) {
    const u = read.get(id)
    if (u) for (const k of Object.keys(sum) as Array<keyof BidUndoUnseen>) sum[k] += u[k]
  }
  const reason = bidUndoUnseenReason(sum)
  return reason ? { ready: false, reason } : plan
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
  /** Steps that went through, whole or in part. */
  done: number
  /** Each refused step, in the function's own words. */
  refusals: Array<{ what: string; words: string }>
  /** The tables written, for the open bid's tabs. */
  tables: string[]
  /** Rows removed. */
  removed: number
  /** Fields a restored row brought back empty, because what they pointed at is gone. */
  cleared: number
  /** Values set again since that a put back that went through wrote over. */
  wroteOver: number
}

/** A removal's refusal in words: PostgREST's message, or the function-style sentence it already is. */
function removeFailWords(message: string): string {
  const m = message.trim()
  if (/^(That|Only|Another|What|You|Its) .*\.$/.test(m)) return m
  return `It was not removed: ${m}`
}

/** Runs the plan's steps newest first. A refused step is said and the rest still run, so Undo takes back all it can. */
export async function runBidUndo(plan: Extract<BidUndoPlan, { ready: true }>, io: BidUndoIo): Promise<BidUndoOutcome> {
  const out: BidUndoOutcome = { done: 0, refusals: [], tables: [], removed: 0, cleared: 0, wroteOver: 0 }
  const touched = new Set<string>()
  for (const step of plan.steps) {
    try {
      if (step.kind === 'value') {
        await io.putBack(step.changeId, null)
        out.wroteOver += step.writesOver
      } else if (step.kind === 'restore') {
        try {
          const result = await io.restore(step.archiveId)
          out.cleared += result.warnings?.length ?? 0
        } catch (e) {
          // Already back: an earlier step brought it with its parent, or someone put it back meanwhile.
          if (!/not waiting to be put back/i.test(e instanceof Error ? e.message : String(e))) throw e
        }
      } else {
        const n = await io.remove(step.table, step.ids)
        if (n === 0) {
          out.refusals.push({ what: step.what, words: 'You cannot change this bid, or those rows are gone already.' })
          continue
        }
        out.removed += n
        // Some went: the step counts as run, and the rest is said as a refusal.
        if (n < step.ids.length) out.refusals.push({ what: step.what, words: `Only ${n} of ${step.ids.length} were removed. You cannot change this bid, or the rest are gone already.` })
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
 * went, what it wrote over; or what was refused, in the function's words. Every word comes from
 * what ran, not from the plan.
 */
export function bidUndoDoneWords(action: Pick<BidHistoryAction, 'caption'>, outcome: BidUndoOutcome): { text: string; ok: boolean } {
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
  if (outcome.wroteOver > 0) {
    parts.push(outcome.wroteOver === 1 ? 'One of its values had changed again since. Undo wrote over that later change.' : `${outcome.wroteOver} of its values had changed again since. Undo wrote over those later changes.`)
  }
  if (outcome.cleared > 0) {
    parts.push(outcome.cleared === 1 ? 'One field pointed at a row that is gone, so it is empty now.' : `${outcome.cleared} fields pointed at rows that are gone, so they are empty now.`)
  }
  return { text: parts.join(' '), ok: outcome.refusals.length === 0 }
}
