/**
 * The Pay view on a phone (punch list #30, PR 5b): a sheet is a row with one
 * number, and its verbs live in one bottom sheet. Pure — what the row says and
 * which verbs the sheet offers, in order, the first one the row's next move.
 */

export type SubPayPhoneVerb = 'writing' | 'payment' | 'payable_after' | 'backcharge' | 'edit' | 'print' | 'story' | 'lien_waiver'

export interface SubPayPhoneRowFacts {
  totalCost: number
  balance: number
  /** `sheetPayWhen`'s kind — 'ready' | 'queued' | 'wait' | 'hold' | 'walk' | 'work' | 'gap' | 'crew' | 'unpriced' | 'paid'. */
  payWhenKind: string
  /** The agreement button the desktop row draws under a gap, '' when none (a nudge is not a button here either). */
  writingLabel: string
  payableAfter: string | null
}

/** `$4,200 due` · `Paid` · `Over $120` · `unpriced` — the row's one number. */
export function subPayPhoneAmount(f: Pick<SubPayPhoneRowFacts, 'totalCost' | 'balance'>, formatMoney: (n: number) => string): { words: string; tone: 'due' | 'paid' | 'quiet' } {
  if (!(f.totalCost > 0)) return { words: 'unpriced', tone: 'quiet' }
  if (f.balance > 0) return { words: `${formatMoney(f.balance)} due`, tone: 'due' }
  if (f.balance < 0) return { words: `Over ${formatMoney(-f.balance)}`, tone: 'paid' }
  return { words: 'Paid', tone: 'paid' }
}

export interface SubPayPhoneVerbRow {
  verb: SubPayPhoneVerb
  label: string
  hint: string
  primary: boolean
  danger: boolean
}

/**
 * The sheet's verbs. The first is the row's next move: the agreement when
 * nothing is in writing, the payment when the sheet is ready. Payment is
 * offered whenever money is due; the payable-after date wherever the desktop
 * row offers it (waiting, queued or ready).
 */
export function subPayPhoneVerbs(f: SubPayPhoneRowFacts): SubPayPhoneVerbRow[] {
  const out: SubPayPhoneVerbRow[] = []
  const push = (verb: SubPayPhoneVerb, label: string, hint: string, opts: { danger?: boolean } = {}) => out.push({ verb, label, hint, primary: false, danger: Boolean(opts.danger) })
  const due = f.balance > 0
  const canQueue = f.payWhenKind === 'wait' || f.payWhenKind === 'queued' || f.payWhenKind === 'ready'
  const writing = f.payWhenKind === 'gap' && f.writingLabel.trim() !== ''
  if (writing) push('writing', f.writingLabel.trim(), 'Nothing is in writing on this sheet yet')
  if (due) push('payment', 'Record payment', writing ? 'Paying before it is in writing' : 'Opens Make Payment on this sheet')
  if (canQueue) push('payable_after', f.payableAfter ? 'Change the payable-after date' : 'Set a payable-after date', f.payableAfter ? `Queued for ${f.payableAfter}` : 'Queue it for a pay run')
  push('backcharge', 'Back-charge', 'Take money off this sheet', { danger: true })
  push('edit', 'Edit the sheet', 'Line items, rate, the sub')
  push('print', 'Print', 'The sub sheet as paper')
  push('story', 'Story', 'Every stage and date on this sheet')
  push('lien_waiver', 'Lien waiver', 'Send the sub a waiver for this sheet')
  if (out[0] && (out[0].verb === 'writing' || (out[0].verb === 'payment' && f.payWhenKind === 'ready'))) out[0].primary = true
  return out
}
