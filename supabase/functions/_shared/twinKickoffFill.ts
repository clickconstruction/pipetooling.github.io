// The kickoff a redeemed setup code hands back (twin-setup, action redeem), filled for the twin the key belongs to.
// A kickoff in docs/twins/kickoffs/ is written for its kind's first seat ("You are **twin-estimator-1**"), and until
// now every redeem returned those words, so a key minted for Twin Estimator 4 opened by telling its session it was
// twin-estimator-1. Two values are filled here: the connector's address, and the seat's own name in place of the
// first seat's. The Console's Copy buttons hand out the doc as written: they hold no key, so they name no other seat.
// Pure: no env, no network. Tests: src/lib/bids/twinKickoffFill.test.ts.

import { KICKOFF_CONNECTOR_PLACEHOLDER } from './twinKickoffs.ts'
import { PT_TWIN_DOMAIN, type TwinSeatKind } from './twinSeat.ts'

/** The seat each kind's kickoff is written for; the test holds every bundled kickoff to naming it once, in bold. */
export const KICKOFF_DEFAULT_SEAT: Record<TwinSeatKind, string> = { estimator: 'twin-estimator-1', pricer: 'twin-pricer-1' }

/** A seat's name as a kickoff says it: the fleet address without its domain. Null when it is not a fleet address. */
export function twinSeatHandle(email: string | null | undefined): string | null {
  const s = String(email ?? '').trim().toLowerCase()
  if (!s.endsWith(PT_TWIN_DOMAIN)) return null
  const handle = s.slice(0, -PT_TWIN_DOMAIN.length)
  return /^twin-[a-z_]+-\d+$/.test(handle) ? handle : null
}

/**
 * The kickoff for one twin: the connector's address filled in, and the first seat's name swapped for this twin's.
 * A twin whose address is not a fleet address keeps the doc's words, as does the first seat itself.
 */
export function fillTwinKickoff(doc: string, opts: { connectorUrl: string; kind: TwinSeatKind; twinEmail: string | null | undefined }): string {
  const filled = doc.split(KICKOFF_CONNECTOR_PLACEHOLDER).join(opts.connectorUrl)
  const handle = twinSeatHandle(opts.twinEmail)
  const written = KICKOFF_DEFAULT_SEAT[opts.kind]
  if (!handle || handle === written) return filled
  return filled.split(`**${written}**`).join(`**${handle}**`)
}
