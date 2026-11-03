/**
 * Money words for the charges surfaces (punch list #254, the owner's rule of 2026-11-03): the cents are always
 * smaller text than the whole dollars. One kernel splits a figure into its sign, its dollars and its cents, so no
 * paper, window or ledger cell formats money by hand; the surface draws the cents in a smaller span.
 */

export type MoneyParts = {
  /** `−` for a figure below zero, else ''. */
  sign: '' | '−'
  /** `$241,968` */
  dollars: string
  /** `.73` */
  cents: string
  /** `$241,968.73`, or `−$537.73`. */
  words: string
}

export function moneyParts(amount: number): MoneyParts {
  const n = Number.isFinite(amount) ? amount : 0
  const abs = Math.round(Math.abs(n) * 100) / 100
  const whole = Math.floor(abs)
  const centsNum = Math.round((abs - whole) * 100)
  const sign: '' | '−' = n < 0 && abs > 0 ? '−' : ''
  const dollars = `$${whole.toLocaleString('en-US')}`
  const cents = `.${String(centsNum).padStart(2, '0')}`
  return { sign, dollars, cents, words: `${sign}${dollars}${cents}` }
}

/** The plain words, for a sentence: `$241,968.73`. */
export function moneyWords(amount: number): string {
  return moneyParts(amount).words
}
