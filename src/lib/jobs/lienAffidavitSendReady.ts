import type { LienAffidavitEntry } from './lienDeskAffidavits'

/**
 * Whether the batch send takes this lien affidavit (v2.7852): it is in To send for Master approval and a person made
 * its row, by opening and reading it. A paper nobody has opened has no row, and the batch never sends it.
 *
 * One rule for the send plan (`lienAffidavitSendPlan`) and for the Board's bin (`buildLienBoard`), so the bin's count
 * and its press cannot disagree. It has a file of its own because `lienDeskAffidavits.ts` is copied to the edge
 * functions (`scripts/edge-kernels.mjs`): a rule no function reads does not belong in that copy.
 */
export function lienAffidavitSendReady(e: Pick<LienAffidavitEntry, 'pile' | 'item'>): boolean {
  return e.pile === 'to_draft' && e.item != null && e.item.status === 'drafted'
}
