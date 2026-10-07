/**
 * The office's Firm's links dialog (v2.4750): every link the firm ever had, from one read of
 * `list_legal_portal_links` — the firm's own link (one live, the one every email carries), one
 * link per person at the firm (any number, each turned off alone), and the dead ones with when,
 * why and by whom. Live links come with their address, read back from Vault on the server; a
 * dead link's key is gone, so it is named by its label and dates.
 */
import { isLegalPortalSlugKey, legalPortalAddress } from './legalPortalAddress'

export type LegalPortalLinkPurpose = 'firm' | 'person'
export type LegalPortalLinkRevokeReason = 'rotated' | 'off' | 'replaced'

export type LegalPortalLinkRow = {
  id: string
  purpose: LegalPortalLinkPurpose
  /** Who a person link is for; null on the firm's own link. */
  label: string | null
  createdAt: string
  createdBy: string | null
  revokedAt: string | null
  revokedBy: string | null
  revokeReason: LegalPortalLinkRevokeReason | null
  /** The raw key of a live link; null once it is dead, or when Vault could not give it back. */
  token: string | null
}

export type LegalPortalLinksView = {
  /** The firm's own live link. */
  firm: LegalPortalLinkRow | null
  /** Live person links, oldest first. */
  people: LegalPortalLinkRow[]
  /** Dead links, newest first. */
  past: LegalPortalLinkRow[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** The RPC's answer, `{ links: [...] }`, as rows; null when the shape is not that (an error, or the RPC is not live yet). */
export function parseLegalPortalLinks(data: unknown): LegalPortalLinkRow[] | null {
  const links = (data as { links?: unknown } | null)?.links
  if (!Array.isArray(links)) return null
  const rows: LegalPortalLinkRow[] = []
  for (const raw of links) {
    const r = raw as Record<string, unknown>
    const id = str(r.id)
    const createdAt = str(r.createdAt)
    if (!id || !createdAt) continue
    const reason = str(r.revokeReason)
    rows.push({
      id,
      purpose: r.purpose === 'person' ? 'person' : 'firm',
      label: str(r.label),
      createdAt,
      createdBy: str(r.createdBy),
      revokedAt: str(r.revokedAt),
      revokedBy: str(r.revokedBy),
      revokeReason: reason === 'rotated' || reason === 'off' || reason === 'replaced' ? reason : null,
      token: str(r.token),
    })
  }
  return rows
}

export function groupLegalPortalLinks(rows: ReadonlyArray<LegalPortalLinkRow>): LegalPortalLinksView {
  const live = rows.filter((r) => !r.revokedAt)
  const byCreated = (a: LegalPortalLinkRow, b: LegalPortalLinkRow) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  return {
    firm: live.find((r) => r.purpose === 'firm') ?? null,
    people: live.filter((r) => r.purpose === 'person').sort(byCreated),
    past: rows.filter((r) => r.revokedAt).sort((a, b) => Date.parse(b.revokedAt!) - Date.parse(a.revokedAt!)),
  }
}

/** The link's name on the list: the firm's own, or who the person link is for. */
export function legalLinkName(row: Pick<LegalPortalLinkRow, 'purpose' | 'label'>, firmName: string): string {
  return row.purpose === 'firm' ? `${firmName}’s own link` : (row.label ?? '').trim() || 'A person at the firm'
}

/** The live link's address, when its key is known. */
export function legalLinkAddress(row: Pick<LegalPortalLinkRow, 'token'>, origin: string): string | null {
  return row.token ? legalPortalAddress(origin, row.token) : null
}

/** A live link minted before v2.4750: its key is not a slug, so its address does not carry the firm's name. */
export function legalLinkIsOldShape(row: Pick<LegalPortalLinkRow, 'token'>): boolean {
  return Boolean(row.token) && !isLegalPortalSlugKey(row.token!)
}

/** Under a live link: *since 2026-10-06 by Robert*. */
export function legalLinkSinceLine(row: Pick<LegalPortalLinkRow, 'createdAt' | 'createdBy'>, ymd: (iso: string) => string): string {
  return `since ${ymd(row.createdAt)}${row.createdBy ? ` by ${row.createdBy}` : ''}`
}

/** A dead link's line: *2026-09-11 to 2026-10-06 · rotated by Robert*. */
export function legalLinkPastLine(row: Pick<LegalPortalLinkRow, 'createdAt' | 'revokedAt' | 'revokedBy' | 'revokeReason'>, ymd: (iso: string) => string): string {
  const what = row.revokeReason === 'rotated' ? 'rotated' : row.revokeReason === 'replaced' ? 'the firm was replaced' : 'turned off'
  const by = row.revokedBy && row.revokeReason !== 'replaced' ? ` by ${row.revokedBy}` : ''
  return `${ymd(row.createdAt)} to ${row.revokedAt ? ymd(row.revokedAt) : '—'} · ${what}${by}`
}

/** Under the dialog's title: what the firm holds now. */
export function legalLinksSummary(view: LegalPortalLinksView): string {
  const n = (view.firm ? 1 : 0) + view.people.length
  if (n === 0) return view.past.length ? 'No link is live.' : 'No link yet.'
  const parts: string[] = []
  if (view.firm) parts.push('the firm’s own')
  if (view.people.length) parts.push(`${view.people.length} for ${view.people.length === 1 ? 'one person' : 'people'} at the firm`)
  return `${n} live link${n === 1 ? '' : 's'}: ${parts.join(' and ')}.`
}
