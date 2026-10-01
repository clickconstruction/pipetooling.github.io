/**
 * Commas in a money box while it is typed in (v2.4334) — "17777.51" shows as "17,777.51" as the
 * digits go in, without moving the cursor or getting in the way. Pure, so every edge has a test;
 * `MoneyTypingInput` draws the box.
 *
 * The value kept is always plain — digits and one dot, no commas ("17777.51") — so whatever reads
 * it (the waiver's amount, its autosave, its math) sees exactly what it saw before. The commas are
 * only on screen.
 *
 * How it stays out of the way:
 * - Cursor: the cursor is counted in kept characters (digits and the dot) and put back after the
 *   same count once the commas are redrawn, so typing or deleting in the middle stays in place.
 * - Backspace just after a comma (or Delete just before one) removes the digit beside it, not a
 *   comma that would only come back.
 * - Anything that is not a digit or the first dot is dropped: "$17,777.51" pasted reads 17777.51.
 * - At most two digits after the dot; leading zeros drop ("007" → "7", but "0.5" stays).
 * - Leaving the box settles it to cents: "9000" → "9,000.00", "17777.5" → "17,777.50".
 */

export type MoneyTypingResult = {
  /** What is kept: digits and at most one dot, no commas. */
  plain: string
  /** What the box shows: `plain` with commas in the whole-dollar part. */
  text: string
  /** Where the cursor goes in `text`. */
  caret: number
}

/**
 * Keep the digits and the first dot (at most two digits after it), drop leading zeros, and say how
 * many kept characters sat before the cursor in `raw`.
 */
export function moneyTypingSanitize(raw: string, caret: number): { plain: string; keptBefore: number } {
  const kept: { ch: string; at: number }[] = []
  let dotSeen = false
  let decimals = 0
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (ch >= '0' && ch <= '9') {
      if (dotSeen) {
        if (decimals >= 2) continue
        decimals++
      }
      kept.push({ ch, at: i })
    } else if (ch === '.' && !dotSeen) {
      dotSeen = true
      kept.push({ ch, at: i })
    }
  }
  // Leading zeros in the whole-dollar part drop, but one stays before a dot or when it is all there is.
  let lead = 0
  while (lead < kept.length - 1 && kept[lead]!.ch === '0' && kept[lead + 1]!.ch !== '.') lead++
  const out = kept.slice(lead)
  return { plain: out.map((k) => k.ch).join(''), keptBefore: out.filter((k) => k.at < caret).length }
}

/** "17777.51" → "17,777.51"; "" stays ""; ".5" stays ".5". */
export function moneyTypingGroup(plain: string): string {
  const dot = plain.indexOf('.')
  const whole = dot >= 0 ? plain.slice(0, dot) : plain
  const rest = dot >= 0 ? plain.slice(dot) : ''
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + rest
}

/** Where the cursor goes in the grouped text: just after the `keptBefore`-th kept character. */
export function moneyTypingCaret(text: string, keptBefore: number): number {
  if (keptBefore <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ',') seen++
    if (seen === keptBefore) return i + 1
  }
  return text.length
}

/** One edit as the box reports it: the raw text and the cursor in it. */
export function moneyTypingEdit(raw: string, caret: number): MoneyTypingResult {
  const { plain, keptBefore } = moneyTypingSanitize(raw, caret)
  const text = moneyTypingGroup(plain)
  return { plain, text, caret: moneyTypingCaret(text, keptBefore) }
}

/**
 * Backspace just after a comma, or Delete just before one, removes the digit on the far side of the
 * comma. Returns null for every other key press, which the box then handles as usual.
 */
export function moneyTypingDeleteAcrossComma(text: string, selStart: number, selEnd: number, key: string): MoneyTypingResult | null {
  if (selStart !== selEnd) return null
  if (key === 'Backspace' && selStart >= 2 && text[selStart - 1] === ',') {
    return moneyTypingEdit(text.slice(0, selStart - 2) + text.slice(selStart - 1), selStart - 2)
  }
  if (key === 'Delete' && text[selStart] === ',' && selStart + 1 < text.length) {
    return moneyTypingEdit(text.slice(0, selStart + 1) + text.slice(selStart + 2), selStart)
  }
  return null
}

/** Leaving the box: cents always shown. "" and "." stay empty; "9000" → "9000.00"; ".5" → "0.50". */
export function moneyTypingSettle(plain: string): string {
  const t = plain.replace(/[^0-9.]/g, '')
  if (t === '' || t === '.') return ''
  const n = Number(t)
  if (!Number.isFinite(n)) return plain
  return (Math.round(n * 100) / 100).toFixed(2)
}
