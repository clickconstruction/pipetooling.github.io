/**
 * Signed contracts in Google Drive (punch list #377): the app's door to the rules. They live in
 * `supabase/functions/_shared/jobContractDrive.ts`, so the function that files a paper, the Contract sweep's Drive pass,
 * the Contract window and Documents → Where files go read one implementation. This file adds the words only the app
 * prints: the press on Where files go, which says its count through `batchWords`.
 */
import { batchOutcomeWords, batchWords, type BatchOutcome, type BatchWords } from '../batchWords'

export * from '../../../supabase/functions/_shared/jobContractDrive'

const CONTRACT_NOUN = ['signed contract', 'signed contracts'] as const

/** The press on the Signed contracts card: *File 2 signed contracts*, dead when nothing waits. */
export function fileContractsWords(waiting: number, held: number): BatchWords {
  return batchWords({ verb: 'File', ready: waiting, held, heldWhy: { one: 'is held', many: 'are held' }, noun: CONTRACT_NOUN })
}

/** After the press: *Filed 2 signed contracts. 1 did not file.* */
export function fileContractsOutcome(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'file', past: 'filed', done, failed, noun: CONTRACT_NOUN })
}

/** The card's good empty state: nothing waits and nothing is held. */
export const CONTRACTS_ALL_FILED_WORDS = 'Nothing waiting on Drive. Every signed contract is filed.'
/** The card's two lines: where a paper goes, and who can open it there. */
export const CONTRACTS_CARD_WORDS = {
  title: 'Signed contracts',
  where: 'Each signed contract is filed in its job’s folder, under Team only › Contracts. Find a file finds it by its words.',
  who: 'Who can open it: the members of the jobs drive, and the office and estimators through Find a file.',
  sweep: 'The app also files them by itself, every ten minutes.',
} as const

/** *2 signed contracts are held. Each says why.* Null when none is. */
export function contractsHeldLine(held: number): string | null {
  if (held <= 0) return null
  return held === 1 ? '1 signed contract is held. It says why.' : `${held} signed contracts are held. Each says why.`
}
