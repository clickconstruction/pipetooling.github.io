/**
 * Price what has no price, one row at a time (punch list #342, PR 1): the window a site's
 * materials screen opens from its list of rows with no price. It shows one name with its boxes
 * and its offers (`priceOffers.ts`), takes one answer and moves to the next (`pricingWalk.ts`).
 *
 * An offer is a guess, drawn with a dashed edge and the word Offer, and nothing is taken until a
 * person presses it or its number key. A parts-book part writes the tie that already exists
 * (`on_site_part_ties`). Since PR 2 a bill's price, a price typed in the box and **Not a part**
 * each write one row of the site's own prices (`on_site_prices`). Every answer is undone from the
 * window's foot. Before that table is on the database, or for a reader it gives nothing to, the
 * bills are shown to read and the box is not drawn.
 *
 * Since PR 3 the same window walks the rows on a price older than 90 days (`mode="old"`): it
 * shows the price a row reads now and offers only a bill newer than that price.
 *
 * The window owns the walk and nothing else: the rows, the offers and the writes are handed in.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { EmptyState } from '../EmptyState'
import { emptyWordsWithPress } from '../../lib/emptyWords'
import { BookPartPicker } from './BookPartPicker'
import type { BookPartHit } from '../../lib/materials/bookSearchIo'
import { parsePriceInput } from '../../lib/materials/materialPriceIndex'
import { priceWords, type PricePick } from '../../lib/materials/bookPrice'
import { offerWords, rowOffers, type BillOffer, type PriceOffer } from '../../lib/materials/priceOffers'
import { answerWalk, currentKey, skipWalk, startWalk, undoWalk, walkEndWords, walkWords, type Walk } from '../../lib/materials/pricingWalk'
import type { SitePartRow } from '../../lib/materials/siteRollup'
import type { PriceOffersState } from '../../hooks/usePriceOffers'

/** The two keys of the tie an answer wrote, so Undo can find it. */
export type TiePair = { aKey: string; bKey: string }

/** What an answer wrote, so Undo can take it back: a tie, or one row of the site's own prices. */
export type PricingAnswer = { kind: 'tie'; pair: TiePair } | { kind: 'price'; id: string }

type Props = {
  siteName: string
  /** `none` walks the rows with no price; `old` walks the rows on a price older than 90 days. */
  mode?: 'none' | 'old'
  /** The rows to walk, most pieces first. Live: a row that gets a price, or a fresh one, leaves the list. */
  rows: ReadonlyArray<SitePartRow>
  /** The price a row reads now, for the old prices' walk. */
  nowPick?: (row: SitePartRow) => PricePick | null
  offers: PriceOffersState
  today: string
  searchBook: (term: string) => Promise<BookPartHit[]>
  /** Tie the row's name to a parts-book part. The pair written, or null when the table refused (the screen says why). */
  onUsePart: (row: SitePartRow, part: { id: string; name: string }) => Promise<TiePair | null>
  /** The site's own prices can be written: a bill's price is an answer, and the box and Not a part are drawn. */
  canOwnPrice: boolean
  /** Accept what a bill paid as the row's price on this site. The answer's id, or null when refused. */
  onUseBill: (row: SitePartRow, offer: BillOffer) => Promise<string | null>
  /** Accept a typed price for one. */
  onTypePrice: (row: SitePartRow, price: number) => Promise<string | null>
  /** Set the row aside as not a part to price. */
  onLeaveOut: (row: SitePartRow) => Promise<string | null>
  /** Take an answer back. False when it could not be. */
  onUndo: (answer: PricingAnswer) => Promise<boolean>
  onClose: () => void
}

/** How many offers a row shows before **more fits**. */
const FIRST_OFFERS = 3

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const btn: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const kbd: CSSProperties = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.7rem', fontWeight: 700, borderWidth: '1px 1px 2px', borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 5, padding: '0 5px', color: 'var(--text-700)', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' }
const chipBox: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap', color: 'var(--text-strong)', borderColor: 'var(--border-strong)', background: 'var(--bg-subtle)', fontVariantNumeric: 'tabular-nums' }
// An offer is a guess: a dashed edge, never the look of a checked price.
const offerBox: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '2px 10px', alignItems: 'center', minHeight: 52, width: '100%', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'var(--border-strong)', borderRadius: 10, padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.82rem', textAlign: 'left' }

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable))
}

export function SitePricingWindow({ siteName, mode = 'none', rows, nowPick, offers, today, searchBook, onUsePart, canOwnPrice, onUseBill, onTypePrice, onLeaveOut, onUndo, onClose }: Props) {
  const old = mode === 'old'
  // The order is fixed when the window opens, so a row never jumps under the reader.
  const [walk, setWalk] = useState<Walk>(() => startWalk(rows.map((r) => r.key)))
  const [showAll, setShowAll] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [last, setLast] = useState<{ key: string; name: string; words: string; answer: PricingAnswer } | null>(null)

  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r] as const)), [rows])
  const key = currentKey(walk, (k) => byKey.has(k))
  const row = key ? (byKey.get(key) ?? null) : null
  const rowKey = row?.key ?? null
  const now = row && old && nowPick ? nowPick(row) : null
  const nowDay = now?.checkedOn ?? ''
  const found: PriceOffer[] = useMemo(() => {
    if (!row || !offers.index) return []
    const all = rowOffers(row, offers.index)
    // An old price is checked against a newer bill, never against the book it already reads.
    return old ? all.filter((o) => o.kind === 'bill' && (o.datedOn ?? '') > nowDay) : all
  }, [row, offers.index, old, nowDay])
  const shown = showAll ? found : found.slice(0, FIRST_OFFERS)
  // An offer that can be pressed is an answer, numbered as drawn. A bill is one once the site's own prices can be written.
  const answers = shown.filter((o) => o.kind === 'book' || canOwnPrice)
  const billsToRead = shown.filter((o): o is BillOffer => o.kind === 'bill' && !canOwnPrice)
  const typed = parsePriceInput(draft)
  const pieces = rows.reduce((sum, r) => sum + r.total, 0)

  // A new row starts closed: its first offers, no picker.
  useEffect(() => {
    setShowAll(false)
    setPicking(false)
    setDraft('')
  }, [rowKey])

  /** One answer: the write, then the foot's line and the next row. A refused write leaves the row where it is. */
  const take = async (write: (row: SitePartRow) => Promise<PricingAnswer | null>, words: string) => {
    if (!row || busy) return
    setBusy(true)
    try {
      const answer = await write(row)
      if (!answer) return
      setLast({ key: row.key, name: row.name, words, answer })
      setWalk((w) => answerWalk(w, row.key))
    } finally {
      setBusy(false)
    }
  }
  const takePart = (part: { id: string; name: string }, words: string) =>
    take(async (r) => {
      const pair = await onUsePart(r, part)
      return pair ? { kind: 'tie', pair } : null
    }, words)
  const asPrice = (id: string | null): PricingAnswer | null => (id ? { kind: 'price', id } : null)
  const takeOffer = (offer: PriceOffer) => {
    const w = offerWords(offer, today)
    if (offer.kind === 'book') return takePart({ id: offer.partId, name: offer.name }, `${offer.name} · ${w.price}`)
    return take(async (r) => asPrice(await onUseBill(r, offer)), `${w.price} from ${offer.houseName ? `${offer.houseName}’s bill` : 'a bill'}`)
  }
  const takeTyped = () => {
    if (typed == null) return
    const price = typed
    void take(async (r) => asPrice(await onTypePrice(r, price)), `$${price.toFixed(2)} for one, typed`)
  }
  const leaveOut = () => void take(async (r) => asPrice(await onLeaveOut(r)), 'left out, not a part')
  const skip = () => {
    if (row && !busy) setWalk((w) => skipWalk(w, row.key))
  }
  const undoLast = async () => {
    if (!last || busy) return
    setBusy(true)
    try {
      if (await onUndo(last.answer)) {
        setWalk((w) => undoWalk(w, last.key))
        setLast(null)
      }
    } finally {
      setBusy(false)
    }
  }

  // A number key takes that answer, S skips and N says not a part, unless a box is being typed in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || picking || !row) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        skip()
        return
      }
      if ((e.key === 'n' || e.key === 'N') && canOwnPrice) {
        e.preventDefault()
        leaveOut()
        return
      }
      const n = Number(e.key)
      const offer = Number.isInteger(n) && n >= 1 ? answers[n - 1] : undefined
      if (offer) {
        e.preventDefault()
        void takeOffer(offer)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // The handler reads the row and its offers as drawn; it is set again whenever they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, answers.map((o) => o.key).join('|'), picking, busy, today, canOwnPrice])

  const words = row ? walkWords(walk, row.key, rows.length, pieces) : null
  const done = walk.order.length > 0 ? Math.min(1, walk.answered.length / walk.order.length) : 0

  return (
    <ResponsiveModalShell
      title={`${old ? 'Check the old prices' : 'Price what has no price'} · ${siteName}`}
      onRequestClose={onClose}
      maxWidthDesktop={640}
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ ...muted, minWidth: 0, flex: '1 1 220px' }} data-testid="pricing-last-answer">
            {last ? (
              <>
                Just now: {last.name} · {last.words}{' '}
                <button type="button" disabled={busy} style={{ ...btn, minHeight: 30, fontSize: '0.78rem', padding: '0 0.6rem', marginLeft: 6 }} onClick={() => void undoLast()} aria-label={`Undo the price of ${last.name}`}>Undo</button>
              </>
            ) : 'An answer can be undone here, and later from the row.'}
          </span>
          <button type="button" style={btn} onClick={onClose}>Done for now</button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: '0.7rem', paddingBottom: '0.5rem' }} data-testid="site-pricing-window">
        {row && words ? (
          <>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <strong>{words.where}</strong>
                <span style={muted}>{words.rest}</span>
              </div>
              <div role="progressbar" aria-label="Rows priced" aria-valuemin={0} aria-valuemax={walk.order.length} aria-valuenow={walk.answered.length} style={{ height: 8, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: 8, width: `${done * 100}%`, background: '#15803d' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'baseline' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-strong)', overflowWrap: 'anywhere' }} data-testid="pricing-row-name">{row.name}</span>
              <span style={{ ...muted, display: 'inline-flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                <strong style={{ color: 'var(--text-strong)' }}>{row.total.toLocaleString('en-US')}</strong> {row.total === 1 ? 'piece' : 'pieces'}
                {row.boxes.slice(0, 4).map((b) => <span key={`${b.containerId}:${b.spelling}`} style={chipBox}>{b.label} · {b.onHand.toLocaleString('en-US')}</span>)}
                {row.boxes.length > 4 ? <span>+{row.boxes.length - 4}</span> : null}
                {row.partId && !old ? <span>· a parts-book part with no price in the book</span> : null}
              </span>
            </div>

            {now ? (
              <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' }} data-testid="pricing-now">
                Now: ${now.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for one · {priceWords(now, today)}
              </span>
            ) : null}

            {offers.loading ? <span style={muted}>Reading the parts book and the bills…</span> : null}
            {offers.bookError ? <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>The parts book’s offers are not here. {offers.bookError}</span> : null}
            {offers.billsError ? <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>The bills’ offers are not here. {offers.billsError}</span> : null}

            {answers.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.4rem' }} role="group" aria-label="Offers that fit">
                {answers.map((o, i) => {
                  const w = offerWords(o, today)
                  return (
                    <button key={o.key} type="button" disabled={busy} onClick={() => void takeOffer(o)} style={{ ...offerBox, cursor: 'pointer', ...(i === 0 ? { borderColor: 'var(--text-link)', background: 'var(--bg-blue-tint)' } : {}) }} aria-label={`Use ${o.kind === 'book' ? o.name : `the bill’s price for ${o.description}`} at ${w.price} for ${row.name}`} data-offer={o.key}>
                      <span style={kbd} aria-hidden="true">{i + 1}</span>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <strong style={{ display: 'block', color: 'var(--text-strong)' }}>{w.name}{o.kind === 'book' && o.manufacturer ? <span style={{ ...muted, fontWeight: 500 }}> · {o.manufacturer}</span> : null}</strong>
                        {w.from}
                      </span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{w.price}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {billsToRead.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.4rem' }} role="group" aria-label="What a bill paid">
                <span style={{ ...muted, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>What a bill paid · to read, not to press</span>
                {billsToRead.map((o) => {
                  const w = offerWords(o, today)
                  return (
                    <div key={o.key} style={{ ...offerBox, gridTemplateColumns: '1fr auto' }} data-offer={o.key}>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <strong style={{ display: 'block', color: 'var(--text-strong)' }}>{w.name}</strong>
                        {w.from}
                      </span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{w.price}</span>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {!offers.loading && found.length === 0 ? (old ? <EmptyState compact main="Nothing newer on a bill." tail="Type today’s price for one, or press Skip." /> : <EmptyState compact main="Nothing found in the parts book or on a bill." tail={canOwnPrice ? 'Type a price for one, press Other part… to search with other words, or press Not a part.' : 'Press Other part… to search with other words, or Skip.'} />) : null}

            {canOwnPrice && !picking ? (
              <form style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }} onSubmit={(e) => { e.preventDefault(); takeTyped() }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '1 1 180px', minWidth: 0, minHeight: 44, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 8, background: 'var(--surface)', padding: '0 0.6rem', color: 'var(--text-muted)' }}>
                  $
                  <input type="text" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="a price for one, as counted" aria-label="A price for one, as counted" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-strong)', font: 'inherit', fontVariantNumeric: 'tabular-nums' }} />
                </label>
                {typed != null ? <button type="submit" disabled={busy} style={btnPrimary}>Save ${typed.toFixed(2)} for one</button> : null}
                {draft.trim() && typed == null ? <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>Type a price as a number, such as 3.12.</span> : null}
              </form>
            ) : null}

            {picking ? (
              <BookPartPicker name={row.name} busy={busy} search={searchBook} onPick={(part) => { setPicking(false); void takePart({ id: part.id, name: part.name }, part.name) }} onCancel={() => setPicking(false)} />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {found.length > shown.length ? <button type="button" style={btn} onClick={() => setShowAll(true)}>{found.length - shown.length} more {found.length - shown.length === 1 ? 'fit' : 'fits'}…</button> : null}
                {!row.partId && !old ? <button type="button" style={btn} disabled={busy} onClick={() => setPicking(true)} title="Search the parts book with other words.">Other part…</button> : null}
                {old && now?.from === 'book' ? <Link to="/materials?tab=parts-book" style={{ ...btn, textDecoration: 'none' }} title="The book’s own price is checked there, for every site at once.">Open the Parts Book</Link> : null}
                {canOwnPrice ? <button type="button" style={btn} disabled={busy} onClick={leaveOut} title="Scrap, tools or a mixed box. The row leaves the count of lines that need a price.">Not a part <span style={kbd} aria-hidden="true">N</span></button> : null}
                <button type="button" style={btn} disabled={busy} onClick={skip}>Skip <span style={kbd} aria-hidden="true">S</span></button>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem', justifyItems: 'center', textAlign: 'center', padding: '1rem 0.5rem' }} data-testid="pricing-walk-end">
            {rows.length === 0 ? (
              <EmptyState compact {...emptyWordsWithPress({ main: old ? 'Nothing waiting on a newer price on this site.' : 'Nothing waiting on a price on this site.', next: 'Done', tail: 'closes the window.' }, { onPress: onClose })} />
            ) : (
              <>
                <strong style={{ fontSize: '1rem', color: 'var(--text-strong)' }}>That is every row in this pass.</strong>
                <span style={muted}>{walkEndWords(walk, rows.length, mode)}</span>
                <button type="button" style={btnPrimary} onClick={() => setWalk(startWalk(rows.map((r) => r.key)))}>Go through the {rows.length.toLocaleString('en-US')} left</button>
              </>
            )}
          </div>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
