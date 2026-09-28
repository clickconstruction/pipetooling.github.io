/**
 * Bid → job import, the decisions: which GC the job is for, what figure it opens at, and what
 * the office is asked. Pure — the job form reads the bid, its versions and its sends, asks its
 * two questions and writes; everything it decides in between is here.
 */
import { formatCurrency } from '../jobs/jobFormMoney'
import { resolveWinningPacket, type GcPacket } from './gcPackets'

/** A GC the import can be for. Same shape as the winning-GC picker's option. */
export type BidImportGcOption = {
  /** GcPacket.key ('' = own GC, 'shared:<cid>' = shared-letter recipient). */
  key: string
  customerId: string | null
  name: string
  sentOn: string | null
  value: number | null
  outcome: string | null
  sharedLetter: boolean
}

type BidNaming = { bid_number: string | null; project_name: string | null }

/** "B482 · Oak Ridge", or the fallback when the bid has neither a number nor a name. */
export function bidImportLabel(bid: BidNaming, fallback: string): string {
  return [bid.bid_number ? `B${String(bid.bid_number).trim()}` : null, (bid.project_name ?? '').trim() || null].filter(Boolean).join(' · ') || fallback
}

/**
 * The GCs to choose among: one per packet, and — when the bid has a GC but no packet of its own
 * (recipients, no versions) — the bid's GC first, riding the shared letter with no value.
 */
export function bidImportGcOptions(args: {
  packets: ReadonlyArray<GcPacket>
  bidCustomerId: string | null
  /** The bid GC's name from the form's customer cache, when it is there. */
  cachedBidGcName: string | null | undefined
  /** The bid GC's name as the bid read embedded it. */
  embeddedBidGcName: string | null | undefined
  bidDateSent: string | null
}): BidImportGcOption[] {
  const { packets, bidCustomerId } = args
  const options: BidImportGcOption[] = packets.map((p) => ({ key: p.key, customerId: p.gcId, name: p.name, sentOn: p.sentOn, value: p.sentValue, outcome: p.outcome, sharedLetter: !!p.sharedLetter }))
  if (bidCustomerId && !packets.some((p) => p.key === '')) {
    const ownName = (args.cachedBidGcName ?? args.embeddedBidGcName ?? '').trim() || 'the GC'
    options.unshift({ key: '', customerId: null, name: ownName, sentOn: args.bidDateSent ?? null, value: null, outcome: null, sharedLetter: true })
  }
  return options
}

export type BidImportGcDecision =
  /** Go on: `chosen` is the recorded winner (null with one GC or none); `sentValue` is what that GC was sent. */
  | { kind: 'proceed'; chosen: BidImportGcOption | null; sentValue: number | null }
  /** Ask which GC. `writesWin` — the pick records the Won — unless more than one packet already says won. */
  | { kind: 'ask'; writesWin: boolean }

/**
 * One GC imports silently at its sent value. Several: exactly one recorded winner imports
 * silently as that GC; none, or more than one, asks.
 */
export function decideBidImportGc(packets: ReadonlyArray<GcPacket>, options: ReadonlyArray<BidImportGcOption>): BidImportGcDecision {
  if (options.length <= 1) return { kind: 'proceed', chosen: null, sentValue: options.length === 1 ? (options[0]?.value ?? null) : null }
  const { winner, multiple } = resolveWinningPacket(packets)
  if (!winner) return { kind: 'ask', writesWin: !multiple }
  return {
    kind: 'proceed',
    chosen: { key: winner.key, customerId: winner.gcId, name: winner.name, sentOn: winner.sentOn, value: winner.sentValue, outcome: winner.outcome, sharedLetter: false },
    sentValue: winner.sentValue,
  }
}

/**
 * The figure offered for the job's first line item (v2.2909, J15-F8): the bid's agreed value
 * when it is a number above zero, else what the GC was sent when that is above zero, else
 * nothing to offer. `agreedValue` is the bid's column as a number — null only when the column
 * is empty, so an unreadable value still counts as "the bid has one" for the wording and for
 * whether the carry is recorded on the bid.
 */
export function bidImportCarry(args: { agreedValueRaw: number | string | null | undefined; sentValue: number | null }): { agreedValue: number | null; carryValue: number | null } {
  const agreedValue = args.agreedValueRaw == null ? null : Number(args.agreedValueRaw)
  const { sentValue } = args
  const carryValue = agreedValue != null && Number.isFinite(agreedValue) && agreedValue > 0 ? agreedValue : sentValue != null && sentValue > 0 ? sentValue : null
  return { agreedValue, carryValue }
}

/** "Start the job at $X?" — the one question, and what Yes and No do. */
export function bidImportCarryQuestion(args: {
  carryValue: number
  agreedValue: number | null
  bid: BidNaming
  /** The chosen GC's name, else the bid's. */
  gcName: string | null | undefined
}): { title: string; message: string; confirmLabel: string; cancelLabel: string } {
  const { carryValue, agreedValue } = args
  const bidLabel = bidImportLabel(args.bid, 'the bid')
  const whoseFigure = agreedValue != null ? `${bidLabel}'s agreed value` : `what ${(args.gcName ?? '').trim() || 'the GC'} was sent on ${bidLabel}`
  return {
    title: `Start the job at $${formatCurrency(carryValue)}?`,
    message: `That's ${whoseFigure}. Yes puts it on the job as the first line item${agreedValue == null ? ' and records it on the bid as the agreed value' : ''}; No starts the job at $0 and writes nothing.`,
    confirmLabel: `Carry $${formatCurrency(carryValue)} over`,
    cancelLabel: 'Start at $0',
  }
}

/** The line item a carried figure becomes. The caller gives it an id. */
export function bidImportFirstLine(args: { carryValue: number; agreedValue: number | null; bid: BidNaming }): {
  name: string
  count: number
  line_unit_price: number
  line_description: string
  invoice_id: null
} {
  const bidLabel = bidImportLabel(args.bid, 'the bid')
  return {
    name: 'Bid price',
    count: 1,
    line_unit_price: args.carryValue,
    line_description: args.agreedValue != null ? `${bidLabel} — agreed value` : `${bidLabel} — as sent`,
    invoice_id: null,
  }
}

/**
 * The job's GC: the winning packet's (per-GC Phase 3) — a chosen option with no customer of its
 * own is the bid's GC — else the bid's. Named from the form's cache first; else the bid's
 * embedded name for its own GC, the option's name for another; "—" when nothing names it.
 */
export function bidImportEffectiveGc(args: {
  chosen: BidImportGcOption | null
  bidCustomerId: string | null
  embeddedBidGcName: string | null | undefined
  cachedNameOf: (customerId: string) => string | null | undefined
}): { id: string; name: string } | null {
  const { chosen, bidCustomerId } = args
  const effGcId = chosen ? (chosen.customerId ?? bidCustomerId) : bidCustomerId
  if (!effGcId) return null
  const effIsOwn = effGcId === bidCustomerId
  return { id: effGcId, name: (args.cachedNameOf(effGcId) ?? (effIsOwn ? args.embeddedBidGcName : chosen?.name) ?? '').trim() || '—' }
}

/**
 * What picking a GC writes on the bid: that packet's versions marked won, with every packet as
 * it stands after. Null when the packet has no versions (nothing to mark). A packet that read
 * lost remembers it, so the undo can put it back.
 */
export function bidImportWinWrite(
  packets: ReadonlyArray<GcPacket>,
  pickedKey: string,
): {
  versionIds: string[]
  packetsAfter: Array<{ key: string; name: string; outcome: string | null; sentOn: string | null; versionIds: string[]; sharedLetter: boolean }>
  previousOutcome: 'lost' | null
} | null {
  const packet = packets.find((p) => p.key === pickedKey)
  const versionIds = (packet?.versions ?? []).map((v) => v.id)
  if (versionIds.length === 0) return null
  return {
    versionIds,
    packetsAfter: packets.map((p) => ({
      key: p.key,
      name: p.name,
      outcome: p.key === pickedKey ? 'won' : p.outcome,
      sentOn: p.sentOn,
      versionIds: p.versions.map((v) => v.id),
      sharedLetter: !!p.sharedLetter,
    })),
    previousOutcome: packet?.outcome === 'lost' ? 'lost' : null,
  }
}
