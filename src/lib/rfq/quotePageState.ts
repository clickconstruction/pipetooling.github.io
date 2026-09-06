/**
 * Pure decisions behind the public supply-house quote page (`/q/:token`,
 * `SupplyHouseQuotePage.tsx`). Journey-map J23 (Tier 3 batch B3, 2026-09-05):
 *
 * - Which screen renders (`quotePageView`): a failed SUBMIT used to replace
 *   the whole form with one sentence and nothing ever cleared it — the typed
 *   prices survived in localStorage but were unreachable without knowing to
 *   reload (J23-3, J23-N1). Submit failures are now a footer notice on top
 *   of the still-mounted form; the closed screen recaps what was typed.
 * - Whether the draft may be written (`shouldPersistDraft`): every visit
 *   used to mint a `rfqQuoteDraft_<token>` key, 404s and closed links
 *   included (J23-4).
 * - What the sticky footer says (`quoteFooterLines`): freight and
 *   valid-until sat uncounted above the lines; the footer now names them or
 *   marks their silence ("no freight quoted"), and carries the save promise
 *   that used to be clause 3 of a 12.8 px paragraph (J23-2, J23-6).
 * - What a vendor typed (`typedQuoteWork`): the closed / can't-load screens
 *   show it back so ten lines of thumb work never look discarded.
 */

export type QuoteDraftLine = { price: string; cantSupply: boolean; note: string; fromPrior?: boolean }
export type QuoteDraft = { quotedBy: string; validUntil: string; freight: string; lines: Record<string, QuoteDraftLine> }

export const EMPTY_QUOTE_DRAFT: QuoteDraft = { quotedBy: '', validUntil: '', freight: '', lines: {} }

/** "$1,234.50" / "412.5" / " 12 " → cents; 0, negatives and garbage → null. */
export function strToCents(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** A line counts as answered when it carries a readable price or a can't-supply. */
export function lineAnswered(dl: QuoteDraftLine | undefined): boolean {
  return !!dl && (dl.cantSupply || strToCents(dl.price) != null)
}

export function countAnswered(fixtures: ReadonlyArray<string>, draft: QuoteDraft): number {
  return fixtures.filter((f) => lineAnswered(draft.lines[f])).length
}

// ---------------------------------------------------------------------------
// Which screen renders
// ---------------------------------------------------------------------------

export type QuotePageView =
  /** Fetch in flight. */
  | 'loading'
  /** No page to show: incomplete link, 404, or the fetch failed. */
  | 'dead'
  /** The RFQ is closed — on first load, or discovered by a 410 on submit. */
  | 'closed'
  /** Quote sent. */
  | 'done'
  /** The form — also while a submit error is showing (the notice rides the footer). */
  | 'form'

export type QuotePageState = {
  loading: boolean
  /** Load-time failure only. Submit failures live in `submitError` and never leave the form. */
  loadError: string | null
  pageStatus: string | null
  done: number | null
}

export function quotePageView(s: QuotePageState): QuotePageView {
  if (s.loading) return 'loading'
  if (s.loadError) return 'dead'
  if (s.pageStatus == null) return 'dead'
  if (s.pageStatus === 'closed') return 'closed'
  if (s.done != null) return 'done'
  return 'form'
}

/** The sticky footer (count + Send) shows only on the form. */
export function quoteFooterVisible(s: QuotePageState): boolean {
  return quotePageView(s) === 'form'
}

// ---------------------------------------------------------------------------
// Draft persistence gate (J23-4)
// ---------------------------------------------------------------------------

/**
 * Write the localStorage draft only while there is an open form to draft for:
 * a token, a loaded page that is not closed, and no quote sent yet. A 404,
 * a failed load, a closed link and the done screen all write nothing —
 * though an existing draft is never deleted by any of them (only a
 * successful submit removes it). A draft loaded for another token (SPA
 * navigation between two `/q/` links) is never written under the new key.
 */
export function shouldPersistDraft(s: {
  token: string
  pageStatus: string | null
  done: number | null
  /** The token the in-memory draft was loaded for; when given and different, the draft is stale and must not be written under this key. */
  draftToken?: string
}): boolean {
  if (s.draftToken !== undefined && s.draftToken !== s.token) return false
  return s.token.trim() !== '' && s.pageStatus != null && s.pageStatus !== 'closed' && s.done == null
}

// ---------------------------------------------------------------------------
// What was typed (closed / can't-load recap)
// ---------------------------------------------------------------------------

export type TypedQuoteLine = { fixture: string; answer: string; note: string | null }
export type TypedQuoteWork = {
  lines: TypedQuoteLine[]
  /** Quote-level extras that carry a value ("Freight $45.00", "good until 2026-10-03", "from Danny · Moore Supply"). */
  extras: string[]
}

/**
 * Everything the vendor typed that would have gone into a quote, or null when
 * the draft is untouched. Lines with only a note still count — the note is
 * work too. Order follows `fixtures` when given (the page's own line order),
 * then anything left in the draft.
 */
export function typedQuoteWork(draft: QuoteDraft, fixtures: ReadonlyArray<string> = []): TypedQuoteWork | null {
  const order = [...fixtures, ...Object.keys(draft.lines).filter((f) => !fixtures.includes(f))]
  const lines: TypedQuoteLine[] = []
  for (const fixture of order) {
    const dl = draft.lines[fixture]
    if (!dl) continue
    const note = dl.note.trim() || null
    const cents = dl.cantSupply ? null : strToCents(dl.price)
    const answer = dl.cantSupply ? 'can’t supply' : cents != null ? formatCents(cents) : dl.price.trim() ? `“${dl.price.trim()}”` : ''
    if (!answer && !note) continue
    lines.push({ fixture, answer, note })
  }
  const extras: string[] = []
  const freightCents = strToCents(draft.freight)
  if (freightCents != null) extras.push(`Freight ${formatCents(freightCents)}`)
  else if (draft.freight.trim()) extras.push(`Freight “${draft.freight.trim()}”`)
  if (draft.validUntil.trim()) extras.push(`good until ${draft.validUntil.trim()}`)
  if (draft.quotedBy.trim()) extras.push(`from ${draft.quotedBy.trim()}`)
  if (lines.length === 0 && extras.length === 0) return null
  return { lines, extras }
}

// ---------------------------------------------------------------------------
// Sticky footer copy (J23-2, J23-6)
// ---------------------------------------------------------------------------

export type QuoteFooterLines = {
  /** "2 of 3 lines answered — partial is fine" */
  count: string
  /** "Freight $45.00 · good until 2026-10-03" or "No freight quoted · no expiry date" */
  extras: string
  /** The save promise, where the thumb is. */
  save: string
}

export function quoteFooterLines(args: { answered: number; total: number; draft: QuoteDraft }): QuoteFooterLines {
  const { answered, total, draft } = args
  const count = `${answered} of ${total} line${total === 1 ? '' : 's'} answered${answered > 0 ? ' — partial is fine' : ''}`

  const freightCents = strToCents(draft.freight)
  const freight = freightCents != null ? `Freight ${formatCents(freightCents)}` : draft.freight.trim() ? 'freight needs a number' : 'no freight quoted'
  const validity = draft.validUntil.trim() ? `good until ${draft.validUntil.trim()}` : 'no expiry date'
  const joined = `${freight} · ${validity}`
  const extras = joined.charAt(0).toUpperCase() + joined.slice(1)

  const touched = typedQuoteWork(draft) != null
  const save = touched ? 'Saved on this phone · nothing is sent until you tap Send quote' : 'Saves on this phone as you go'
  return { count, extras, save }
}

// ---------------------------------------------------------------------------
// Price basis hint (J23-5 — the smallest honest UI note)
// ---------------------------------------------------------------------------

const FOOTAGE_UNIT = /^(ft|lf|feet|foot|lin(ear)?\.? ?f(ee)?t\.?|')$/i

/**
 * What the $ box is asking for. The `/q/` lane records every price as
 * per-unit (`price_basis 'each'`, `basis_qty 1` in submit-rfq-quote) — so a
 * footage line's box asks "per ft", never "per 100 ft" or a lot. The paste
 * and file lanes (Rung E/G) capture richer bases; the divergence is
 * documented in docs/SUPPLY_HOUSE_RFQ_PLAN.md.
 */
export function priceBasisHint(unit: string | null | undefined): 'each' | 'per ft' {
  return FOOTAGE_UNIT.test((unit ?? '').trim()) ? 'per ft' : 'each'
}
