/**
 * Per-GC outcome writes (Bids by GC, v2.2162): mark a GC packet won / lost / clear, then roll the
 * bid-level outcome up conservatively. Supabase-bound; the decision logic lives in gcPackets.ts.
 */
import { supabase } from '../supabase'
import { rollUpOutcome } from './gcPackets'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type PacketOutcome = 'won' | 'lost' | null

export async function setGcPacketOutcome(args: {
  bidId: string
  bidOutcome: string | null
  versionIds: string[]
  outcome: PacketOutcome
  /** All packets of the bid AFTER the change, for the roll-up. */
  packetsAfter: ReadonlyArray<{ outcome: string | null; sentOn: string | null }>
}): Promise<{ error: string | null; bidOutcomeSet: 'won' | 'lost' | null }> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const { error } = await supabase
    .from('bid_versions')
    .update({ outcome: args.outcome, outcome_at: args.outcome ? today : null })
    .in('id', args.versionIds)
  if (error) return { error: error.message, bidOutcomeSet: null }
  const roll = rollUpOutcome(args.packetsAfter)
  // Only move the bid-level outcome when it isn't already decided (won/lost/started) — the owner
  // may have set it by hand; a GC win always wins.
  const decided = args.bidOutcome === 'won' || args.bidOutcome === 'lost' || args.bidOutcome === 'started_or_complete'
  if (roll === 'won' && args.bidOutcome !== 'won' && args.bidOutcome !== 'started_or_complete') {
    await supabase.from('bids').update({ outcome: 'won' }).eq('id', args.bidId)
    return { error: null, bidOutcomeSet: 'won' }
  }
  if (roll === 'lost' && !decided) {
    await supabase.from('bids').update({ outcome: 'lost' }).eq('id', args.bidId)
    return { error: null, bidOutcomeSet: 'lost' }
  }
  return { error: null, bidOutcomeSet: null }
}
