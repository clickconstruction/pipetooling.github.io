/**
 * Money, split for the eye (the owner's rule: the cents are always smaller text than the whole dollars; punch
 * list #254 for the charges surfaces on 2026-11-03, the whole app on 2026-11-23). One kernel splits a figure into
 * its sign, its dollars and its cents, so no screen formats money by hand. The drawn half is
 * `src/components/Money.tsx`, the app's one door for an amount on a screen.
 *
 * The digits are `toLocaleString`'s, the same call `formatCurrency` makes, so a screen that moves to the door
 * never shows a figure a cent away from the one it showed before.
 */

/** The cents' size beside their dollars, in `em` so it follows the text around it. One ratio for every screen. */
export const MONEY_CENTS_EM = 0.7

export type MoneySign = '' | '−' | '+'

export type MoneyParts = {
  /** `−` for a figure below zero, `+` for one at or above it when the screen asks for both, else ''. */
  sign: MoneySign
  /** `$241,968` */
  dollars: string
  /** `.73`, or '' for a figure in whole dollars. */
  cents: string
  /** `$241,968.73`, or `−$537.73`. */
  words: string
}

export type MoneyPartsOptions = {
  /** The mark before the dollars. `$` unless a column draws bare figures (''). */
  symbol?: string
  /** `loss`, the default, marks only a figure below zero. `both` also marks zero and above with `+`. */
  sign?: 'loss' | 'both'
  /** `false` for a figure in whole dollars: rounded, and no cents to draw. */
  cents?: boolean
}

export function moneyParts(amount: number, options: MoneyPartsOptions = {}): MoneyParts {
  const n = Number.isFinite(amount) ? amount : 0
  const text =
    options.cents === false
      ? Math.abs(Math.round(n)).toLocaleString('en-US', { maximumFractionDigits: 0 })
      : Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const dot = options.cents === false ? -1 : text.lastIndexOf('.')
  // A figure that rounds to nothing is not a loss: −0.004 reads $0.00, never −$0.00.
  const nothing = !/[1-9]/.test(text)
  const sign: MoneySign = n < 0 && !nothing ? '−' : options.sign === 'both' ? '+' : ''
  const dollars = `${options.symbol ?? '$'}${dot === -1 ? text : text.slice(0, dot)}`
  const cents = dot === -1 ? '' : text.slice(dot)
  return { sign, dollars, cents, words: `${sign}${dollars}${cents}` }
}

/** The plain words, for a sentence: `$241,968.73`. */
export function moneyWords(amount: number, options?: MoneyPartsOptions): string {
  return moneyParts(amount, options).words
}

/** An amount a string holds, cut where its cents begin. */
export type MoneyTextAmount = { dollars: string; cents: string }

/** A piece of a line of text: plain words, or an amount with its cents apart. */
export type MoneyTextPart = string | MoneyTextAmount

/** An amount inside a line of text. Only a figure with its `$` counts, so `8.50 h` and `v2.83` stay words. */
const AMOUNT_IN_WORDS = /(\$\d[\d,]*)(\.\d{2})(?!\d)/g

/**
 * Text a kernel already wrote, cut at each amount so the cents can draw smaller: `Paid: $1,250.00` is
 * `Paid: `, then `$1,250` with `.00`. Joined back, the pieces are the text, character for character. A string
 * with no amount in it is one piece of words.
 */
export function moneyTextParts(text: string): MoneyTextPart[] {
  const parts: MoneyTextPart[] = []
  let last = 0
  for (const m of text.matchAll(AMOUNT_IN_WORDS)) {
    const at = m.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    parts.push({ dollars: m[1] ?? '', cents: m[2] ?? '' })
    last = at + m[0].length
  }
  if (last < text.length || parts.length === 0) parts.push(text.slice(last))
  return parts
}

/**
 * A cell that holds one bare figure, already formatted, with or without a sign or a dollar sign: `14,115.35`,
 * `−40.00`. Null for anything else (`—`, `…`, `8.0 h`), so a cell that is not money passes through untouched.
 * Only a column that is known to hold money reads its cells this way, since `8.50` alone could be hours.
 */
export function moneyFigureParts(text: string): MoneyTextAmount | null {
  const m = /^([+−-]?\$?\d[\d,]*)(\.\d{2})$/.exec(text.trim())
  return m ? { dollars: m[1] ?? '', cents: m[2] ?? '' } : null
}
