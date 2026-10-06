/**
 * The office's Firm's link dialog once the token is hash-only at rest (punch
 * list #85, item 22). The table no longer gives the office the raw token; the
 * mint RPC returns it once, when the link is created or rotated. So the dialog
 * knows the link's address only in the session that minted it. Before the
 * migration is pushed the table still answers with the token, and the dialog
 * shows it as it always did: one code path for both.
 *
 * The office can always preview the portal: by the firm's id, signed in
 * (`/legal?firm=<id>&preview=1`, which `legal-portal` answers for the four
 * office roles), not by the firm's key.
 */
import { withPreviewFlag } from '../publicViewCounting'

export type PortalLinkRow = { id?: string | null; token?: string | null; created_at: string; revoked_at: string | null }

export type PortalLinkView =
  | { kind: 'none' }
  | { kind: 'off' }
  /** `token` null: the link is live, but its address was shown only when it was minted. */
  | { kind: 'active'; since: string; token: string | null; id: string | null }

/**
 * The dialog's state from the firm's link rows (newest first) and the token this session minted, if any.
 * A minted token belongs to the live row created at or after it was minted; an older live row cannot be it.
 */
export function portalLinkView(rows: ReadonlyArray<PortalLinkRow>, minted: { token: string; since: string } | null): PortalLinkView {
  const live = rows.find((r) => !r.revoked_at)
  if (live) {
    const fromRow = typeof live.token === 'string' && live.token ? live.token : null
    const fromMint = minted && Date.parse(live.created_at) >= Date.parse(minted.since) - 60_000 ? minted.token : null
    return { kind: 'active', since: live.created_at, token: fromRow ?? fromMint, id: live.id ?? null }
  }
  return rows.length ? { kind: 'off' } : { kind: 'none' }
}

/** The firm's link to copy (only while the token is known) and the office's preview (always). */
export function firmPortalUrls(origin: string, firmId: string, token: string | null): { copyUrl: string | null; previewUrl: string } {
  const copyUrl = token ? `${origin}/legal?t=${token}` : null
  return { copyUrl, previewUrl: copyUrl ? withPreviewFlag(copyUrl) : `${origin}/legal?firm=${encodeURIComponent(firmId)}&preview=1` }
}

/** Under the link when its address is not known in this session. */
export const COPY_ONLY_AT_MINT = 'Its address can be copied only when it is created or rotated. Send the link below emails it to the firm at any time.'
