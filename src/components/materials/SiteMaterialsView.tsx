/**
 * A site's materials on one screen (punch list #330): everything in the cages and boxes of a
 * development's jobs, read only. On top, how fresh the record is and the figures a manager asks
 * for; under them one row per part across the site's jobs with its total and the boxes that hold
 * it (`sitePartRows`), or the boxes by place. A state of the Materials desk (`?site=<development
 * id>`), so the rows are the on-site store's, already read by the desk. Nothing here writes: a
 * box opens on its job's page or the phone screen, where the presses are. The one thing a person
 * says here is **Same part?** (PR 3): two names that are nearly the same are asked about once, and
 * the answer (`on_site_part_ties`) only changes which lines a row adds up, never a count.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { useToastContext } from '../../contexts/ToastContext'
import { usePartTies } from '../../hooks/usePartTies'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { TIES_NOT_LOADED_WORDS } from '../../lib/materials/onSiteReadFailed'
import { usePriceOffers } from '../../hooks/usePriceOffers'
import { BookPartPicker } from './BookPartPicker'
import { SitePricingWindow, type PricingAnswer, type TiePair } from './SitePricingWindow'
import { countedLabel } from '../../lib/batchWords'
import { offerRowsWords, siteOffers, type BillOffer } from '../../lib/materials/priceOffers'
import { isLeftOut, rowSitePrices, sitePriceWords, type SitePrice } from '../../lib/materials/sitePrices'
import type { SitePriceInput } from '../../lib/materials/sitePricesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { askReasonWords, joinedTies, orderedPair, samePartAsks, tieCanon, tieFor, tieNamesWords, type PartTie, type SamePartAsk, type TieVerdict } from '../../lib/materials/partTies'
import { containerLines, lastCountWords, type Movement } from '../../lib/materials/onSite'
import { serverLines } from '../../lib/materials/onSiteServerSummary'
import { addSitePrice, listContainers, listMovements, listPlaces, listSitePrices, loadBookPrices, priceForScope, removeSitePrice, serverSummary, setScopeTies, sitePricingAvailable } from '../../lib/materials/onSiteStore'
import { priceTitle, priceWords } from '../../lib/materials/bookPrice'
import { searchBookParts, type BookPartHit } from '../../lib/materials/bookSearchIo'
import { rowWorth, siteWorth, worthWords, type RowWorth } from '../../lib/materials/siteWorth'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { jobMaterialsSummaryFor } from '../../lib/materials/onSiteSummary'
import { readSiteView, writeSiteView, type SiteView } from '../../lib/materials/siteMaterialsViewPrefs'
import { filterPartRows, lastRecordedWords, QUIET_DAYS, sameWordsKey, searchPartRows, shownTotalWords, siteGlance, sitePartRows, sitePlaceSections, siteWeekFlow, spellingsWords, type SiteFilter, type SitePartRow, type SiteRollupJob } from '../../lib/materials/siteRollup'

type Props = {
  site: { id: string; name: string }
  /** The site's jobs that hold boxes, with how each reads in a row. */
  jobs: ReadonlyArray<{ id: string; label: string }>
  /** The week's missing money is drawn for the roles that read it on the desk. */
  showMoney: boolean
  onBack: () => void
  /** What the back press returns to: "Materials desk", "On site". */
  backLabel: string
  /** Where a box opens: the job's page for the office, the phone screen for a crew. */
  boxHref: (jobId: string, containerId: string) => string
  /** The site's Development page, for the roles that may open it: where the material location report prints. */
  developmentHref?: string | null
  /** The desk is still reading the boxes. */
  loading?: boolean
  /** The viewer may say two names are one part: the roles that read the desk with its money. */
  canTie?: boolean
  /** Who an answer is recorded under. */
  byName?: string
  /** The parts book's search behind **This is a parts-book part**; a test hands in its own. */
  searchBook?: (term: string) => Promise<BookPartHit[]>
}

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const sec: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, overflow: 'hidden', minWidth: 0 }
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }
const chipBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap' }
const chipDim: CSSProperties = { ...chipBase, color: 'var(--text-muted)', borderColor: 'var(--border)' }
const chipAmber: CSSProperties = { ...chipBase, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' }
const chipBox: CSSProperties = { ...chipBase, color: 'var(--text-strong)', borderColor: 'var(--border-strong)', background: 'var(--bg-subtle)', fontVariantNumeric: 'tabular-nums' }
const tileBase: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.5rem 0.65rem', minWidth: 0, display: 'grid', gap: 1, alignContent: 'start', textAlign: 'left', font: 'inherit', color: 'var(--text-strong)' }
const tileKey: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const tileBig: CSSProperties = { fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }
const tileSmall: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const pill = (on: boolean): CSSProperties => ({ ...btn, minHeight: 32, fontSize: '0.8rem', borderRadius: 999, ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) })

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

function Tile({ label, big, small, tone, on, onPress }: { label: string; big: ReactNode; small?: ReactNode; tone?: 'amber' | 'green'; on?: boolean; onPress?: () => void }) {
  const toned: CSSProperties = tone === 'amber' ? { background: 'var(--bg-amber-100)', borderColor: 'var(--text-amber-800)' } : tone === 'green' ? { background: 'var(--bg-green-100)', borderColor: 'var(--text-green-700)' } : {}
  const ink = tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-700)' : undefined
  const body = (
    <>
      <span style={{ ...tileKey, ...(ink ? { color: ink } : {}) }}>{label}</span>
      <span style={{ ...tileBig, ...(ink ? { color: ink } : {}) }}>{big}</span>
      {small ? <span style={tileSmall}>{small}</span> : null}
    </>
  )
  if (!onPress) return <div style={{ ...tileBase, ...toned }}>{body}</div>
  return (
    <button type="button" aria-pressed={Boolean(on)} onClick={onPress} style={{ ...tileBase, ...toned, cursor: 'pointer', ...(on ? { outline: '2px solid var(--text-link)', outlineOffset: 1 } : {}) }}>
      {body}
    </button>
  )
}

export default function SiteMaterialsView({ site, jobs, showMoney, onBack, backLabel, boxHref, developmentHref, loading, canTie = false, byName = '', searchBook = searchBookParts }: Props) {
  const now = new Date()
  const [view, setView] = useState<SiteView>(() => readSiteView())
  const [filter, setFilter] = useState<SiteFilter>('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  /** The list narrowed to the rows with a Same part? to answer. */
  const [asksOnly, setAsksOnly] = useState(false)
  /** The list narrowed to the rows with a line that has no price, most pieces first. */
  const [unpricedOnly, setUnpricedOnly] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  /** The window that prices the rows with no price, one at a time (punch list #342). */
  const [pricing, setPricing] = useState(false)
  const { showToast } = useToastContext()
  const ties = usePartTies({ developmentId: site.id })

  // The store's own rows, job by job. A job past the ledger cap reads its lines from the database's summary.
  const rollup: SiteRollupJob[] = jobs.map((j) => {
    const summary = serverSummary(j.id)
    return { jobId: j.id, label: j.label, containers: listContainers(j.id), places: listPlaces(j.id), lines: summary ? serverLines(summary) : containerLines(listMovements(j.id)) }
  })
  const movements: Movement[] = jobs.flatMap((j) => listMovements(j.id))
  const glance = siteGlance(rollup, now)
  const flow = siteWeekFlow(movements, now)
  const week = jobs.reduce((sum, j) => {
    const s = jobMaterialsSummaryFor(j.id, now)
    return { lines: sum.lines + s.missingLines, money: sum.money + s.missingMoneyWeek }
  }, { lines: 0, money: 0 })

  // A typed name tied to the parts book (PR 4) is a row of that book part: it takes the book's name and price.
  const bookNames = new Map<string, string>()
  for (const t of ties.ties) {
    if (t.verdict !== 'same') continue
    if (t.aKey.startsWith('id:')) bookNames.set(t.aKey, t.aName)
    if (t.bKey.startsWith('id:')) bookNames.set(t.bKey, t.bName)
  }
  const tiedPartIds = [...bookNames.keys()].map((k) => k.slice('id:'.length)).sort().join('|')
  useEffect(() => {
    if (showMoney && tiedPartIds) void loadBookPrices(tiedPartIds.split('|'))
  }, [showMoney, tiedPartIds])
  const canon = tieCanon(ties.ties)
  const rows = sitePartRows(rollup, now, canon, bookNames)
  // A price on this site (punch list #342): the one rule with the site's own answers and its ties in it.
  const scope = useMemo(() => ({ developmentId: site.id }), [site.id])
  const scopeKey = `d:${site.id}`
  const priceFor = (key: string) => priceForScope(scopeKey, key, canon)
  const sitePrices: SitePrice[] = showMoney ? listSitePrices(scope) : []
  // A write to the store redraws the screen here, whoever else is listening.
  const [, setTick] = useState(0)
  // The store prices a job's page through the same ties.
  useEffect(() => {
    if (ties.available) setScopeTies(scope, ties.ties)
  }, [scope, ties.available, ties.ties])
  const worth = showMoney ? siteWorth(rows, priceFor, (r) => isLeftOut(r, sitePrices)) : null
  const today = todayYmdInAppTz()
  // Same part? is asked of the roles that may answer, and only once the answers so far were read.
  const asks = canTie && ties.available ? samePartAsks(rows, ties.ties, sameWordsKey) : []
  const askOf = new Map(asks.map((a) => [a.row.key, a] as const))
  const unpricedKeys = new Set((worth?.unpriced ?? []).map((r) => r.key))
  // Pricing is for the roles that may tie, once the ties were read. The offers' sources are read on the first ask.
  const canPrice = Boolean(worth) && canTie && ties.available
  // The site's own prices can be written once their table was read.
  const canOwnPrice = canPrice && sitePricingAvailable()
  const offers = usePriceOffers(canPrice && (unpricedOnly || pricing))
  const unpricedRows = worth?.unpriced ?? []
  const unpricedSig = unpricedRows.map((r) => r.key).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the rows are rebuilt each render; their keys say when they changed.
  const offerRows = useMemo(() => (offers.index ? siteOffers(unpricedRows, offers.index).size : 0), [offers.index, unpricedSig])
  const base = unpricedOnly && worth ? worth.unpriced.filter((r) => filterPartRows([r], filter).length > 0) : filterPartRows(rows, filter)
  const shownRows = searchPartRows(asksOnly ? base.filter((r) => askOf.has(r.key)) : base, query)
  const sections = view === 'place' ? sitePlaceSections(rollup, now) : []
  const narrowed = filter !== 'all' || query.trim() !== '' || asksOnly || unpricedOnly
  const last = lastRecordedWords(glance)
  const quiet = glance.quietDays != null && glance.quietDays >= QUIET_DAYS

  const pickView = (v: SiteView) => {
    setView(v)
    writeSiteView(v)
  }
  const toggleFilter = (f: SiteFilter) => {
    setFilter((cur) => (cur === f ? 'all' : f))
    if (view !== 'part') pickView('part')
  }
  const toggleRow = (key: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const clear = () => {
    setFilter('all')
    setQuery('')
    setAsksOnly(false)
    setUnpricedOnly(false)
  }
  /** Tie a row's name to a parts-book part. The pair written, or null when the table refused. */
  const tieBook = async (row: SitePartRow, part: { id: string; name: string }): Promise<TiePair | null> => {
    const own = row.memberKeys[0] ?? row.key
    const bookKey = `id:${part.id}`
    const [aKey, bKey] = orderedPair(bookKey, own)
    setBusy(row.key)
    try {
      await ties.answer({ aKey, bKey, aName: aKey === bookKey ? part.name : row.name, bName: bKey === bookKey ? part.name : row.name, verdict: 'same' }, byName)
      return { aKey, bKey }
    } catch (e) {
      showToast(formatErrorMessage(e, 'The name was not tied to the parts book.'), 'error')
      return null
    } finally {
      setBusy(null)
    }
  }
  /** Take back the tie the pricing window just made. */
  const undoPair = async (pair: TiePair): Promise<boolean> => {
    const tie = ties.ties.find((t) => t.verdict === 'same' && t.aKey === pair.aKey && t.bKey === pair.bKey)
    if (!tie) return true
    try {
      await ties.undo(tie.id)
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'The names were not separated.'), 'error')
      return false
    }
  }
  /** One answer about a row's price on this site. The answer's id, or null when the table refused. */
  const priceRow = async (row: SitePartRow, input: Omit<Extract<SitePriceInput, { kind: 'price' }>, 'rowKey' | 'rowName'> | { kind: 'left_out'; pricedOn: string }): Promise<string | null> => {
    try {
      const saved = await addSitePrice(scope, { rowKey: row.key, rowName: row.name, ...input }, byName)
      setTick((t) => t + 1)
      return saved.id
    } catch (e) {
      showToast(formatErrorMessage(e, input.kind === 'left_out' ? 'The row was not left out.' : 'The price was not saved.'), 'error')
      return null
    }
  }
  const billPrice = (row: SitePartRow, offer: BillOffer) => priceRow(row, { kind: 'price', unitPrice: Math.round(offer.priceEach * 10000) / 10000, source: 'bill', sourceLineId: offer.lineId, sourceWords: offer.houseName, pricedOn: offer.datedOn ?? today })
  const undoPrice = async (id: string): Promise<boolean> => {
    setBusy(id)
    try {
      await removeSitePrice(scope, id)
      setTick((t) => t + 1)
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'The answer was not taken back.'), 'error')
      return false
    } finally {
      setBusy(null)
    }
  }
  const undoAnswer = (a: PricingAnswer) => (a.kind === 'tie' ? undoPair(a.pair) : undoPrice(a.id))
  const answer = async (ask: SamePartAsk, verdict: TieVerdict) => {
    setBusy(ask.row.key)
    try {
      await ties.answer(tieFor(ask.row, ask.other, verdict), byName)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The answer was not saved.'), 'error')
    } finally {
      setBusy(null)
    }
  }
  const undo = async (tie: PartTie) => {
    setBusy(tie.id)
    try {
      await ties.undo(tie.id)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The names were not separated.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }} data-testid="site-materials-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" aria-label={`Back to ${backLabel}`} title={backLabel} style={{ ...btn, width: 36, height: 36, minHeight: 36, padding: 0, justifyContent: 'center', flex: '0 0 auto', lineHeight: 1 }} onClick={onBack}>
          ‹
        </button>
        <div style={{ display: 'grid', minWidth: 0, flex: '1 1 220px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.2 }}>{site.name}</h2>
          <span style={muted}>
            Everything in the cages and boxes on this site, across {count(jobs.length, 'job', 'jobs')}. Read only: a box opens where it can be counted.
            {loading ? ' Loading…' : ''}
          </span>
        </div>
        {developmentHref ? <Link to={`${developmentHref}?report=materials`} style={{ ...btn, fontWeight: 500 }} title="One Letter paper of every cage and box on the site, by job, by location or by part. It opens on the site’s Development page.">Print the material location report</Link> : null}
      </div>

      {/* The names joined here did not load (v2.7175): the rows still add up, each spelling apart, and the screen says so. */}
      <OfflineRetryPanel failure={ties.failed ? recoveryFailureFromError(ties.failed, TIES_NOT_LOADED_WORDS, TIES_NOT_LOADED_WORDS) : null} onRetry={ties.retry} surface="materials-site-ties" offlineMessage={TIES_NOT_LOADED_WORDS} idempotent />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: '0.5rem' }} role="group" aria-label="This site at a glance">
        <Tile label="Last recorded" big={last.big} small={last.small} tone={glance.lastRecorded ? (quiet ? 'amber' : 'green') : undefined} />
        <Tile label="Boxes" big={glance.boxes.toLocaleString('en-US')} small={`${count(glance.jobsWithBoxes, 'job', 'jobs')} · ${count(glance.places, 'place', 'places')}`} />
        <Tile label="On hand" big={count(glance.lines, 'line', 'lines')} small={count(glance.pieces, 'piece', 'pieces')} />
        <Tile label="Due a count" big={glance.dueNow.toLocaleString('en-US')} small={glance.dueSoon > 0 ? `${glance.dueSoon.toLocaleString('en-US')} more this week` : 'none more this week'} tone={glance.dueNow > 0 ? 'amber' : undefined} on={filter === 'due'} onPress={() => toggleFilter('due')} />
        <Tile label="Can't find" big={glance.cannotFindLines.toLocaleString('en-US')} small={glance.cannotFindLines === 1 ? 'line since its count' : 'lines since their count'} tone={glance.cannotFindLines > 0 ? 'amber' : undefined} on={filter === 'cannot'} onPress={() => toggleFilter('cannot')} />
        <Tile label="Short at a count" big={glance.shortLines.toLocaleString('en-US')} small={glance.shortLines === 1 ? 'line at its last count' : 'lines at their last count'} tone={glance.shortLines > 0 ? 'amber' : undefined} on={filter === 'short'} onPress={() => toggleFilter('short')} />
        <Tile label="Missing this week" big={showMoney ? money(week.money) : week.lines.toLocaleString('en-US')} small={showMoney ? count(week.lines, 'line', 'lines') : week.lines === 1 ? 'line' : 'lines'} />
        <Tile label="This week" big={`${flow.cameIn.toLocaleString('en-US')} in`} small={`${flow.used.toLocaleString('en-US')} used${flow.invoices > 0 ? ` · ${count(flow.invoices, 'invoice', 'invoices')}` : ''}`} />
        {worth ? (
          <Tile
            label="Worth"
            big={worthWords(worth).big}
            small={[worthWords(worth).small, offerRowsWords(offerRows)].filter(Boolean).join(' · ')}
            on={unpricedOnly}
            onPress={() => {
              setUnpricedOnly((v) => !v)
              if (view !== 'part') pickView('part')
            }}
          />
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span role="group" aria-label="How the list reads" style={{ display: 'inline-flex', gap: '0.35rem' }}>
          <button type="button" aria-pressed={view === 'part'} style={pill(view === 'part')} onClick={() => pickView('part')}>By part</button>
          <button type="button" aria-pressed={view === 'place'} style={pill(view === 'place')} onClick={() => pickView('place')}>By place</button>
        </span>
        {view === 'part' && asks.length > 0 ? (
          <button type="button" aria-pressed={asksOnly} style={{ ...pill(asksOnly), ...(asksOnly ? {} : { borderColor: 'var(--text-link)', color: 'var(--text-link)' }) }} onClick={() => setAsksOnly((v) => !v)} title="Names that are nearly the same. Say once whether each pair is one part.">
            Same part? · {asks.length}
          </button>
        ) : null}
        {view === 'part' ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a part or a box on this site"
            aria-label="Find a part or a box on this site"
            style={{ flex: '1 1 220px', minWidth: 0, minHeight: 36, borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-strong)', font: 'inherit', padding: '0 0.9rem' }}
          />
        ) : null}
      </div>

      {view === 'part' ? (
        <div style={sec}>
          {narrowed && shownRows.length > 0 ? (
            <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }} data-testid="site-shown-total">
              <span><strong>{shownTotalWords(shownRows)}</strong>{unpricedOnly ? <span style={muted}> · the rows with a line that has no price, most pieces first</span> : null}</span>
              {unpricedOnly && canPrice && unpricedRows.length > 0 ? (
                <button type="button" style={{ ...btn, minHeight: 30, fontSize: '0.78rem', background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} onClick={() => setPricing(true)} title="A window asks about one row at a time: the parts-book part that fits, and what a bill paid.">
                  {countedLabel('Price', unpricedRows.length, 'row')} one at a time
                </button>
              ) : null}
              <button type="button" style={{ ...btn, minHeight: 26, fontSize: '0.72rem', padding: '0 0.5rem', fontWeight: 500 }} onClick={clear}>Show every row</button>
            </div>
          ) : null}
          {shownRows.length === 0 ? (
            rows.length === 0
              ? <EmptyState compact main={loading ? 'Reading the boxes…' : 'No part is on hand on this site yet.'} tail={loading ? undefined : 'A crew counts parts into a box on the phone’s On site tab.'} />
              : <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'parts on this site', query: query.trim() }), { onPress: clear })} />
          ) : shownRows.map((r) => <PartRow key={r.key} row={r} open={open.has(r.key)} onToggle={() => toggleRow(r.key)} boxHref={boxHref} now={now} ask={askOf.get(r.key)} joined={joinedTies(r, ties.ties)} canTie={canTie && ties.available} busy={busy} onAnswer={answer} onUndo={undo} worth={worth ? rowWorth(r, priceFor) : null} unpriced={unpricedKeys.has(r.key)} today={today} priced={showMoney ? rowSitePrices(r, sitePrices) : []} onUndoPrice={(id) => void undoPrice(id)} onTieBook={(row, part) => void tieBook(row, part)} searchBook={searchBook} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {sections.length === 0 ? <div style={sec}><EmptyState compact main={loading ? 'Reading the boxes…' : 'No cage or box is on this site yet.'} tail={loading ? undefined : 'A job’s Materials page is where the first is added.'} /></div> : null}
          {sections.map((s) => (
            <div key={s.key} style={sec}>
              <h3 style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                {s.name}
                <span style={{ ...muted, fontWeight: 400 }}>{count(s.boxes.length, 'box', 'boxes')} · {count(s.pieces, 'piece', 'pieces')}{s.jobLabels.length > 1 ? ` · ${s.jobLabels.length} jobs` : ''}</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.5rem', padding: '0.6rem' }}>
                {s.boxes.map((b) => (
                  <div key={b.containerId} style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 8, padding: '0.4rem 0.55rem', display: 'grid', gap: '0.2rem', minWidth: 0, alignContent: 'start' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link to={boxHref(b.jobId, b.containerId)} style={{ fontWeight: 800, color: 'var(--text-link)', textDecoration: 'none' }} title={`Open ${b.label} on ${b.jobLabel}`}>{b.label}</Link>
                      {b.kind !== 'unsorted' ? <span style={b.due ? chipAmber : chipDim}>{b.due ? 'due a count' : lastCountWords(b.countedAt ? { at: b.countedAt, byName: '' } : null, now).replace(/ by $/, '')}</span> : null}
                    </div>
                    {s.jobLabels.length > 1 ? <span style={{ ...muted, fontSize: '0.72rem' }}>{b.jobLabel}</span> : null}
                    {b.lines.length === 0 ? <span style={muted}>Empty</span> : b.lines.map((l) => (
                      <div key={l.partKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', fontSize: '0.82rem' }}>
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.name}{l.cannotFind > 0 ? <span style={{ ...chipAmber, marginLeft: 6 }}>{l.cannotFind} can't find</span> : null}</span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{l.onHand.toLocaleString('en-US')}</strong>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {pricing && canPrice ? <SitePricingWindow siteName={site.name} rows={unpricedRows} offers={offers} today={today} searchBook={searchBook} onUsePart={tieBook} canOwnPrice={canOwnPrice} onUseBill={billPrice} onTypePrice={(row, price) => priceRow(row, { kind: 'price', unitPrice: price, source: 'typed', pricedOn: today })} onLeaveOut={(row) => priceRow(row, { kind: 'left_out', pricedOn: today })} onUndo={undoAnswer} onClose={() => setPricing(false)} /> : null}
    </div>
  )
}

function PartRow({ row, open, onToggle, boxHref, now, ask, joined, canTie, busy, onAnswer, onUndo, worth, unpriced, today, onTieBook, searchBook, priced, onUndoPrice }: { /** The answers given about this row's price on this site, newest first (punch list #342). */ priced: SitePrice[]; onUndoPrice: (id: string) => void; row: SitePartRow; open: boolean; onToggle: () => void; boxHref: Props['boxHref']; now: Date; ask?: SamePartAsk; joined: PartTie[]; canTie: boolean; busy: string | null; onAnswer: (ask: SamePartAsk, verdict: TieVerdict) => void; onUndo: (tie: PartTie) => void; /** The row's money, for the roles that read it; null otherwise. */ worth: RowWorth | null; unpriced: boolean; today: string; onTieBook: (row: SitePartRow, part: BookPartHit) => void; searchBook: (term: string) => Promise<BookPartHit[]> }) {
  const [picking, setPicking] = useState(false)
  const spellings = spellingsWords(row)
  const warn = row.cannotFind > 0 || row.short > 0
  const firstBoxes = row.boxes.slice(0, 4)
  const leftOut = priced[0]?.kind === 'left_out'
  return (
    <div style={{ borderBottom: '1px solid var(--border)', ...(warn ? { background: 'var(--bg-amber-100)' } : {}) }} data-site-part-row={row.key}>
      <button type="button" aria-expanded={open} onClick={onToggle} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 12px', width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)', minWidth: 0, overflowWrap: 'anywhere' }}>
          {row.name}
          {row.manufacturer ? <span style={{ ...muted, fontWeight: 500 }}> · {row.manufacturer}</span> : null}
          {spellings ? <span style={{ ...muted, fontWeight: 500, marginLeft: 6 }}>{spellings}</span> : null}
        </span>
        <span style={{ fontWeight: 800, fontSize: '1rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>{row.total.toLocaleString('en-US')}</span>
        <span style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {firstBoxes.map((b) => <span key={`${b.containerId}:${b.spelling}`} style={chipBox}>{b.label} · {b.onHand.toLocaleString('en-US')}</span>)}
          {row.boxes.length > firstBoxes.length ? <span style={chipDim}>+{row.boxes.length - firstBoxes.length}</span> : null}
          {row.cannotFind > 0 ? <span style={chipAmber}>{row.cannotFind} can't find</span> : null}
          {row.short > 0 ? <span style={chipAmber}>{row.short} short at a count</span> : null}
          {row.due ? <span style={chipAmber}>due a count</span> : <span style={chipDim}>{lastCountWords(row.countedAt ? { at: row.countedAt, byName: '' } : null, now).replace(/ by $/, '')}</span>}
          {leftOut ? (
            <span style={chipDim} data-row-left-out>left out · not a part</span>
          ) : worth && worth.pricedLines > 0 ? (
            <span style={worth.staleLines > 0 ? chipAmber : chipDim} title={worth.pick ? priceTitle(worth.pick, today) : 'The price typed off the invoice that landed the part.'} data-row-worth>
              ${worth.money.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{worth.pick ? ` · ${priceWords(worth.pick, today)}` : ' · invoice price'}
            </span>
          ) : worth && unpriced ? <span style={chipDim}>no price</span> : null}
        </span>
      </button>
      {ask ? (
        <div data-same-part-ask={row.key} style={{ margin: '0 0.75rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center', background: 'var(--bg-blue-tint)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-link)', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.82rem', color: 'var(--text-strong)' }}>
          <span style={{ minWidth: 0, flex: '1 1 240px' }}>
            <strong>Same part?</strong> {row.name} and {ask.other.name} <span style={muted}>({ask.other.total.toLocaleString('en-US')} in {ask.other.boxes.length === 1 ? ask.other.boxes[0]!.label : `${ask.other.boxes.length} boxes`}). {askReasonWords(ask)}</span>
          </span>
          <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
            <button type="button" disabled={busy === row.key} style={{ ...btn, minHeight: 30, fontSize: '0.78rem', background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} onClick={() => onAnswer(ask, 'same')}>Same part</button>
            <button type="button" disabled={busy === row.key} style={{ ...btn, minHeight: 30, fontSize: '0.78rem' }} onClick={() => onAnswer(ask, 'different')}>Different</button>
          </span>
        </div>
      ) : null}
      {open ? (
        <div style={{ margin: '0 0.75rem 0.6rem', background: 'var(--bg-subtle)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem', display: 'grid', gap: '0.3rem', fontSize: '0.82rem' }}>
          {row.boxes.map((b) => (
            <div key={`${b.containerId}:${b.spelling}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ minWidth: 0 }}>
                <Link to={boxHref(b.jobId, b.containerId)} style={{ fontWeight: 800, color: 'var(--text-link)', textDecoration: 'none' }} title={`Open ${b.label} on ${b.jobLabel}`}>{b.label}</Link>
                <span style={muted}>{b.placeName ? ` · ${b.placeName}` : ''} · {b.jobLabel}{row.spellings.length > 1 ? ` · typed “${b.spelling}”` : ''}</span>
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{b.onHand.toLocaleString('en-US')}</strong>
                <span style={muted}> · {b.lineCountedAt ? lastCountWords({ at: b.lineCountedAt, byName: '' }, now).replace(/ by $/, '') : 'never counted'}</span>
              </span>
            </div>
          ))}
          {row.spellings.length > 1 && joined.length === 0 ? <span style={muted}>These names are one row because their words are the same. Each keeps its own count in its box.</span> : null}
          {canTie && !row.partId ? (
            picking ? (
              <BookPartPicker name={row.name} busy={busy === row.key} search={searchBook} onPick={(part) => { setPicking(false); onTieBook(row, part) }} onCancel={() => setPicking(false)} />
            ) : (
              <div>
                <button type="button" style={{ ...btn, minHeight: 28, fontSize: '0.75rem', padding: '0 0.55rem', fontWeight: 500 }} onClick={() => setPicking(true)} title="Tie this name to a part in the parts book. The row then reads the book’s name and price. It can be undone.">This is a parts-book part</button>
              </div>
            )
          ) : null}
          {priced.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.3rem' }} data-testid="priced-here">
              <span style={{ ...muted, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Priced here</span>
              {priced.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ minWidth: 0, ...(i > 0 ? { color: 'var(--text-muted)' } : {}) }}>{sitePriceWords(p, today)}</span>
                  {canTie ? <button type="button" disabled={busy === p.id} style={{ ...btn, minHeight: 26, fontSize: '0.72rem', padding: '0 0.5rem', fontWeight: 500 }} onClick={() => onUndoPrice(p.id)} aria-label={p.kind === 'left_out' ? `Bring ${row.name} back` : `Undo the price of ${row.name}`}>{p.kind === 'left_out' ? 'Bring back' : 'Undo'}</button> : null}
                </div>
              ))}
              <span style={muted}>{priced.length > 1 ? 'The first line is the one read. ' : ''}Taking an answer back never changes a count or a box.</span>
            </div>
          ) : null}
          {joined.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.3rem' }} data-testid="names-joined-here">
              <span style={{ ...muted, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Names joined here</span>
              {joined.map((t) => (
                <div key={t.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ minWidth: 0 }}>{tieNamesWords(t)} <span style={muted}>· {t.byName ? `by ${t.byName}, ` : ''}{new Date(t.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span>
                  {canTie ? <button type="button" disabled={busy === t.id} style={{ ...btn, minHeight: 26, fontSize: '0.72rem', padding: '0 0.5rem', fontWeight: 500 }} onClick={() => onUndo(t)} aria-label={`Undo joining ${tieNamesWords(t)}`}>Undo</button> : null}
                </div>
              ))}
              <span style={muted}>Each name keeps its own count in its box. Undo only separates the rows.</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
