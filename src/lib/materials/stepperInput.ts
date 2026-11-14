/**
 * The number sheet's field as it is typed in (Materials on site, v2.7252, punch list #344 PR 9). The field wrote
 * every keystroke straight to the number, floored at 1, so clearing it to type 25 put the 1 back at once and the
 * next key made 12 or 15. The field now keeps what is typed, and this says which number that is: none while the
 * field is empty or holds no number, else the number held to 1 and the most the box has.
 */
export function stepperTyped(raw: string, max: number): number | null {
  const text = raw.trim()
  if (!text) return null
  const v = Number(text)
  if (!Number.isFinite(v)) return null
  return Math.min(Math.max(1, Math.round(max)), Math.max(1, Math.round(v)))
}

/** What the field shows after a keystroke: the text as typed while it is that number or empty, else nothing kept, so the field shows the number it was held to. */
export function stepperKeeps(raw: string, max: number): string | null {
  const v = stepperTyped(raw, max)
  return v == null || String(v) === raw.trim() ? raw : null
}
