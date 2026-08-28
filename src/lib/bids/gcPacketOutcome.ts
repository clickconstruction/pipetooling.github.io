/**
 * Per-GC outcome writes (Bids by GC, v2.2162 / v2.2164): mark a GC packet won / lost / clear, then
 * roll the bid-level outcome up conservatively. A GC win also marks the bid's other sent, unanswered
 * packets lost (the winner got the job); the reason "GC lost the project" is inferred by gcOutcomeRows — editable, no triage.
 * Supabase-bound; the decision logic lives in gcPackets.ts / gcOutcomeRows.ts.
 */
import { supabase } from '../supabase'
import { rollUpOutcome } from './gcPackets'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, updateApplied } from './updateGuard'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type PacketOutcome = 'won' | 'lost' | null

export type PacketAfter = { key?: string; name?: string; outcome: string | null; sentOn: string | null; versionIds?: string[]; sharedLetter?: boolean }

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export async function setGcPacketOutcome(args: {
  bidId: string
  bidOutcome: string | null
  versionIds: string[]
  outcome: PacketOutcome
  /** All packets of the bid AFTER the change, for the roll-up (and, on a win, the auto-loss of the others). */
  packetsAfter: ReadonlyArray<PacketAfter>
}): Promise<{ error: string | null; bidOutcomeSet: 'won' | 'lost' | null; autoLost: string[] }> {
  const today = todayYmd()
  const { error } = await supabase
    .from('bid_versions')
    .update({ outcome: args.outcome, outcome_at: args.outcome ? today : null, ...(args.outcome === 'lost' ? {} : { loss_category: null }) })
    .in('id', args.versionIds)
  if (error) return { error: error.message, bidOutcomeSet: null, autoLost: [] }

  // A win with one GC: the other GCs that were sent and haven't answered lost the project.
  const autoLost: string[] = []
  let packets: PacketAfter[] = [...args.packetsAfter]
  if (args.outcome === 'won') {
    const others = packets.filter((p) => !p.sharedLetter && p.outcome == null && p.sentOn && (p.versionIds?.length ?? 0) > 0 && !p.versionIds!.some((id) => args.versionIds.includes(id)))
    if (others.length > 0) {
      const ids = others.flatMap((p) => p.versionIds ?? [])
      // No loss_category written: gcOutcomeRows infers "GC lost the project" for an unanswered packet
      // beside a win, and shows it as auto — tapping a reason records one for real.
      const { error: e2 } = await supabase.from('bid_versions').update({ outcome: 'lost', outcome_at: today }).in('id', ids)
      if (!e2) {
        for (const p of others) autoLost.push(p.name ?? 'another GC')
        packets = packets.map((p) => (others.includes(p) ? { ...p, outcome: 'lost' } : p))
      }
    }
  }

  const roll = rollUpOutcome(packets)
  // Only move the bid-level outcome when it isn't already decided (won/lost/started) — the owner
  // may have set it by hand; a GC win always wins.
  const decided = args.bidOutcome === 'won' || args.bidOutcome === 'lost' || args.bidOutcome === 'started_or_complete'
  if (roll === 'won' && args.bidOutcome !== 'won' && args.bidOutcome !== 'started_or_complete') {
    const { data: rows, error: rollErr } = await supabase.from('bids').update({ outcome: 'won' }).eq('id', args.bidId).select('id')
    if (rollErr) return { error: rollErr.message, bidOutcomeSet: null, autoLost }
    if (!updateApplied(rows)) return { error: BID_UPDATE_NOT_APPLIED_MESSAGE, bidOutcomeSet: null, autoLost }
    return { error: null, bidOutcomeSet: 'won', autoLost }
  }
  if (roll === 'lost' && !decided) {
    const { data: rows, error: rollErr } = await supabase.from('bids').update({ outcome: 'lost' }).eq('id', args.bidId).select('id')
    if (rollErr) return { error: rollErr.message, bidOutcomeSet: null, autoLost }
    if (!updateApplied(rows)) return { error: BID_UPDATE_NOT_APPLIED_MESSAGE, bidOutcomeSet: null, autoLost }
    return { error: null, bidOutcomeSet: 'lost', autoLost }
  }
  return { error: null, bidOutcomeSet: null, autoLost }
}

/** Per-GC loss reason (v2.2164): writes the packet's versions; the bid's own loss_category is untouched. */
export async function setGcPacketLossCategory(args: { versionIds: string[]; category: string; note?: string | null }): Promise<{ error: string | null }> {
  if (args.versionIds.length === 0) return { error: 'No packet to write to.' }
  const patch: { loss_category: string; outcome_note?: string } = { loss_category: args.category }
  if (args.note) patch.outcome_note = args.note
  const { error } = await supabase.from('bid_versions').update(patch).in('id', args.versionIds)
  return { error: error?.message ?? null }
}
