/**
 * Whether the sub ledger's reads are whole (punch list #350, the audit of 2026-11-20).
 *
 * The ledger reads its sheets, then each sheet's lines and money. A sheet drawn without its money reads unpaid,
 * and one drawn without its lines reads as agreed at nothing. The papers stand on the same rows: a statement of
 * account made after a failed read would say so under a number. So a read that fails stops the draw. The ledger
 * keeps what it last read whole, and says why the new read was not used.
 *
 * Pure: no React, no Supabase.
 */
import { formatErrorMessage } from '../../utils/errorHandling'

/** A read's refusal, as the client hands it back. Null or absent is a read that came back. */
export type SubLedgerReadError = unknown

/**
 * The words for a ledger read that must not be drawn, or null when both reads came back. The payments lead when
 * both failed: unpaid is the worse thing to say of a sheet.
 */
export function subLedgerReadFailure(reads: { lines: SubLedgerReadError; payments: SubLedgerReadError }): string | null {
  const what = reads.payments ? 'payments' : reads.lines ? 'lines' : null
  if (!what) return null
  const reason = formatErrorMessage(what === 'payments' ? reads.payments : reads.lines, 'no reason was given').trim().replace(/[.\s]+$/, '')
  const wrong = what === 'payments' ? 'every sheet would read unpaid' : 'every sheet would read as agreed at nothing'
  return `The sub sheets were not read again: their ${what} did not load, and without them ${wrong}. ${reason}. Reload the page to try again.`
}
