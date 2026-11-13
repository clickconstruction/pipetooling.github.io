/**
 * The figure a look shows on a phone's strip (the Gray Fox spike, 2026-11-02: the owner on the wrapped
 * chips, *I don't like how this looks on mobile*). Six cells share 375 points, so a cell holds the
 * look's name over one figure: the number that leads the amber words when something waits on the
 * leader (*3 likely pairs* → *3*), else the number that leads the count (*0 new* → *0*). Money from
 * ten thousand up is rounded to fit the cell (*$186,116.84 left* → *$186k*, *$2,197,171* → *$2.2M*) and
 * smaller money drops its cents; the whole words stay on the cell's label and title, and the look
 * itself carries the cents.
 */
export function lookFigure(look: { count: string; need: string | null }): string {
  const words = look.need && look.need.trim() ? look.need : look.count
  const m = /^(\$?)(\d[\d,]*)(?:\.\d+)?/.exec(words.trim())
  if (!m) return words.trim()
  if (!m[1]) return m[0]
  const n = Number((m[2] ?? '').replace(/,/g, ''))
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`
  return `$${m[2]}`
}
