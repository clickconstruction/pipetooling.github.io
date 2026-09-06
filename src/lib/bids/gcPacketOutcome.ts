/**
 * Per-GC outcome writes (Bids by GC, v2.2162 / v2.2164): mark a GC packet won / lost / clear, then
 * roll the bid-level outcome up conservatively. A GC win also marks the bid's other sent, unanswered
 * packets lost (the winner got the job); the reason "GC lost the project" is inferred by gcOutcomeRows — editable, no triage.
 *
 * Journey-map Tier-2 #21: the cascade is planned by wonCascade.ts (the same plan every writer shows
 * in its confirm first), a snapshot of every touched row is taken BEFORE the win is written, and
 * "↩ waiting" on the winner (`previousOutcome: 'won'` → `outcome: null`) undoes the whole cascade —
 * siblings back to what they were, `bids.outcome` back to what it was (a hand-set Lost included).
 * With no snapshot from this session (a reload, or a signature-set Won from the bid room) the undo
 * infers one from the rows. The packet path also writes the Win/Loss note the Edit-Bid form always
 * did, and one `bid_outcome_set{path, undone}` telemetry row.
 * Supabase-bound; the decision logic lives in gcPackets.ts / gcOutcomeRows.ts / wonCascade.ts.
 */
import { supabase } from '../supabase'
import { rollUpOutcome } from './gcPackets'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, updateApplied } from './updateGuard'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { recordNavClick } from '../navClickTelemetry'
import {
  BID_OUTCOME_SET_CONTROL,
  bidOutcomeSetTarget,
  inferWonCascadeSnapshot,
  wonCascadeNoteBody,
  wonCascadePlan,
  wonCascadeUndo,
  wonCascadeUndoNoteBody,
  type CascadePacket,
  type WonCascadePath,
  type WonCascadeSnapshot,
  type WonCascadeVersionState,
} from './wonCascade'

export type PacketOutcome = 'won' | 'lost' | null

export type PacketAfter = { key?: string; name?: string; outcome: string | null; sentOn: string | null; versionIds?: string[]; sharedLetter?: boolean }

/** Who is writing and from where — turns on the Win/Loss note and the `bid_outcome_set` telemetry row. */
export type PacketOutcomeActor = { userId: string | null | undefined; role: string | null; path: WonCascadePath }

export type SetGcPacketOutcomeResult = {
  error: string | null
  bidOutcomeSet: 'won' | 'lost' | null
  autoLost: string[]
  /** Set when a Won was undone: what came back. `bidOutcomeRestoredTo` is undefined when `bids.outcome` was left alone. */
  undone?: { restoredSiblings: string[]; bidOutcomeRestoredTo: string | null | undefined }
}

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Last Won cascade written this session, per bid — what "↩ waiting" on the winner puts back. */
const cascadeSnapshots = new Map<string, WonCascadeSnapshot>()

/** Test / devtools hook: the snapshot "↩ waiting" would use for this bid, if one was taken this session. */
export function peekWonCascadeSnapshot(bidId: string): WonCascadeSnapshot | null {
  return cascadeSnapshots.get(bidId) ?? null
}

function toCascadePackets(packets: ReadonlyArray<PacketAfter>): CascadePacket[] {
  return packets.map((p) => ({ key: p.key ?? '', name: p.name ?? 'another GC', outcome: p.outcome, sentOn: p.sentOn, versionIds: [...(p.versionIds ?? [])], sharedLetter: p.sharedLetter }))
}

function targetKeyOf(packets: ReadonlyArray<CascadePacket>, versionIds: ReadonlyArray<string>): string | null {
  return packets.find((p) => p.versionIds.some((id) => versionIds.includes(id)))?.key ?? null
}

async function readVersionStates(ids: ReadonlyArray<string>): Promise<WonCascadeVersionState[] | null> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('bid_versions').select('id, outcome, outcome_at, loss_category').in('id', [...ids])
  if (error || !data) return null
  return (data as WonCascadeVersionState[]).map((r) => ({ id: r.id, outcome: r.outcome ?? null, outcome_at: r.outcome_at ?? null, loss_category: r.loss_category ?? null }))
}

function sameIdSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((id) => s.has(id))
}

/** Fail-soft: the outcome is saved; a note that doesn't land costs only the ledger line. */
async function writePacketNote(args: { bidId: string; gcCustomerId: string | null; notes: string; userId: string | null | undefined }): Promise<void> {
  try {
    await supabase.from('bids_submission_entries').insert({
      bid_id: args.bidId,
      gc_customer_id: args.gcCustomerId,
      notes: args.notes,
      contact_method: null,
      occurred_at: new Date().toISOString(),
      created_by: args.userId ?? null,
    })
  } catch {
    /* best-effort */
  }
}

function recordOutcomeTelemetry(actor: PacketOutcomeActor | undefined, outcome: PacketOutcome, undone: boolean): void {
  if (!actor) return
  recordNavClick(actor.userId, actor.role, BID_OUTCOME_SET_CONTROL, bidOutcomeSetTarget(actor.path, outcome, undone))
}

export async function setGcPacketOutcome(args: {
  bidId: string
  bidOutcome: string | null
  versionIds: string[]
  outcome: PacketOutcome
  /** All packets of the bid AFTER the change, for the roll-up (and, on a win, the auto-loss of the others). */
  packetsAfter: ReadonlyArray<PacketAfter>
  /** The packet's outcome BEFORE this write. 'won' → null undoes the whole cascade, not just the pill. */
  previousOutcome?: PacketOutcome
  actor?: PacketOutcomeActor
}): Promise<SetGcPacketOutcomeResult> {
  const today = todayYmd()
  const gcs = toCascadePackets(args.packetsAfter)
  const targetKey = targetKeyOf(gcs, args.versionIds)
  const target = targetKey != null ? gcs.find((p) => p.key === targetKey) ?? null : null
  const targetGcCustomerId = target && target.key !== '' && !target.key.startsWith('shared:') ? target.key : null

  // Undo a Won (journey-map Tier-2 #21): "↩ waiting" on the winner puts the siblings and the bid back.
  if (args.outcome == null && args.previousOutcome === 'won') {
    let snapshot = cascadeSnapshots.get(args.bidId) ?? null
    if (snapshot && !sameIdSet(snapshot.targetVersionIds, args.versionIds)) snapshot = null
    if (!snapshot) {
      // Read BEFORE clearing the winner — the inference matches siblings on the winner's outcome_at.
      const rows = (await readVersionStates(gcs.flatMap((p) => p.versionIds))) ?? []
      snapshot = inferWonCascadeSnapshot({ bidId: args.bidId, bidOutcome: args.bidOutcome, gcs, targetKey: targetKey ?? '', rows, nowIso: new Date().toISOString() })
    }
    const { error } = await supabase.from('bid_versions').update({ outcome: null, outcome_at: null, loss_category: null }).in('id', args.versionIds)
    if (error) return { error: error.message, bidOutcomeSet: null, autoLost: [] }

    const undo = wonCascadeUndo(snapshot)
    const targetIds = new Set(args.versionIds)
    const siblingPatches = undo.versionPatches.filter((v) => !targetIds.has(v.id))
    // One update per distinct prior state — the auto-lost siblings all go back to waiting in one write.
    const groups = new Map<string, { patch: { outcome: string | null; outcome_at: string | null; loss_category: string | null }; ids: string[] }>()
    for (const v of siblingPatches) {
      const k = `${v.outcome ?? ''}|${v.outcome_at ?? ''}|${v.loss_category ?? ''}`
      const g = groups.get(k) ?? { patch: { outcome: v.outcome, outcome_at: v.outcome_at, loss_category: v.loss_category }, ids: [] }
      g.ids.push(v.id)
      groups.set(k, g)
    }
    for (const g of groups.values()) {
      const { error: e2 } = await supabase.from('bid_versions').update(g.patch).in('id', g.ids)
      if (e2) return { error: e2.message, bidOutcomeSet: null, autoLost: [] }
    }
    let bidOutcomeRestoredTo: string | null | undefined = undefined
    if (undo.bidPatch) {
      // Only un-roll a bid that still reads won — a hand change since the tap stands.
      const { data: rows, error: e3 } = await supabase.from('bids').update({ outcome: undo.bidPatch.outcome }).eq('id', args.bidId).eq('outcome', 'won').select('id')
      if (e3) return { error: e3.message, bidOutcomeSet: null, autoLost: [] }
      if (updateApplied(rows)) bidOutcomeRestoredTo = undo.bidPatch.outcome
    }
    cascadeSnapshots.delete(args.bidId)
    if (args.actor) {
      await writePacketNote({
        bidId: args.bidId,
        gcCustomerId: targetGcCustomerId,
        notes: wonCascadeUndoNoteBody({ gcName: target?.name ?? 'the GC', restoredSiblingNames: undo.restoredSiblingNames, bidOutcomeRestoredTo }),
        userId: args.actor.userId,
      })
      recordOutcomeTelemetry(args.actor, null, true)
    }
    return { error: null, bidOutcomeSet: null, autoLost: [], undone: { restoredSiblings: undo.restoredSiblingNames, bidOutcomeRestoredTo } }
  }

  // A win: plan the cascade and snapshot every row it will touch BEFORE writing.
  const plan = args.outcome === 'won' && targetKey != null ? wonCascadePlan({ outcome: args.bidOutcome }, gcs, targetKey) : null
  let snapshot: WonCascadeSnapshot | null = null
  if (plan) {
    const touched = [...args.versionIds, ...plan.willLose.flatMap((p) => p.versionIds)]
    const rows = await readVersionStates(touched)
    if (rows) {
      snapshot = {
        bidId: args.bidId,
        targetKey: plan.target?.key ?? targetKey ?? '',
        targetVersionIds: [...args.versionIds],
        versions: rows,
        autoLostNames: plan.willLose.map((p) => p.name),
        bidOutcomeBefore: args.bidOutcome ?? null,
        bidOutcomeWritten: false,
        takenAt: new Date().toISOString(),
        source: 'session',
      }
    }
  }

  const { error } = await supabase
    .from('bid_versions')
    .update({ outcome: args.outcome, outcome_at: args.outcome ? today : null, ...(args.outcome === 'lost' ? {} : { loss_category: null }) })
    .in('id', args.versionIds)
  if (error) return { error: error.message, bidOutcomeSet: null, autoLost: [] }

  // A win with one GC: the other GCs that were sent and haven't answered lost the project.
  const autoLost: string[] = []
  let packets: PacketAfter[] = [...args.packetsAfter]
  if (plan && plan.willLose.length > 0) {
    const ids = plan.willLose.flatMap((p) => p.versionIds)
    const loseKeys = new Set(plan.willLose.map((p) => p.key))
    // No loss_category written: gcOutcomeRows infers "GC lost the project" for an unanswered packet
    // beside a win, and shows it as auto — tapping a reason records one for real.
    const { error: e2 } = await supabase.from('bid_versions').update({ outcome: 'lost', outcome_at: today }).in('id', ids)
    if (!e2) {
      for (const p of plan.willLose) autoLost.push(p.name)
      packets = packets.map((p) => (loseKeys.has(p.key ?? '') ? { ...p, outcome: 'lost' } : p))
    }
  }

  const finish = async (bidOutcomeSet: 'won' | 'lost' | null): Promise<SetGcPacketOutcomeResult> => {
    if (plan) {
      if (snapshot) {
        snapshot.bidOutcomeWritten = bidOutcomeSet === 'won'
        cascadeSnapshots.set(args.bidId, snapshot)
      } else {
        cascadeSnapshots.delete(args.bidId)
      }
      if (args.actor) {
        await writePacketNote({
          bidId: args.bidId,
          gcCustomerId: targetGcCustomerId,
          notes: wonCascadeNoteBody({ gcName: target?.name ?? 'the GC', autoLostNames: autoLost, bidOutcomeSet: bidOutcomeSet === 'won', overrodeHandSet: bidOutcomeSet === 'won' ? plan.overridesHandSetOutcome : null }),
          userId: args.actor.userId,
        })
      }
    }
    recordOutcomeTelemetry(args.actor, args.outcome, false)
    return { error: null, bidOutcomeSet, autoLost }
  }

  const roll = rollUpOutcome(packets)
  // Only move the bid-level outcome when it isn't already decided (won/lost/started) — the owner
  // may have set it by hand; a GC win always wins (the confirm said so first).
  const decided = args.bidOutcome === 'won' || args.bidOutcome === 'lost' || args.bidOutcome === 'started_or_complete'
  if (roll === 'won' && args.bidOutcome !== 'won' && args.bidOutcome !== 'started_or_complete') {
    const { data: rows, error: rollErr } = await supabase.from('bids').update({ outcome: 'won' }).eq('id', args.bidId).select('id')
    if (rollErr) return { error: rollErr.message, bidOutcomeSet: null, autoLost }
    if (!updateApplied(rows)) return { error: BID_UPDATE_NOT_APPLIED_MESSAGE, bidOutcomeSet: null, autoLost }
    return finish('won')
  }
  if (roll === 'lost' && !decided) {
    const { data: rows, error: rollErr } = await supabase.from('bids').update({ outcome: 'lost' }).eq('id', args.bidId).select('id')
    if (rollErr) return { error: rollErr.message, bidOutcomeSet: null, autoLost }
    if (!updateApplied(rows)) return { error: BID_UPDATE_NOT_APPLIED_MESSAGE, bidOutcomeSet: null, autoLost }
    return finish('lost')
  }
  return finish(null)
}

/** Per-GC loss reason (v2.2164): writes the packet's versions; the bid's own loss_category is untouched. */
export async function setGcPacketLossCategory(args: { versionIds: string[]; category: string; note?: string | null }): Promise<{ error: string | null }> {
  if (args.versionIds.length === 0) return { error: 'No packet to write to.' }
  const patch: { loss_category: string; outcome_note?: string } = { loss_category: args.category }
  if (args.note) patch.outcome_note = args.note
  const { error } = await supabase.from('bid_versions').update(patch).in('id', args.versionIds)
  return { error: error?.message ?? null }
}
