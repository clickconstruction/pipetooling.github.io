/**
 * AR refresh PR 4 (v2.3382): the footer says what Apply will do, in words —
 * "Applies $250.00 to 992 · Done Right Foundation. The bill is settled." —
 * or why it can't yet. Pure; tested beside it.
 */
import { parseAllocationDollars } from './arAllocationProgress'

export type ArApplyLineSlice = { kind: 'billed' | 'payment'; targetKey: string; amountStr: string }
export type ArApplyTargetSlice = { hcpNumber: string; jobName: string; customerName: string; remaining: number }
export type ArApplyPaymentSlice = { amount: number | string | null; hcp_number: string | null; job_name: string | null }

export type ArApplySentence = {
  text: string
  tone: 'ready' | 'waiting' | 'warn'
  /** Dollars the lines on screen would apply (0 when nothing is ready). */
  total: number
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function targetWords(t: ArApplyTargetSlice): string {
  const who = t.customerName.trim() || t.jobName.trim()
  return `${t.hcpNumber.trim() || '—'}${who ? ` · ${who}` : ''}`
}

export function arApplySentence(args: {
  lines: ReadonlyArray<ArApplyLineSlice>
  targetByKey: ReadonlyMap<string, ArApplyTargetSlice>
  paymentById: ReadonlyMap<string, ArApplyPaymentSlice>
  depositRemaining: number
  validation: string | null
  /** v2.3496: the tip strip is on screen, so the waiting text names that way out too. */
  tipOffered?: boolean
  /** v2.3529: the close-out strip is on screen (nothing applied yet), so the waiting text names that exit too. */
  closeOutOffered?: boolean
  /** Applied-means-Income: the switch is on and the deposit is unlabelled, so Apply will book it as Income in Banking. */
  booksIncome?: boolean
  /** Applied-means-Income: the deposit already carries this other label, which Apply leaves alone. */
  bankLabelStays?: string | null
}): ArApplySentence {
  if (args.validation) return { text: args.validation, tone: 'warn', total: 0 }
  const remaining = Math.max(0, Number(args.depositRemaining) || 0)
  if (remaining <= 0.005) return { text: 'Nothing left to allocate on this deposit.', tone: 'waiting', total: 0 }

  const parts: string[] = []
  let total = 0
  let settledTail = ''
  let onlyPayment: { amt: number; where: string } | null = null
  let billedCount = 0
  for (const line of args.lines) {
    if (line.kind === 'payment') {
      const p = line.targetKey ? args.paymentById.get(line.targetKey) : undefined
      if (!p) continue
      const amt = Math.abs(Number(p.amount) || 0)
      if (amt <= 0) continue
      total += amt
      const where = `${(p.hcp_number ?? '').trim() || '—'}${(p.job_name ?? '').trim() ? ` · ${(p.job_name ?? '').trim()}` : ''}`
      parts.push(`links the ${money(amt)} payment on ${where}`)
      onlyPayment = { amt, where }
      continue
    }
    const t = line.targetKey ? args.targetByKey.get(line.targetKey) : undefined
    if (!t) continue
    const amt = parseAllocationDollars(line.amountStr)
    if (amt <= 0) continue
    total += amt
    billedCount += 1
    parts.push(`${money(amt)} to ${targetWords(t)}`)
    const left = Math.round((t.remaining - amt) * 100) / 100
    settledTail = left <= 0.005 ? ' The bill is settled.' : ` ${money(left)} stays open on it.`
  }
  total = Math.round(total * 100) / 100
  if (parts.length === 0) {
    const ways = args.tipOffered
      ? 'pick a bill, link a recorded payment, or add it as a tip'
      : args.closeOutOffered
        ? 'pick a bill, link a recorded payment, or close it out with a reason'
        : 'pick a bill, or link a recorded payment'
    return { text: `Remaining ${money(remaining)} — ${ways}.`, tone: 'waiting', total: 0 }
  }
  const unapplied = Math.round((remaining - total) * 100) / 100
  const tail = unapplied > 0.005 ? ` ${money(unapplied)} of the deposit stays unapplied.` : ''
  // Applied-means-Income: one clause, said once, at the moment of the act.
  const stays = (args.bankLabelStays ?? '').trim()
  const incomeTail = args.booksIncome ? ' Books the deposit as Income.' : stays ? ` Stays ${stays} in Banking.` : ''
  if (parts.length === 1 && onlyPayment && billedCount === 0) {
    return { text: `Links this deposit to the ${money(onlyPayment.amt)} payment already on ${onlyPayment.where} — no new payment is created.${tail}${incomeTail}`, tone: 'ready', total }
  }
  if (parts.length === 1) {
    const act = args.booksIncome ? `Applies ${parts[0]} and books it as Income.` : `Applies ${parts[0]}.`
    const staysTail = args.booksIncome ? '' : incomeTail
    return { text: `${act}${settledTail}${tail}${staysTail}`, tone: 'ready', total }
  }
  return { text: `Applies ${money(total)} across ${parts.length} lines — ${parts.join(', ')}.${tail}${incomeTail}`, tone: 'ready', total }
}

/** The deposit to land on after "Apply & next": the one below the current row, else the one above; null when alone. */
export function arNextDepositId(orderedIds: ReadonlyArray<string>, currentId: string | null): string | null {
  if (!currentId) return null
  const i = orderedIds.indexOf(currentId)
  if (i < 0) return null
  return orderedIds[i + 1] ?? orderedIds[i - 1] ?? null
}
