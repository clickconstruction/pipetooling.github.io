/**
 * Bids → Pricing: the Price book DRAWER (Pricing decomposition PR 4). Moved verbatim out of
 * `BidsPricingTab` (region P4 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`, re-mapped
 * 2026-09-17): the right-hand `role="dialog"` panel the Workbench opens — the book chips with
 * the ★ on the book feeding the bid, *Use <book> on this bid*, the per-person default line,
 * the frozen-copy caption, the Combined / Stage price toggle, *Add entry*, the search and the
 * browsed book's entries table.
 *
 * Every write stays in the tab — this drawer only renders and reports. The v2.2444 door
 * across (the amber offer after a book edit the bid's frozen copy did not receive) is passed
 * in as `offer`: the tab still owns `applyPendingBookOffer`, because a sent bid must not
 * re-price because someone tidied the book, and that rule lives beside the write. The Escape
 * listener and the close-time reset of the offer stay in the tab's effect too — they run
 * whether or not this panel is mounted.
 *
 * Two book ids are deliberately separate (v2.2396, Wendi): `browsedTemplateId` is the book
 * being READ here; `currentTemplateId` is the one feeding the bid. Clicking a chip only
 * browses — switching the bid is the explicit Use button, never a side effect.
 */
import type { CSSProperties } from 'react'
import { formatCurrency } from '../../lib/format'
import { resolvePricingWriteTarget } from '../../lib/bids/pricingWriteTarget'
import type { BookEditBidOffer } from '../../lib/bids/bookEditBidOffer'
import type { PriceBookEntryWithFixture, PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

export type PriceBookDrawerBooks = {
  /** The shared templates (the books the chips list). */
  templates: PriceBookVersion[]
  /** The bid's own pricings — read only to name the bid's frozen copy (v2.2444). */
  bidPricings: PriceBookVersion[]
  selectedPricingVersionId: string | null
  /** The book being READ in the drawer — not the one feeding the bid. */
  browsedTemplateId: string | null
  /** The template feeding the bid today (the ★ chip). */
  currentTemplateId: string | null
  /** The viewer's remembered default for new bids. */
  defaultTemplateId: string | null
  /** The chip row's show-all state. */
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** True while the tab is cloning a book into the bid — the chips and Use are disabled. */
  switchBusy: boolean
  onBrowse: (templateId: string) => void
  /** *Use <book> on this bid* — resolves when the tab has switched the bid's book. */
  onUseOnBid: (templateId: string) => Promise<void>
}

export type PriceBookDrawerEntries = {
  rows: PriceBookEntryWithFixture[]
  search: string
  onSearchChange: (value: string) => void
  displayMode: 'combined' | 'stage'
  onDisplayModeChange: (mode: 'combined' | 'stage') => void
}

/** What the drawer reads of the tab's pending offer; the tab's own type carries more. */
export type PriceBookDrawerPendingOffer = {
  offer: BookEditBidOffer
  siblingPricingCount: number
}

export type PriceBookDrawerOffer = {
  pending: PriceBookDrawerPendingOffer | null
  applying: boolean
  onApply: () => void | Promise<void>
  /** *Leave this bid alone.* */
  onDismiss: () => void
}

export type PriceBookDrawerDoors = {
  onAddBook: () => void
  onEditBook: (version: PriceBookVersion) => void
  onAddEntry: () => void
  onEditEntry: (entry: PriceBookEntryWithFixture) => void
  onClose: () => void
}

export function BidsPriceBookDrawer({
  books,
  entries,
  offer,
  doors,
}: {
  books: PriceBookDrawerBooks
  entries: PriceBookDrawerEntries
  offer: PriceBookDrawerOffer
  doors: PriceBookDrawerDoors
}) {
  const { templates, bidPricings, selectedPricingVersionId, browsedTemplateId, currentTemplateId, defaultTemplateId, expanded, switchBusy } = books
  const { rows, search, displayMode } = entries
  const pendingBookOffer = offer.pending
  const drawerName = templates.find((t) => t.id === browsedTemplateId)?.name ?? 'Price book'
  const defaultName = templates.find((t) => t.id === defaultTemplateId)?.name ?? null
  const bookChipStyle = (on: boolean): CSSProperties => ({
    font: 'inherit',
    fontSize: '0.75rem',
    fontWeight: on ? 700 : 500,
    padding: '0.2rem 0.6rem',
    borderRadius: 6,
    border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
    background: on ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
    color: on ? 'var(--text-strong)' : 'var(--text-muted)',
    cursor: 'pointer',
  })
  const visibleEntries = rows.filter((e) => (e.fixture_types?.name ?? '').toLowerCase().includes(search.toLowerCase()))
  // v2.2444: the bid's OWN book — a frozen copy of a template that kept the template's
  // name. Naming it here is what stops "WENDI" in this drawer reading as "WENDI" on the bid.
  const bidBookName = bidPricings.find((v) => v.id === selectedPricingVersionId)?.name ?? null
  const drawerWriteTarget = resolvePricingWriteTarget({ selectedPricingVersionId, bidPricings, templates })
  const cell: CSSProperties = { padding: '0.4rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border)' }
  return (
    <div
      role="dialog"
      aria-label="Price book"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(430px, 92vw)', background: 'var(--surface)', borderLeft: '1px solid var(--border-strong)', boxShadow: '-14px 0 30px rgba(0,0,0,0.28)', zIndex: 70, padding: '1rem 1.1rem 1.2rem', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Price book — {drawerName}</h3>
        <button type="button" onClick={doors.onClose} aria-label="Close the price book" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
      </div>
      {/* v2.2444 (Wendi): the book edit just made does NOT reach the bid on screen — its
          copy is frozen. This is the door across, offered once, per edit, never automatic:
          a sent bid must not re-price because someone tidied the book. */}
      {pendingBookOffer ? (
        <div role="status" style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.55rem 0.65rem', marginBottom: '0.65rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-700)', lineHeight: 1.4 }}>
            {pendingBookOffer.offer.kind === 'update' ? (
              <>
                This bid still prices <strong>{pendingBookOffer.offer.fixtureName}</strong> at $
                {formatCurrency(pendingBookOffer.offer.bidTotal)} — it holds its own copy of the book, taken when
                it was first priced.
                {pendingBookOffer.siblingPricingCount > 0 ? (
                  <>
                    {' '}
                    {pendingBookOffer.siblingPricingCount} more price option
                    {pendingBookOffer.siblingPricingCount === 1 ? '' : 's'} on this bid hold
                    {pendingBookOffer.siblingPricingCount === 1 ? 's' : ''} the same $
                    {formatCurrency(pendingBookOffer.offer.bidTotal)} and will update with it.
                  </>
                ) : null}
              </>
            ) : (
              <>
                <strong>{pendingBookOffer.offer.fixtureName}</strong> isn&rsquo;t in this bid&rsquo;s copy of the
                book, so it won&rsquo;t come up when you assign a row.
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem' }}>
            <button
              type="button"
              disabled={offer.applying}
              onClick={() => void offer.onApply()}
              style={{ font: 'inherit', fontSize: '0.76rem', fontWeight: 700, padding: '0.26rem 0.7rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: offer.applying ? 'wait' : 'pointer', opacity: offer.applying ? 0.6 : 1 }}
            >
              {offer.applying
                ? 'Working…'
                : pendingBookOffer.offer.kind === 'update'
                  ? `Use $${formatCurrency(pendingBookOffer.offer.bookTotal)} on this bid`
                  : 'Add it to this bid too'}
            </button>
            <button
              type="button"
              onClick={offer.onDismiss}
              style={{ font: 'inherit', fontSize: '0.76rem', fontWeight: 600, padding: '0.26rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
            >
              Leave this bid alone
            </button>
          </div>
        </div>
      ) : null}
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Book</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginBottom: '0.25rem' }}>
        {(expanded ? templates : templates.filter((t) => t.id === browsedTemplateId)).map((t) => {
          const on = t.id === browsedTemplateId
          const used = t.id === currentTemplateId
          return (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
              <button
                type="button"
                disabled={switchBusy}
                // v2.2396 (Wendi): clicking a book only BROWSES it — switching the bid
                // (which clones the book in) moved to the explicit Use button below.
                title={used ? 'Feeding this bid' : `Look inside ${t.name} — the bid keeps its book until you press Use`}
                onClick={() => {
                  if (on) return
                  books.onBrowse(t.id)
                }}
                style={bookChipStyle(on)}
              >
                {used ? '★ ' : ''}{t.name}
              </button>
              {on && expanded ? (
                <button type="button" onClick={() => doors.onEditBook(t)} title="Rename this book" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', padding: 0 }}>✎</button>
              ) : null}
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => books.onExpandedChange(!expanded)}
          title={expanded ? 'Show just your book' : 'Show all price books'}
          style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-link)', border: '1px dashed var(--border-strong)', background: 'none', borderRadius: 6, padding: '0.12rem 0.5rem', cursor: 'pointer' }}
        >
          {expanded ? '‹' : '›'}
        </button>
        {expanded ? (
          <button type="button" onClick={doors.onAddBook} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Add book
          </button>
        ) : null}
      </div>
      {/* v2.2396 (Wendi): switching the bid's book is this explicit button, never a side
          effect of clicking around — each press used to mint another price version. */}
      {browsedTemplateId && browsedTemplateId !== currentTemplateId ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0 0.55rem' }}>
          <button
            type="button"
            disabled={switchBusy}
            onClick={() => {
              void (async () => {
                await books.onUseOnBid(browsedTemplateId)
                books.onExpandedChange(false)
              })()
            }}
            title={`Price this bid from ${drawerName} — and make it your default for new bids`}
            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0.8rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: switchBusy ? 'wait' : 'pointer', opacity: switchBusy ? 0.6 : 1 }}
          >
            {switchBusy ? 'Switching…' : `Use ${drawerName} on this bid`}
          </button>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Browsing only — the bid still prices from its ★ book.</span>
        </div>
      ) : null}
      {defaultName ? (
        <div title="Per person — the book you pick follows you to your next bid" style={{ fontSize: '0.68rem', color: 'var(--text-green-700)', marginBottom: '0.6rem' }}>
          Your default for new bids: <strong>{defaultName}</strong> ✓
        </div>
      ) : null}
      {/* v2.2444 (Wendi): said for EVERY book, not just one you're browsing away to. The
          old caption appeared only when the selected book differed from the bid's — so on
          the bid's own book, the case where you're most likely to edit and expect it to
          take, nothing explained the freeze at all. */}
      {bidBookName ? (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '0.6rem' }}>
          Edits here change the shared book. This bid prices from <strong>{bidBookName}</strong>, its own copy
          taken when it was first priced — it keeps its prices until you carry a change across.
        </div>
      ) : drawerWriteTarget.kind === 'shared' ? (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '0.6rem' }}>
          Edits here change the shared book. This bid has no copy yet — it shows <strong>{drawerWriteTarget.name}</strong> as
          it stands today; the first price you assign takes this bid's own copy, and book edits stop reaching it.
        </div>
      ) : null}
      {/* v2.2386 (Wendi): Add entry rides beside the price-mode toggle — always visible, no scroll to the list's foot. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
          {(
            [
              ['combined', 'Combined price'],
              ['stage', 'Stage price'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={displayMode === key}
              onClick={() => entries.onDisplayModeChange(key)}
              style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.7rem', border: 'none', background: displayMode === key ? 'var(--bg-blue-tint)' : 'var(--surface)', color: displayMode === key ? 'var(--text-strong)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={doors.onAddEntry}
          disabled={!browsedTemplateId}
          style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.75rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Add entry
        </button>
      </div>
      <input
        type="text"
        placeholder="Search fixture/tie-in name..."
        value={search}
        onChange={(e) => entries.onSearchChange(e.target.value)}
        style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: '0.5rem', boxSizing: 'border-box', fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
      />
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead style={{ background: 'var(--bg-subtle)' }}>
            <tr>
              <th style={{ ...cell, textAlign: 'left', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Fixture / Tie-in</th>
              {displayMode === 'combined' ? (
                <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Price</th>
              ) : (
                <>
                  <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Rough In</th>
                  <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Top Out</th>
                  <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Trim Set</th>
                </>
              )}
              <th style={{ ...cell, width: 34 }} />
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.id}>
                <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }} title={displayMode === 'stage' ? `Combined: $${formatCurrency(Number(entry.total_price))}` : undefined}>
                  {entry.fixture_types?.name ?? ''}
                </td>
                {displayMode === 'combined' ? (
                  <td style={cell}>${formatCurrency(Number(entry.total_price))}</td>
                ) : (
                  <>
                    <td style={{ ...cell, color: Number(entry.rough_in_price) === 0 ? 'var(--text-faint)' : undefined }}>{Number(entry.rough_in_price) === 0 ? '—' : `$${formatCurrency(Number(entry.rough_in_price))}`}</td>
                    <td style={{ ...cell, color: Number(entry.top_out_price) === 0 ? 'var(--text-faint)' : undefined }}>{Number(entry.top_out_price) === 0 ? '—' : `$${formatCurrency(Number(entry.top_out_price))}`}</td>
                    <td style={{ ...cell, color: Number(entry.trim_set_price) === 0 ? 'var(--text-faint)' : undefined }}>{Number(entry.trim_set_price) === 0 ? '—' : `$${formatCurrency(Number(entry.trim_set_price))}`}</td>
                  </>
                )}
                <td style={cell}>
                  <button type="button" onClick={() => doors.onEditEntry(entry)} style={{ padding: '0.1rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                </td>
              </tr>
            ))}
            {visibleEntries.length === 0 ? (
              <tr>
                <td colSpan={displayMode === 'combined' ? 3 : 5} style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {search ? `No entries match “${search}”` : 'No entries yet'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
        A price added in Combined lands in <strong>Rough In</strong> — flip to Stage price to split it. Esc or ✕ closes.
      </p>
    </div>
  )
}
