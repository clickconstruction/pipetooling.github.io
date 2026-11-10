import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { usePermitRecordsStart } from '../../hooks/usePermitRecordsStart'
import { RESEARCH_CITIES, shortDay } from '../../lib/research/permitResearch'
import { reachWords, recordsReach } from '../../lib/research/permitReach'
import { sitePermitLines as feedLines, type SitePermit } from '../../lib/research/permitPublic'
import { loadPermitsOfBuilder, loadResearchers } from '../../lib/research/permitResearchIo'
import { loadNameAnswers, onNameAnswered, recordNameAnswer } from '../../lib/research/bidSiteIo'
import { foldNameAnswers, listedOnWords, tiedNames, type TiedName } from '../../lib/research/nameAnswers'

/**
 * Other permits under names tied to a GC (punch list #307, PR 7): the second half of the GC's
 * panel. The GC's own name, then each name someone tied to it, with whose word it is and what
 * the city lists the name on. A tie can be taken back here. A name on a permit is the contact
 * the city lists, so the panel never says the GC pulled them.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }

type Row = TiedName & { permits: SitePermit[] }
type Loaded = { state: 'loading' } | { state: 'absent' } | { state: 'done'; rows: Row[] } | { state: 'failed'; message: string }

export function BidGcTiedNames({ customerIds, customerName }: { customerIds: readonly string[]; customerName: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const idsKey = [...customerIds].sort().join(',')
  const cities = RESEARCH_CITIES
  const today = todayYmdInAppTz()
  const recordsStart = usePermitRecordsStart(cities[0] ?? '')
  // One city's records have one start; across several cities no single day is true, so no span is claimed.
  const reach = cities.length === 1 ? reachWords(recordsReach(recordsStart, today), today) : null

  const load = useCallback(async () => {
    const answers = await loadNameAnswers(idsKey === '' ? [] : idsKey.split(','))
    if (answers == null) return setLoaded({ state: 'absent' })
    const people = new Map((await loadResearchers()).map((r) => [r.id, r.name]))
    const names = tiedNames(foldNameAnswers(answers.rows, idsKey.split(',')), customerName, answers.me, (id) => people.get(id) ?? null)
    const rows: Row[] = []
    for (const n of names) {
      const all = (await Promise.all(cities.map((c) => loadPermitsOfBuilder(c, n.key, today)))).flat()
      rows.push({ ...n, permits: n.tie === 'permits' ? all.filter((p) => n.permitIds.includes(p.id)) : all })
    }
    setLoaded({ state: 'done', rows })
  }, [idsKey, customerName, cities, today])

  useEffect(() => {
    let live = true
    const run = () =>
      load().catch((e) => {
        if (live) setLoaded({ state: 'failed', message: formatErrorMessage(e) })
      })
    void run()
    const off = onNameAnswered(() => void run())
    return () => {
      live = false
      off()
    }
  }, [load])

  // Before the table is on the database this half is not drawn.
  if (loaded.state === 'absent') return null

  const takeBack = async (row: Row) => {
    const customerId = customerIds[0]
    if (!customerId) return
    setBusy(true)
    try {
      await recordNameAnswer({ builderKey: row.key, customerId, answer: 'taken_back', scope: null, permitId: null, name: row.name })
    } catch (e) {
      setLoaded({ state: 'failed', message: formatErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const heading = <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Other permits under names tied to them</div>
  if (loaded.state === 'loading') {
    return (
      <>
        {heading}
        <div style={muted}>Reading the names tied to them…</div>
      </>
    )
  }
  if (loaded.state === 'failed') {
    return (
      <>
        {heading}
        <div style={{ ...muted, color: 'var(--text-red-700)' }}>{loaded.message}</div>
      </>
    )
  }

  const tied = loaded.rows.filter((r) => r.tie !== 'own')
  return (
    <>
      {heading}
      <div style={{ borderTop: '1px solid var(--border)' }} data-testid="bid-gc-tied-names">
        {loaded.rows.map((r) => {
          const lines = feedLines(r.permits, null)
          const open = openKey === r.key
          return (
            <div key={r.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'grid', gap: 3 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.875rem' }}>{r.name}</strong>
                <span style={{ display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, background: r.tie === 'own' ? 'var(--bg-200)' : 'var(--bg-blue-tint)', color: r.tie === 'own' ? 'var(--text-700)' : 'var(--text-blue-700)' }}>{r.how}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                <span>{listedOnWords(lines.length, reach)}</span>
                {lines.length > 0 && (
                  <button type="button" aria-expanded={open} onClick={() => setOpenKey(open ? null : r.key)} style={linkPress}>
                    {open ? 'Hide them' : 'See them ›'}
                  </button>
                )}
                {r.tie !== 'own' && (
                  <button type="button" disabled={busy} onClick={() => void takeBack(r)} style={linkPress}>
                    Take back
                  </button>
                )}
              </div>
              {open && (
                <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: '3px 10px', fontSize: '0.8125rem', marginTop: 2 }}>
                  {lines.slice(0, 20).map((l) => (
                    <span key={l.id} style={{ display: 'contents' }}>
                      <span style={muted}>{l.day ? shortDay(l.day) : '—'}</span>
                      <span>{[l.what, l.where].filter(Boolean).join(' · ')}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {tied.length === 0 && <div style={muted}>A name is tied when someone answers the question beside a permit on a bid’s site.</div>}
      <div style={muted}>A name on a permit is the contact the city lists. It is not always the builder.</div>
    </>
  )
}
