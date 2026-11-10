import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useIsMobile } from '../../hooks/useIsMobile'
import { usePermitRecordsStart } from '../../hooks/usePermitRecordsStart'
import { BID_PERMIT_CITIES } from '../../lib/research/permitResearch'
import { reachDay } from '../../lib/research/permitReach'
import { gcJobsView, numbersToAsk, type GcBid, type SitePermitRow } from '../../lib/research/bidSitePanel'
import { loadBidsOfCustomers, loadPermitsByHouseNumber } from '../../lib/research/bidSiteIo'
import { PermitChip } from './PermitChip'
import { EmptyState } from '../EmptyState'
import { BidGcTiedNames } from './BidGcTiedNames'

/**
 * What we can see about a GC (punch list #307, PR 3): under the GC's card in a bid's window, the
 * jobs we priced for them, each with what the city shows on its address. It stands on the bids'
 * own addresses, so no name has to match. It says which city it reads, the day the records
 * start, and how many of our bids with them it covers. Never "the permits they pulled": the
 * records are one city's from one day on.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }

/** One city whose permits are read, with the day its records start: "San Antonio · since Aug 26". */
function CityScopeChip({ city, today }: { city: string; today: string }) {
  const start = usePermitRecordsStart(city)
  return <PermitChip chip={{ words: start ? `${city} · since ${reachDay(start, today)}` : city, tone: 'blue' }} />
}

/** How many jobs show before the rest fold behind a press on a desk. */
const DESK_LINES = 6

type Loaded = { state: 'loading' } | { state: 'done'; bids: GcBid[]; permits: Map<string, SitePermitRow[]> } | { state: 'waiting'; bids: GcBid[] } | { state: 'failed'; message: string }

export function BidGcPermits({ customerIds, customerName, currentBidId }: { customerIds: readonly string[]; customerName: string; currentBidId: string | null }) {
  const isMobile = useIsMobile()
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [open, setOpen] = useState(false)
  const idsKey = [...customerIds].sort().join(',')
  const today = todayYmdInAppTz()

  useEffect(() => {
    let live = true
    setLoaded({ state: 'loading' })
    setOpen(false)
    ;(async () => {
      const bids = await loadBidsOfCustomers(idsKey === '' ? [] : idsKey.split(','))
      const asks = numbersToAsk(bids, BID_PERMIT_CITIES)
      const permits = new Map<string, SitePermitRow[]>()
      for (const [city, numbers] of asks) {
        const rows = await loadPermitsByHouseNumber(city, numbers)
        if (rows == null) {
          if (live) setLoaded({ state: 'waiting', bids })
          return
        }
        permits.set(city, rows)
      }
      if (live) setLoaded({ state: 'done', bids, permits })
    })().catch((e) => {
      if (live) setLoaded({ state: 'failed', message: formatErrorMessage(e) })
    })
    return () => {
      live = false
    }
  }, [idsKey])

  const view = useMemo(() => (loaded.state === 'done' ? gcJobsView(loaded.bids, loaded.permits, BID_PERMIT_CITIES, currentBidId) : null), [loaded, currentBidId])

  const box: CSSProperties = { marginBottom: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 8, minWidth: 0 }
  const title = <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>What we can see about {customerName}</div>

  if (loaded.state === 'failed') {
    return (
      <div style={box} data-testid="bid-gc-permits">
        {title}
        <div style={{ ...muted, color: 'var(--text-red-700)' }}>{loaded.message}</div>
      </div>
    )
  }
  if (loaded.state === 'loading' || loaded.state === 'waiting' || !view) {
    return (
      <div style={box} data-testid="bid-gc-permits">
        {title}
        <div style={muted}>{loaded.state === 'waiting' ? 'The jobs you priced for them show here once the database change is in.' : 'Reading the jobs you priced for them…'}</div>
      </div>
    )
  }

  const folded = !open && (isMobile ? view.lines.length > 0 : view.lines.length > DESK_LINES)
  const shown = open ? view.lines : isMobile ? [] : view.lines.slice(0, DESK_LINES)
  const hidden = view.lines.length - shown.length

  return (
    <div style={box} data-testid="bid-gc-permits">
      {title}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {BID_PERMIT_CITIES.map((c) => (
          <CityScopeChip key={c} city={c} today={today} />
        ))}
        <PermitChip chip={{ words: view.coverage, tone: 'grey' }} />
      </div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>The jobs you priced for them</div>
      {view.verdict ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.45 }}>
          <span aria-hidden style={{ flex: '0 0 10px', width: 10, height: 10, borderRadius: '50%', marginTop: 5, background: view.sitesWithPermit > 0 ? '#059669' : 'var(--text-muted)' }} />
          <span>{view.verdict}</span>
        </div>
      ) : (
        <EmptyState main="None of your bids with them is on a street address in a city whose permits are read." compact />
      )}
      {shown.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {shown.map((l) => (
            <div key={l.bidId} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'grid', gap: 3 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.875rem' }}>{l.title}</strong>
                <PermitChip chip={l.chip} />
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{l.detail}</div>
            </div>
          ))}
        </div>
      )}
      {folded && (
        <button type="button" onClick={() => setOpen(true)} style={linkPress}>
          {isMobile ? `See the ${view.lines.length} job${view.lines.length === 1 ? '' : 's'}` : `See ${hidden} more`} ›
        </button>
      )}
      {view.elsewhere && <div style={muted}>{view.elsewhere}</div>}
      {view.unreadable && <div style={muted}>{view.unreadable}</div>}
      <BidGcTiedNames customerIds={customerIds} customerName={customerName} />
    </div>
  )
}
