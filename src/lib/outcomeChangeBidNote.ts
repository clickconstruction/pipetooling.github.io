/** Stored `bids.outcome` value or null when unset / cleared */
export type BidOutcomeStored = 'won' | 'lost' | 'started_or_complete' | null

export function formatOutcomeForBidNote(outcome: string | null): string {
  if (outcome === 'won') return 'Won'
  if (outcome === 'lost') return 'Lost'
  if (outcome === 'started_or_complete') return 'Started or Complete'
  return 'Not set'
}

export function resolveActorDisplayName(
  profileName: string | null | undefined,
  authEmail?: string | null | undefined,
): string {
  const n = profileName?.trim()
  if (n) return n
  const e = authEmail?.trim()
  if (e) return e
  return 'Unknown user'
}

export function normalizedOutcomePayload(
  outcome: '' | 'won' | 'lost' | 'started_or_complete',
): BidOutcomeStored {
  return outcome === 'won' || outcome === 'lost' || outcome === 'started_or_complete' ? outcome : null
}

export function buildOutcomeChangeBidNoteBody(args: {
  previousOutcome: string | null
  nextOutcome: string | null
  actorDisplayName: string
  lossReason?: string | null
}): string {
  const from = formatOutcomeForBidNote(args.previousOutcome)
  const to = formatOutcomeForBidNote(args.nextOutcome)
  const actor = args.actorDisplayName.trim() || resolveActorDisplayName(null, null)
  let body = `Win/Loss changed from ${from} to ${to}. Changed by ${actor}.`
  if (args.nextOutcome === 'lost') {
    const lr = (args.lossReason ?? '').trim()
    if (lr) body += `\nLoss reason: ${lr}`
  }
  return body
}
