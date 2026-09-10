/**
 * Bid basis (v2.3219) — the marked-up plans handoff from CountTooling.
 *
 * When the issued drawings are too rough to bid to, the estimator bids to the
 * marked-up plans and sends them with the proposal. The Cover Letter opens the
 * bid's CountTooling view link in a new tab with `export=bid-basis&ref=<bid>`;
 * CountTooling opens its Export PDFs dialog preset to the marked sheets, saves
 * the file under a name the estimator can search for later, and posts a
 * manifest back to this tab. Pure helpers only — no React, no Supabase.
 *
 * Wire contract (CountTooling bid-basis-model.js is the other half):
 *   { type: 'counttooling:bid-basis-loaded', version: 1, ref, projectId, projectName, viewToken, pdfHash, ctUpdatedAt }
 *   { type: 'counttooling:bid-basis-export', version: 1, ref, filename, saveMethod, fileSizeBytes,
 *     sheets[], sheetCount, pageIndices[], markTotals: {counters, runs}, notesCount, includeReport,
 *     projectName, projectId, viewToken, pdfHash, ctUpdatedAt, exportedAt, canvasSnapshot }
 */

export const BID_BASIS_EXPORT_MESSAGE_TYPE = 'counttooling:bid-basis-export'
export const BID_BASIS_LOADED_MESSAGE_TYPE = 'counttooling:bid-basis-loaded'
export const BID_BASIS_MESSAGE_VERSION = 1
export const BID_BASIS_URL_FLAG = 'bid-basis'

/** The CountTooling origins a manifest may come from. */
export const COUNTTOOLING_ORIGINS: readonly string[] = ['https://counttooling.com', 'https://www.counttooling.com']

export function isCountToolingMessageOrigin(origin: string, opts: { allowLocal?: boolean } = {}): boolean {
  if (COUNTTOOLING_ORIGINS.includes(origin)) return true
  if (opts.allowLocal && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true
  return false
}

export type BidBasisMarkTotals = { counters: number; runs: number }

export type BidBasisExportMessage = {
  type: typeof BID_BASIS_EXPORT_MESSAGE_TYPE
  version: number
  ref: string | null
  filename: string
  saveMethod: 'intended' | 'confirmed'
  fileSizeBytes: number | null
  sheets: string[]
  sheetCount: number
  pageIndices: number[]
  markTotals: BidBasisMarkTotals
  notesCount: number
  includeReport: boolean
  projectName: string
  projectId: string | null
  viewToken: string | null
  pdfHash: string | null
  ctUpdatedAt: string | null
  exportedAt: string
  canvasSnapshot: unknown | null
}

export type BidBasisLoadedMessage = {
  type: typeof BID_BASIS_LOADED_MESSAGE_TYPE
  version: number
  ref: string | null
  projectId: string | null
  projectName: string
  viewToken: string | null
  pdfHash: string | null
  ctUpdatedAt: string | null
}

const FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ ()-]{0,199}$/

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** A bid reference the way CountTooling carries it in the file name: `b409`. */
export function sanitizeBidBasisRef(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return s ? s.slice(0, 40) : null
}

/** Parse a `message` event's data into the export manifest, or null when it is not one. */
export function parseBidBasisExportMessage(data: unknown): BidBasisExportMessage | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.type !== BID_BASIS_EXPORT_MESSAGE_TYPE) return null
  if (num(d.version) !== BID_BASIS_MESSAGE_VERSION) return null
  const filename = str(d.filename)?.trim() ?? ''
  if (!FILENAME_RE.test(filename)) return null
  const sheets = Array.isArray(d.sheets) ? d.sheets.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 200)) : []
  const pageIndices = Array.isArray(d.pageIndices) ? d.pageIndices.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0) : []
  const totals = (d.markTotals && typeof d.markTotals === 'object') ? (d.markTotals as Record<string, unknown>) : {}
  return {
    type: BID_BASIS_EXPORT_MESSAGE_TYPE,
    version: BID_BASIS_MESSAGE_VERSION,
    ref: sanitizeBidBasisRef(d.ref),
    filename,
    saveMethod: d.saveMethod === 'confirmed' ? 'confirmed' : 'intended',
    fileSizeBytes: num(d.fileSizeBytes),
    sheets,
    sheetCount: num(d.sheetCount) ?? sheets.length,
    pageIndices,
    markTotals: { counters: num(totals.counters) ?? 0, runs: num(totals.runs) ?? 0 },
    notesCount: num(d.notesCount) ?? 0,
    includeReport: d.includeReport === true,
    projectName: str(d.projectName) ?? '',
    projectId: str(d.projectId),
    viewToken: str(d.viewToken),
    pdfHash: str(d.pdfHash),
    ctUpdatedAt: str(d.ctUpdatedAt),
    exportedAt: str(d.exportedAt) ?? new Date().toISOString(),
    canvasSnapshot: d.canvasSnapshot && typeof d.canvasSnapshot === 'object' ? d.canvasSnapshot : null,
  }
}

/** Parse the "loaded" notice CountTooling posts as soon as the plan opens in bid-basis mode. */
export function parseBidBasisLoadedMessage(data: unknown): BidBasisLoadedMessage | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.type !== BID_BASIS_LOADED_MESSAGE_TYPE) return null
  if (num(d.version) !== BID_BASIS_MESSAGE_VERSION) return null
  return {
    type: BID_BASIS_LOADED_MESSAGE_TYPE,
    version: BID_BASIS_MESSAGE_VERSION,
    ref: sanitizeBidBasisRef(d.ref),
    projectId: str(d.projectId),
    projectName: str(d.projectName) ?? '',
    viewToken: str(d.viewToken),
    pdfHash: str(d.pdfHash),
    ctUpdatedAt: str(d.ctUpdatedAt),
  }
}

/** `b409` — the same stamp the twin pipeline writes as CountTooling's external_ref (`bids.bid_number` is text). */
export function bidBasisRefForBid(bid: { bid_number?: string | number | null }): string {
  const n = String(bid.bid_number ?? '').trim()
  if (!n) return 'bid'
  return sanitizeBidBasisRef(/^[a-z]/i.test(n) ? n : `b${n}`) ?? 'bid'
}

/** The CountTooling view-link token (`?t=<uuid>`), or null when the link is not a CountTooling view link. */
export function countToolingViewToken(link: string | null | undefined): string | null {
  if (!link) return null
  try {
    const u = new URL(link.trim())
    const host = u.hostname.toLowerCase()
    const isCt = host === 'counttooling.com' || host.endsWith('.counttooling.com') || host === 'localhost' || host === '127.0.0.1'
    if (!isCt) return null
    const t = u.searchParams.get('t')?.trim() ?? ''
    return t ? t : null
  } catch {
    return null
  }
}

/** localStorage key (DEV builds only): point the handoff at a local CountTooling, e.g. `http://localhost:4571`. */
export const BID_BASIS_DEV_ORIGIN_KEY = 'bidBasis.ctOrigin'

/**
 * The bid's CountTooling link with the export flag and bid stamp appended, or
 * null when there is no usable link. `devOrigin` (DEV builds, from
 * localStorage) swaps the link's origin so a local CountTooling can be walked
 * against a real bid without editing it.
 */
export function bidBasisExportUrl(link: string | null | undefined, ref: string, devOrigin: string | null = null): string | null {
  if (!countToolingViewToken(link)) return null
  try {
    const u = new URL((link as string).trim())
    if (devOrigin) {
      const o = new URL(devOrigin)
      u.protocol = o.protocol
      u.host = o.host
    }
    u.searchParams.set('export', BID_BASIS_URL_FLAG)
    u.searchParams.set('ref', ref)
    return u.toString()
  } catch {
    return null
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Mirror of CountTooling's slug so the name predicted here matches the name it saves. */
export function bidBasisProjectSlug(name: string | null | undefined, maxLength = 40): string {
  const s = String(name ?? '').toLowerCase().replace(/\.pdf$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!s) return 'plans'
  if (s.length <= maxLength) return s
  const cut = s.slice(0, maxLength)
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > 10 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '') || 'plans'
}

/** `bid-basis_b409_<project>_2026-09-09_1432.pdf` — what CountTooling will name the file (local time). */
export function expectedBidBasisFilename(ref: string, projectName: string | null | undefined, at: Date = new Date()): string {
  const stamp = `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}_${pad2(at.getHours())}${pad2(at.getMinutes())}`
  return `bid-basis_${sanitizeBidBasisRef(ref) ?? 'bid'}_${bidBasisProjectSlug(projectName)}_${stamp}.pdf`
}

/** The bid number to search a computer for — the segment after `bid-basis_`. */
export function bidBasisSearchTerm(filename: string): string {
  const m = /^bid-basis_([a-z0-9-]+)_/i.exec(filename)
  return m?.[1] ?? 'bid-basis'
}

/**
 * CountTooling's default page labels are "<project> — p3"; renamed sheets are
 * "P-201". Strip the project prefix so the clause and the card read as sheets.
 */
export function shortSheetLabels(labels: readonly string[], projectName: string | null | undefined): string[] {
  const prefix = projectName ? `${projectName} — ` : null
  return labels.map((l) => {
    const t = l.trim()
    if (prefix && t.startsWith(prefix)) return t.slice(prefix.length).trim() || t
    return t
  })
}

export type BidBasisClauseInput = {
  /** The letter's formatted plan date, or null when the plan-date line is off / unset. */
  planDateFormatted: string | null
  /** Short sheet labels; empty when the export was stamped by hand. */
  sheets: readonly string[]
}

/** The sentence the letter carries beside the plan date. */
export function bidBasisClause(input: BidBasisClauseInput): string {
  const sheets = input.sheets.filter((s) => s.trim()).map((s) => s.trim())
  const dated = input.planDateFormatted ? ` dated ${input.planDateFormatted}` : ''
  const attached = sheets.length > 0
    ? `which accompanies this letter (${sheets.length} ${sheets.length === 1 ? 'sheet' : 'sheets'}: ${sheets.join(', ')})`
    : 'which accompanies this letter'
  return `This proposal is based on our marked-up copy of the plans${dated}, ${attached}. Where our marks and the issued drawings differ, our marks govern.`
}

export type BidBasisExportRowLike = {
  id: string
  exported_at: string
  filename: string
  save_method: string
  sheet_labels: string[] | null
  sheet_count: number | null
  ct_updated_at: string | null
  ct_project_name?: string | null
  superseded_at: string | null
}

/** Newest first; the current export is the newest row without `superseded_at`. */
export function sortBidBasisExports<T extends BidBasisExportRowLike>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.exported_at < b.exported_at ? 1 : a.exported_at > b.exported_at ? -1 : 0))
}

export function currentBidBasisExport<T extends BidBasisExportRowLike>(rows: readonly T[]): T | null {
  const sorted = sortBidBasisExports(rows)
  return sorted.find((r) => !r.superseded_at) ?? sorted[0] ?? null
}

/**
 * "Takeoff changed since": CountTooling reported a newer last-saved time than
 * the one the current export carries. Unknown on either side → not stale.
 */
export function bidBasisTakeoffMovedSince(row: { ct_updated_at: string | null } | null, latestCtUpdatedAt: string | null): boolean {
  if (!row?.ct_updated_at || !latestCtUpdatedAt) return false
  const a = Date.parse(row.ct_updated_at)
  const b = Date.parse(latestCtUpdatedAt)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return b > a + 1000
}

/** Row fields for a `bid_plan_basis_exports` insert from a manifest (caller adds bid_id / exported_by). */
export function bidBasisInsertFromMessage(m: BidBasisExportMessage): {
  filename: string
  save_method: 'reported' | 'confirmed'
  sheet_labels: string[]
  sheet_count: number
  page_indices: number[]
  mark_totals: BidBasisMarkTotals
  notes_count: number
  include_report: boolean
  file_size_bytes: number | null
  ct_project_id: string | null
  ct_project_name: string | null
  ct_view_token: string | null
  ct_pdf_hash: string | null
  ct_updated_at: string | null
  canvas_snapshot: unknown | null
  exported_at: string
} {
  return {
    filename: m.filename,
    // 'confirmed' = the browser's save picker confirmed the exact name (v2.3226); 'reported' = the intended download name.
    save_method: m.saveMethod === 'confirmed' ? 'confirmed' : 'reported',
    sheet_labels: m.sheets,
    sheet_count: m.sheetCount,
    page_indices: m.pageIndices,
    mark_totals: m.markTotals,
    notes_count: m.notesCount,
    include_report: m.includeReport,
    file_size_bytes: m.fileSizeBytes,
    ct_project_id: m.projectId,
    ct_project_name: m.projectName || null,
    ct_view_token: m.viewToken,
    ct_pdf_hash: m.pdfHash,
    ct_updated_at: m.ctUpdatedAt,
    canvas_snapshot: m.canvasSnapshot,
    exported_at: m.exportedAt,
  }
}
