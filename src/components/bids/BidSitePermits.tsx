import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { usePermitRecordsStart } from '../../hooks/usePermitRecordsStart'
import { ROBOT_BID_RE } from '../../lib/bids/bidPursuit'
import { BID_PERMIT_CITIES } from '../../lib/research/permitResearch'
import { bidSiteWords, leadPermit, permitsOnSite, readBidAddress, siteSourceLine } from '../../lib/research/bidSite'
import { siteCountWords, sitePermitLines, siteTiles, type SitePermitRow } from '../../lib/research/bidSitePanel'
import { loadPermitsByHouseNumber } from '../../lib/research/bidSiteIo'
import { PermitChip } from './PermitChip'
import { BidNameQuestion } from './BidNameQuestion'

/**
 * This site (punch list #307, PR 2): what the city holds on a bid's address, under the address
 * in the bid's window. One verdict line, the city's declared value and area beside the bid's
 * own, every permit we can see on the address, and where the records come from. It says when
 * it has no records (a town we do not read, an address that is not a street number) instead of
 * reading as no permits. Shown to the people who read Prospects → Permits; a robot's copy of a
 * bid shows nothing.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }
const DOT: Record<string, string> = { found: '#059669', none_seen: 'var(--text-muted)', not_read: '#d97706', unreadable: '#d97706' }

/** How many permits show before the rest fold behind a press. */
const FIRST_LINES = 5

type Loaded = { state: 'idle' } | { state: 'loading' } | { state: 'done'; rows: SitePermitRow[] } | { state: 'waiting' } | { state: 'failed'; message: string }

export function BidSitePermits({
  address,
  projectName,
  bidValue,
  customerIds,
  customerName,
}: {
  address: string
  projectName: string
  bidValue: string
  /** The bid's GC, as every customer row of its name: the question under the site's permit is about them. None, and nothing is asked. */
  customerIds?: readonly string[]
  customerName?: string | null
}) {
  // The address is typed a letter at a time: read it once it has rested.
  const [rested, setRested] = useState(address)
  useEffect(() => {
    const t = window.setTimeout(() => setRested(address), 700)
    return () => window.clearTimeout(t)
  }, [address])

  const site = useMemo(() => readBidAddress(rested, BID_PERMIT_CITIES), [rested])
  const city = site.kind === 'site' ? site.city : null
  const number = site.kind === 'site' ? site.number : null
  const [loaded, setLoaded] = useState<Loaded>({ state: 'idle' })
  const [openAll, setOpenAll] = useState(false)
  const recordsStart = usePermitRecordsStart(city ?? BID_PERMIT_CITIES[0] ?? '')
  const today = todayYmdInAppTz()

  useEffect(() => {
    if (!city || !number) {
      setLoaded({ state: 'idle' })
      return
    }
    let live = true
    setLoaded({ state: 'loading' })
    loadPermitsByHouseNumber(city, [number])
      .then((rows) => {
        if (live) setLoaded(rows == null ? { state: 'waiting' } : { state: 'done', rows })
      })
      .catch((e) => {
        if (live) setLoaded({ state: 'failed', message: formatErrorMessage(e) })
      })
    return () => {
      live = false
    }
  }, [city, number])

  const onSite = useMemo(() => (loaded.state === 'done' ? permitsOnSite(site, loaded.rows) : []), [loaded, site])
  if (ROBOT_BID_RE.test(projectName)) return null

  const box: CSSProperties = { marginTop: '0.9rem', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 8, minWidth: 0 }
  const head = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontWeight: 600, fontSize: '0.875rem' }}>
      This site
      {city && <PermitChip chip={{ words: city, tone: 'blue' }} />}
    </div>
  )

  if (site.kind === 'site' && loaded.state !== 'done') {
    return (
      <div style={box} data-testid="bid-site-permits">
        {head}
        {loaded.state === 'failed' ? (
          <div style={{ ...muted, color: 'var(--text-red-700)' }}>{loaded.message}</div>
        ) : loaded.state === 'waiting' ? (
          <div style={muted}>The city’s permits on this address show here once the database change is in.</div>
        ) : (
          <div style={muted}>Reading what the city has on this address…</div>
        )}
      </div>
    )
  }

  const words = bidSiteWords(site, projectName, onSite, { todayYmd: today, recordsStartYmd: recordsStart, readCities: BID_PERMIT_CITIES })
  const value = bidValue.trim() ? parseFloat(bidValue.replace(/[$,]/g, '')) : NaN
  const tiles = siteTiles(onSite, projectName, Number.isFinite(value) ? value : null)
  const lines = sitePermitLines(onSite, projectName)
  // The one permit the name question rides on: the building permit the verdict speaks of.
  const lead = leadPermit(projectName, onSite)
  const asked = lead && lead.kind === 'building' && customerIds && customerIds.length > 0 && customerName ? lead : null
  const shown = openAll ? lines : lines.slice(0, FIRST_LINES)

  return (
    <div style={box} data-testid="bid-site-permits">
      {head}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.45 }}>
        <span aria-hidden style={{ flex: '0 0 10px', width: 10, height: 10, borderRadius: '50%', marginTop: 5, background: DOT[words.state] }} />
        <span>{words.main}</span>
      </div>
      {words.detail && <div style={muted}>{words.detail}</div>}
      {tiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ background: 'var(--bg-200)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ ...muted, fontSize: '0.72rem' }}>{t.label}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{t.value}</div>
              {t.note && <div style={{ ...muted, fontSize: '0.72rem' }}>{t.note}</div>}
            </div>
          ))}
        </div>
      )}
      {site.kind === 'site' && lines.length > 0 && (
        <>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>{siteCountWords(lines.length, site.street)}</div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {shown.map((l) => (
              <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'grid', gap: 3 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.875rem' }}>{l.title}</strong>
                  {l.chips.map((c) => (
                    <PermitChip key={c.words} chip={c} />
                  ))}
                </div>
                {l.detail && <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{l.detail}</div>}
                {asked && asked.id === l.id && site.kind === 'site' && <BidNameQuestion permit={asked} city={site.city} customerIds={customerIds ?? []} customerName={customerName ?? ''} />}
              </div>
            ))}
          </div>
          {lines.length > shown.length && (
            <button type="button" onClick={() => setOpenAll(true)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}>
              See {lines.length - shown.length} more ›
            </button>
          )}
        </>
      )}
      {site.kind === 'site' && <div style={muted}>{siteSourceLine(site.city, recordsStart, today)}</div>}
    </div>
  )
}
