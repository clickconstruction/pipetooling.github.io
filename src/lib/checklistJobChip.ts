/**
 * The row chip (v2.3769): a task sent from a job carries the job as a named
 * link token, `{{1:1016 · Mission faucet}} — <task>`, whose link [1] is the
 * job door `/jobs?jobDetail=<id>` (v2.3751 kept that shape on purpose). On
 * every task list the token used to render as an underlined link followed by
 * the dash; now it renders as a chip — number badge, name, ↗ — and the dash is
 * dropped from the display. Nothing stored changes, so every task already
 * sent gets the chip too. The stored title carries no trade, and the lists
 * hold no job cache, so the badge is the plain number.
 *
 * Only a token whose link is a job door qualifies: vehicle tasks link to the
 * fleet page, pasted links and typed `[2]`s keep their underline.
 */

/** True for `/jobs?jobDetail=<id>`, absolute or relative, whatever else the query carries. */
export function isJobDoorLink(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  try {
    const u = new URL(url.trim(), 'https://placeholder.invalid')
    return u.pathname === '/jobs' && Boolean(u.searchParams.get('jobDetail')?.trim())
  } catch {
    return false
  }
}

/** "1016 · Mission faucet" → number 1016, name Mission faucet; "— · Job" → no number. */
export function splitJobLinkLabel(label: string): { number: string | null; name: string } {
  const at = label.indexOf(' · ')
  if (at < 0) return { number: null, name: label.trim() }
  const num = label.slice(0, at).trim()
  const name = label.slice(at + 3).trim()
  return { number: num && num !== '—' ? num : null, name: name || 'Job' }
}

/**
 * The length of the " — " (any dash) that follows the token in the stored
 * title, so the display can skip it; 0 when the token is followed by something else.
 */
export function dashAfterTokenLength(rest: string): number {
  const m = /^\s*[—–-]\s*/.exec(rest)
  return m ? m[0].length : 0
}
