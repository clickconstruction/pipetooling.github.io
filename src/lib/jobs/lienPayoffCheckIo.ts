/**
 * The writes behind one check over many bills (punch list #435, piece 3; the rule is `lienPayoffCheck.ts`).
 *
 * Each ready line is one `mark_invoice_paid`, the function the bill's own *Record payment* calls: a Check, the
 * check's number, the day it was received and the note that names the whole check. It refuses an amount over what
 * the bill still owes, so a line pressed twice cannot pay a bill twice over.
 *
 * The lines are written one after another and the run keeps going past a line that fails: every line comes back
 * with whether it took and, when it did not, the reason. A write is tried once. A lost reply is not answered with
 * a second try, since a part payment sent twice would land twice.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PAYOFF_CHECK_WORDS } from './lienPayoffCheck'

export type PayoffCheckWrite = { invoiceId: string; amount: number }

export type PayoffCheckOutcome = { invoiceId: string; ok: boolean; why: string | null }

export async function recordPayoffCheck(lines: ReadonlyArray<PayoffCheckWrite>, check: { paidOn: string; number: string; note: string }): Promise<PayoffCheckOutcome[]> {
  const out: PayoffCheckOutcome[] = []
  for (const line of lines) {
    try {
      const { data, error } = await supabase.rpc('mark_invoice_paid', {
        p_invoice_id: line.invoiceId,
        p_amount: line.amount,
        p_paid_on: check.paidOn,
        p_note: check.note,
        p_payment_type: 'Check',
        p_reference_number: check.number.trim(),
      })
      if (error) throw error
      const refused = (data as { error?: unknown } | null)?.error
      if (typeof refused === 'string' && refused) out.push({ invoiceId: line.invoiceId, ok: false, why: refused })
      else out.push({ invoiceId: line.invoiceId, ok: true, why: null })
    } catch (e) {
      out.push({ invoiceId: line.invoiceId, ok: false, why: formatErrorMessage(e, PAYOFF_CHECK_WORDS.failed) })
    }
  }
  return out
}
