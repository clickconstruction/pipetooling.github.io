/**
 * A name that ends in a period closes its own sentence (v2.7957). Counsel's lien letters end several sentences on the
 * original contractor's name or on ours: "working under Acme & Assoc." is whole, and the letter's own period after it
 * printed a second one. This takes the period the letter adds after such a name and no other character: a name with
 * no period at its end changes nothing, and neither does the name inside a sentence ("Acme & Assoc. has not paid us")
 * or before a real ellipsis.
 */
export function oneClosingPeriod(text: string, names: ReadonlyArray<string | null | undefined>): string {
  let out = text
  for (const raw of names) {
    const name = (raw ?? '').trim()
    if (!name.endsWith('.')) continue
    out = out.replace(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(?!\\.)`, 'g'), () => name)
  }
  return out
}
