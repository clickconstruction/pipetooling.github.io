/**
 * One RFC 5322 mailbox helper for the senders that keep `EMAIL_FROM`'s
 * verified address but show a different display name (punch list #53):
 * the customer never met "ClickTooling", so their bill, contract or estimate
 * arrives from the company they hired. Dependency-free — the app's tests
 * import it straight from here.
 */

/** The bare address inside a mailbox — `Name <addr>` → `addr`; a bare address is returned as is. */
export function mailboxAddress(mailbox: string): string {
  const inAngles = /<([^>]+)>/.exec(mailbox)?.[1]?.trim()
  return inAngles || mailbox.trim()
}

// RFC 5322 atext plus space: a display name made only of these prints bare; anything else
// (a comma, a period, quotes, a colon…) is quoted, with `\` and `"` escaped inside.
const BARE_NAME = /^[A-Za-z0-9 !#$%&'*+\-/=?^_`{|}~]+$/

/** A display name as it may appear before `<addr>` — bare when RFC 5322 allows it, quoted otherwise. */
export function mailboxDisplayName(name: string): string {
  const trimmed = name.trim()
  if (BARE_NAME.test(trimmed)) return trimmed
  return `"${trimmed.replace(/["\\]/g, (c) => `\\${c}`)}"`
}

/**
 * `name` on `mailbox`'s address: `mailboxWithName('Click Plumbing and Electrical', 'ClickTooling <team@x>')`
 * → `Click Plumbing and Electrical <team@x>`. An empty name keeps the mailbox as given.
 */
export function mailboxWithName(name: string, mailbox: string): string {
  const trimmed = name.trim()
  if (!trimmed) return mailbox.trim()
  return `${mailboxDisplayName(trimmed)} <${mailboxAddress(mailbox)}>`
}
