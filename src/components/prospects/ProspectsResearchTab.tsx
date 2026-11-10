import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import {
  DEFAULT_RESEARCH_CITY,
  DEFAULT_VALUE_FLOOR,
  RESEARCH_CITIES,
  RESEARCH_SHOWING_WORDS,
  RESEARCH_WINDOWS,
  VALUE_FLOORS,
  VERDICT_WORDS,
  contactKeys,
  hintFor,
  lastLookedKey,
  leadDoor,
  lensCounts,
  mapsDoor,
  newSinceLooked,
  plumberTally,
  plumberWords,
  plumbingOnFile,
  pulledAtWords,
  pulledWords,
  rowLens,
  rowsAboveFloor,
  rowsShowing,
  shortDay,
  windowSinceYmd,
  windowWords,
  workWords,
  type ContactHistory,
  type Hint,
  type LeadFacts,
  type ResearchPermitRow,
  type ResearchShowing,
  type ResearchWindow,
  type ValueFloor,
  valueFloorWords,
} from '../../lib/research/permitResearch'
import { approachFromPermit, loadContactHistory, loadLatestPull, loadResearchPermits, loadResearchers, pullPermitsNow, putBackPermit, recordVerdict, type LatestPull } from '../../lib/research/permitResearchIo'
import { PermitDecideSheet, type PermitDecision } from './PermitDecideSheet'
import { ResearchMapCard } from './ResearchMapCard'
import { WhoPulledItSheet } from './WhoPulledItSheet'
import { PermitBuildingSheet } from './PermitBuildingSheet'
import { PermitSkimDeck, type AnsweredPatch, type Researcher } from './PermitSkimDeck'
import { PermitPlaceList } from './PermitPlaceList'
import { PermitCloseOutSheet, type PermitCloseOut } from './PermitCloseOutSheet'
import { PermitBuilders } from './PermitBuilders'
import { PermitCountStrip } from './PermitCountStrip'
import { keepFromPassedReason } from '../../lib/research/permitHistory'
import { secondLookCount, secondLookSegmentWords, showsSecondLookSegment } from '../../lib/research/permitSecondLook'
import { notPursuingVerdict, placeCounts, pursueReason, stripCounts, type SkimLive } from '../../lib/research/permitBuilders'
import { GoogleSearchPress } from './GoogleSearchPress'
import { googleAsksForContact } from '../../lib/research/permitPublic'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * Research (punch list #292): the permit ledger under Prospects. A city's building permits and
 * applications, newest first, each with who pulled it and whether a plumbing permit already names
 * a plumber; one Decide press per row opens the sheet. The Pulled line says when the feed was
 * last read and what is new since this reader last looked.
 */
const selectStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text)', minHeight: 36 }
const thStyle: CSSProperties = { textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const tdStyle: CSSProperties = { padding: '10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.875rem' }
const mutedStyle: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const chipStyle = (tone: 'green' | 'grey' | 'blue' | 'amber'): CSSProperties => ({
  display: 'inline-block',
  borderRadius: 999,
  padding: '2px 9px',
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: tone === 'green' ? 'var(--bg-green-tint)' : tone === 'blue' ? 'var(--bg-blue-tint)' : tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-200)',
  color: tone === 'green' ? 'var(--text-green-700)' : tone === 'blue' ? 'var(--text-blue-800)' : tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-700)',
})

function readLastLooked(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLastLooked(key: string, ymd: string): void {
  try {
    localStorage.setItem(key, ymd)
  } catch {
    // The mark is a convenience; a browser that refuses storage just counts the window.
  }
}

/** The hint under who pulled it: one word with its reason on hover. */
export function HintChip({ hint }: { hint: Hint }) {
  const tone = hint.tone === 'warm' ? 'amber' : hint.tone === 'new' ? 'blue' : 'grey'
  return (
    <span style={chipStyle(tone)} title={hint.detail}>
      {hint.word}
    </span>
  )
}

export function ProspectsResearchTab({ authUserId }: { authUserId: string }) {
  const { showToast } = useToastContext()
  const isMobile = useIsMobile()
  // Skim is step one and where the tab opens; Kept, Pursuing and Closed are where an answered permit sits;
  // the ledger and the map are the wide view of a window of the same rows.
  const [view, setView] = useState<'skim' | 'kept' | 'pursuing' | 'closed' | 'second' | 'builders' | 'ledger' | 'map'>('skim')
  const wide = view === 'ledger' || view === 'map'
  // A deck is open: the skim, or the second look at what someone else passed.
  const onDeck = view === 'skim' || view === 'second'
  const phoneSkim = isMobile && onDeck
  // Every permit the feed has brought, with no window: the deck, the step strip and the three lists read these.
  const [allRows, setAllRows] = useState<ResearchPermitRow[]>([])
  const [allLoading, setAllLoading] = useState(true)
  const [allError, setAllError] = useState<string | null>(null)
  const [researchers, setResearchers] = useState<Researcher[]>([])
  const [digRow, setDigRow] = useState<ResearchPermitRow | null>(null)
  const [closing, setClosing] = useState<{ mode: 'pursue' | 'not_pursuing'; row: ResearchPermitRow } | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [countKey, setCountKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<Map<string, ContactHistory>>(new Map())
  const todayYmd = todayYmdInAppTz()
  const [city, setCity] = useState<string>(DEFAULT_RESEARCH_CITY)
  const [windowDays, setWindowDays] = useState<ResearchWindow>(30)
  const [residential, setResidential] = useState(false)
  const [showing, setShowing] = useState<ResearchShowing>('waiting')
  const [floor, setFloor] = useState<ValueFloor>(DEFAULT_VALUE_FLOOR)
  const [rows, setRows] = useState<ResearchPermitRow[]>([])
  const [pull, setPull] = useState<LatestPull>({ ranAt: null, error: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastLooked] = useState<string | null>(() => readLastLooked(lastLookedKey(authUserId, DEFAULT_RESEARCH_CITY)))
  const [deciding, setDeciding] = useState<ResearchPermitRow | null>(null)
  const [whoRow, setWhoRow] = useState<ResearchPermitRow | null>(null)
  const [siteRow, setSiteRow] = useState<ResearchPermitRow | null>(null)
  const [leadFacts, setLeadFacts] = useState<LeadFacts>({})
  const [startVerdict, setStartVerdict] = useState<'approach' | null>(null)
  const [saving, setSaving] = useState(false)
  const [decideError, setDecideError] = useState<string | null>(null)
  const [pulling, setPulling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, latest] = await Promise.all([loadResearchPermits(city, windowSinceYmd(todayYmd, windowDays), residential), loadLatestPull(city)])
      setRows(list)
      setPull(latest)
      writeLastLooked(lastLookedKey(authUserId, city), todayYmd)
      // The hint: our bid history with every name on the list, one read, fail-soft (the ledger stands without it).
      try {
        setHistory(await loadContactHistory(list.flatMap((r) => contactKeys(r.contact))))
      } catch {
        setHistory(new Map())
      }
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [city, windowDays, residential, todayYmd, authUserId])

  useEffect(() => {
    void load()
  }, [load])

  const loadAll = useCallback(async () => {
    setAllError(null)
    try {
      setAllRows(await loadResearchPermits(city, '2000-01-01', false))
    } catch (e) {
      setAllError(formatErrorMessage(e))
    } finally {
      setAllLoading(false)
    }
  }, [city])
  useEffect(() => {
    void loadAll()
  }, [loadAll])
  useEffect(() => {
    let live = true
    void loadResearchers().then((list) => live && setResearchers(list))
    return () => {
      live = false
    }
  }, [])

  const places = useMemo(() => placeCounts(allRows, floor), [allRows, floor])
  // The strip is the one count on the page: while the skim is open it reads the deck's own number and held answer.
  const [skimLive, setSkimLive] = useState<SkimLive | null>(null)
  const strip = useMemo(() => stripCounts(places, onDeck ? skimLive : null), [places, onDeck, skimLive])
  // What someone else passed and nobody has looked at twice. The open deck's own number while it is open.
  const secondLeft = useMemo(() => (view === 'second' && skimLive?.mode === 'second' ? skimLive.left : secondLookCount(allRows, floor, authUserId)), [view, skimLive, allRows, floor, authUserId])
  /** An answer was written: the row reads it at once, so the strip and the lists do not wait on a reload. */
  const patchRow = useCallback(
    (permitId: string, patch: AnsweredPatch) => {
      const me = researchers.find((r) => r.id === authUserId)?.name ?? null
      setAllRows((prev) => prev.map((r) => (r.id === permitId ? { ...r, ...patch, verdict_by_name: me ?? r.verdict_by_name ?? 'you' } : r)))
      setCountKey((k) => k + 1)
    },
    [researchers, authUserId],
  )

  /** A row's own write: its presses rest while it runs, a failure says why, and the rows read again after. */
  const runOn = async (row: ResearchPermitRow, doing: () => Promise<void>, done: string) => {
    setBusyId(row.id)
    try {
      await doing()
      showToast(done, 'success')
      await loadAll()
      setCountKey((k) => k + 1)
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusyId(null)
    }
  }
  const handTo = (row: ResearchPermitRow, userId: string | null) => {
    const name = researchers.find((r) => r.id === userId)?.name ?? null
    void runOn(row, () => recordVerdict({ permitId: row.id, verdict: 'look', reason: name ? `Handed to ${name}.` : 'Handed to nobody yet.', lookAgainOn: row.verdict_look_again_on, prospectId: null, userId: authUserId, forUserId: userId }), name ? `${row.address ?? row.permit_number} is ${name}’s to follow up.` : `${row.address ?? row.permit_number} is nobody’s yet.`)
  }
  const putBack = (row: ResearchPermitRow) => {
    void runOn(row, () => putBackPermit(row.id, authUserId), `${row.address ?? row.permit_number} is back on the skim.`)
  }
  /** A closed permit goes to Kept, by anyone. The words say whose answer it overturned, for the history. */
  const keepFromPassed = (row: ResearchPermitRow) => {
    void runOn(row, () => recordVerdict({ permitId: row.id, verdict: 'look', reason: keepFromPassedReason(row), lookAgainOn: null, prospectId: null, userId: authUserId }), `${row.address ?? row.permit_number} is kept.`)
  }
  const closeOut = async (row: ResearchPermitRow, out: PermitCloseOut) => {
    setSaving(true)
    setCloseError(null)
    try {
      if (out.kind === 'pursue') {
        const lead = await approachFromPermit(row, out.role, authUserId, {})
        await recordVerdict({ permitId: row.id, verdict: 'approach', reason: pursueReason(out.pursueFor), lookAgainOn: null, prospectId: lead.prospectId, userId: authUserId, pursueFor: out.pursueFor, forUserId: out.forUserId })
        showToast(lead.reused ? `Put the permit on ${lead.companyName}’s lead on the GCs deck.` : `GC lead made: ${lead.companyName}, on the GCs deck.`, 'success')
      } else {
        const v = notPursuingVerdict(out.code)
        await recordVerdict({ permitId: row.id, verdict: 'not_for_us', reason: v.reason, lookAgainOn: null, prospectId: null, userId: authUserId, reasonCode: v.reasonCode })
        showToast(`${row.address ?? row.permit_number} is closed. ${v.reason}`, 'success')
      }
      setClosing(null)
      setDigRow(null)
      await loadAll()
      setCountKey((k) => k + 1)
    } catch (e) {
      setCloseError(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const sized = useMemo(() => rowsAboveFloor(rows, floor), [rows, floor])
  const counts = useMemo(() => lensCounts(sized), [sized])
  const visible = useMemo(() => rowsShowing(sized, showing), [sized, showing])
  const line = pulledWords({ ranAt: pull.ranAt, error: pull.error, newCount: newSinceLooked(sized, lastLooked), lastLookedYmd: lastLooked, counts })
  const tally = useMemo(() => (showing === 'taken' || showing === 'all' ? plumberTally(sized) : []), [sized, showing])
  const selected = useMemo(() => visible.find((r) => r.id === selectedId) ?? null, [visible, selectedId])
  const openDecide = (row: ResearchPermitRow, facts: LeadFacts = {}, start: 'approach' | null = null) => {
    setDecideError(null)
    setLeadFacts(facts)
    setStartVerdict(start)
    setDeciding(row)
  }
  const namePress: CSSProperties = { background: 'transparent', border: 0, padding: 0, font: 'inherit', fontSize: 'inherit', color: 'var(--text-link)', textAlign: 'left', cursor: 'pointer' }

  const decide = async (row: ResearchPermitRow, d: PermitDecision) => {
    setSaving(true)
    setDecideError(null)
    try {
      let prospectId: string | null = null
      if (d.verdict === 'approach') {
        const lead = await approachFromPermit(row, d.role, authUserId, leadFacts)
        prospectId = lead.prospectId
        showToast(lead.reused ? `Put the permit on ${lead.companyName}’s lead on the GCs deck.` : `GC lead made: ${lead.companyName}, on the GCs deck.`, 'success')
      }
      await recordVerdict({ permitId: row.id, verdict: d.verdict, reason: d.reason, lookAgainOn: d.lookAgainOn, prospectId, userId: authUserId })
      setDeciding(null)
      await load()
      void loadAll()
      setCountKey((k) => k + 1)
    } catch (e) {
      setDecideError(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const pullNow = async () => {
    setPulling(true)
    try {
      const out = await pullPermitsNow()
      const kept = out.feeds.reduce((n, f) => n + f.kept, 0)
      const stopped = out.feeds.find((f) => f.error)
      showToast(stopped ? `The pull kept ${kept} rows and stopped on ${stopped.source}: ${stopped.error}` : `Pulled ${kept} rows from the feed.`, stopped ? 'warning' : 'success')
      await load()
      void loadAll()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setPulling(false)
    }
  }

  const emptyState = () => {
    if (rows.length === 0) {
      if (!pull.ranAt) return <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'permits', control: 'Pull now' }), { onPress: () => void pullNow() })} />
      return <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'permits', query: '' }), { onPress: () => { setWindowDays(90); setResidential(true); setFloor(0) } })} />
    }
    if (showing === 'waiting') return <EmptyState main="Nothing waiting on a skim." tail={`${counts.taken} have a plumber, ${counts.approach} pursuing.`} />
    return <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'permits', query: '' }), { onPress: () => setShowing('all') })} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* On a phone the skim is the card: the filters and Pull now wait on the ledger, so the card starts near the top. */}
      <div style={{ display: phoneSkim ? 'none' : 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Permits</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>City</span>
          <select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} style={selectStyle}>
            {RESEARCH_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {wide && (
          <>
        <select aria-label="Filed window" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value) as ResearchWindow)} style={selectStyle}>
          {RESEARCH_WINDOWS.map((d) => (
            <option key={d} value={d}>
              {windowWords(d)}
            </option>
          ))}
        </select>
        <select aria-label="Showing" value={showing} onChange={(e) => setShowing(e.target.value as ResearchShowing)} style={selectStyle}>
          {(Object.keys(RESEARCH_SHOWING_WORDS) as ResearchShowing[]).map((s) => (
            <option key={s} value={s}>
              {RESEARCH_SHOWING_WORDS[s]}
            </option>
          ))}
        </select>
          </>
        )}
        <select aria-label="Declared value" value={floor} onChange={(e) => setFloor(Number(e.target.value) as ValueFloor)} style={selectStyle}>
          {VALUE_FLOORS.map((f) => (
            <option key={f} value={f}>
              {valueFloorWords(f)}
            </option>
          ))}
        </select>
        {wide && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text)' }}>
            <input type="checkbox" checked={residential} onChange={(e) => setResidential(e.target.checked)} />
            Include houses
          </label>
        )}
        <span style={{ flex: '1 1 auto' }} />
        <button
          type="button"
          onClick={() => void pullNow()}
          aria-disabled={pulling}
          style={{ background: pulling ? DEAD_PRESS_FILL : 'var(--surface)', color: pulling ? DEAD_PRESS_TEXT : 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem', minHeight: 36, cursor: pulling ? 'default' : 'pointer' }}
        >
          {pulling ? 'Pulling…' : 'Pull now'}
        </button>
      </div>

      <div role="group" aria-label="Where the permits are" style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : undefined, WebkitOverflowScrolling: 'touch', alignItems: 'center', paddingBottom: isMobile ? 2 : 0 }}>
        {(
          [
            { v: 'skim', words: 'Skim', n: strip.skim },
            { v: 'kept', words: 'Kept', n: strip.kept },
            { v: 'pursuing', words: 'Pursuing', n: strip.pursuing },
            { v: 'closed', words: 'Closed', n: strip.closed },
            { v: 'builders', words: 'Builders', n: null },
            { v: 'ledger', words: 'Ledger', n: null },
            { v: 'map', words: 'Map', n: null },
          ] as const
        ).map((step) => {
          const on = view === step.v
          // What someone else passed rides on Skim as a grey segment to its right: a phone shows it without a scroll.
          const joined = step.v === 'skim' && !allLoading && showsSecondLookSegment(secondLeft, view === 'second')
          const chip = (
            <button
              key={step.v}
              type="button"
              aria-pressed={on}
              onClick={() => {
                // An answer changes the rows the ledger and the map show, so they read again when they open.
                if (!wide && (step.v === 'ledger' || step.v === 'map')) void load()
                setView(step.v)
              }}
              style={{ background: on ? 'var(--text-strong)' : 'var(--bg-200)', color: on ? 'var(--surface)' : 'var(--text-strong)', border: 0, borderRadius: 999, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: on ? 600 : 400, minHeight: 36, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto', marginLeft: step.v === 'ledger' && !isMobile ? 'auto' : undefined, ...(joined ? { borderRadius: '999px 0 0 999px', paddingRight: 10 } : null) }}
            >
              {step.words}
              {step.n != null && !allLoading ? ` ${step.n}` : ''}
            </button>
          )
          if (!joined) return chip
          const second = secondLookSegmentWords(secondLeft)
          const secondOn = view === 'second'
          return (
            <span key="skim-and-second" style={{ display: 'inline-flex', flex: '0 0 auto' }}>
              {chip}
              <button
                type="button"
                aria-pressed={secondOn}
                aria-label={second.label}
                title="Second look: the permits someone else passed, once each"
                onClick={() => setView('second')}
                style={{ background: secondOn ? 'var(--text-strong)' : 'var(--bg-200)', color: secondOn ? 'var(--surface)' : 'var(--text-700)', border: 0, borderLeft: '1px solid var(--border)', borderRadius: '0 999px 999px 0', padding: '6px 12px 6px 10px', fontSize: '0.8125rem', fontWeight: secondOn ? 600 : 400, minHeight: 36, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {second.words}
              </button>
            </span>
          )
        })}
      </div>

      {!phoneSkim && <div style={mutedStyle}>{loading ? 'Reading the permits…' : wide ? line : pulledAtWords(pull)}</div>}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--text-red-700, var(--text-red-700))', fontSize: '0.875rem' }}>
          <span>{error}</span>
          <button type="button" onClick={() => void load()} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {wide && tally.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', background: 'var(--surface)' }}>
          <strong>Who wins what in {city}, this window</strong> <span style={mutedStyle}>· the plumbers named on a permit, not the applicants who pulled their own:</span>
          {tally.map((t) => (
            <span key={t.plumber} style={chipStyle('grey')}>
              {t.plumber} · {t.jobs}
            </span>
          ))}
        </div>
      )}

      {view === 'skim' && (
        <PermitSkimDeck authUserId={authUserId} city={city} floor={floor} todayYmd={todayYmd} isMobile={isMobile} rows={allRows} loading={allLoading} error={allError} researchers={researchers} onReload={() => void loadAll()} onAnswered={patchRow} onDigIn={() => setView('kept')} onLive={setSkimLive} onSecondLook={() => setView('second')} />
      )}
      {view === 'second' && (
        <PermitSkimDeck key="second" mode="second" authUserId={authUserId} city={city} floor={floor} todayYmd={todayYmd} isMobile={isMobile} rows={allRows} loading={allLoading} error={allError} researchers={researchers} onReload={() => void loadAll()} onAnswered={patchRow} onDigIn={() => setView('kept')} onLive={setSkimLive} />
      )}

      {(view === 'kept' || view === 'pursuing' || view === 'closed') &&
        (allError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            <span>{allError}</span>
            <button type="button" onClick={() => void loadAll()} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : allLoading ? (
          <div style={mutedStyle}>Reading the permits…</div>
        ) : (
          <PermitPlaceList place={view} rows={allRows} floor={floor} me={authUserId} todayYmd={todayYmd} researchers={researchers} busyId={busyId} onOpen={setDigRow} onHandTo={handTo} onPutBack={putBack} onKeep={keepFromPassed} onSkim={() => setView('skim')} />
        ))}

      {view === 'builders' && <PermitBuilders city={city} authUserId={authUserId} todayYmd={todayYmd} isMobile={isMobile} onChanged={() => void loadAll()} />}

      {!wide && <PermitCountStrip city={city} todayYmd={todayYmd} refreshKey={countKey} />}

      {wide && !loading && !error && visible.length === 0 && emptyState()}

      {view === 'map' && visible.length > 0 && (
        <ResearchMapCard rows={visible} selectedId={selectedId} onSelect={setSelectedId} isMobile={isMobile}>
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
              <div style={mutedStyle}>Selected pin</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                <button type="button" onClick={() => setSiteRow(selected)} style={{ ...namePress, fontWeight: 600 }}>
                  {selected.address ?? selected.permit_number}
                </button>{' '}
                · {workWords(selected).main}
              </div>
              <div style={mutedStyle}>
                {selected.permit_number} · {selected.stage} {shortDay(selected.filed_on)} · {workWords(selected).detail}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {plumbingOnFile(selected) ? <span style={chipStyle('grey')}>{plumberWords(selected).chip} · {plumberWords(selected).under}</span> : <span style={chipStyle('green')}>no plumber yet</span>}
                <HintChip hint={hintFor(selected.contact, history)} />
              </div>
              <div>
                <strong>Pulled by</strong>{' '}
                {selected.contact ? (
                  <button type="button" onClick={() => setWhoRow(selected)} style={namePress}>
                    {selected.contact}
                  </button>
                ) : (
                  'nobody named'
                )}{' '}
                {(() => {
                  const asks = googleAsksForContact(selected.contact, selected.city)
                  return <GoogleSearchPress ask={asks.company ?? asks.person} />
                })()}
              </div>
              {selected.verdict && (
                <div style={mutedStyle}>
                  {VERDICT_WORDS[selected.verdict].chip} · {selected.verdict_by_name ?? 'someone'}, {shortDay(selected.verdict_at ? selected.verdict_at.slice(0, 10) : null)}
                  {selected.verdict_reason ? ` · “${selected.verdict_reason}”` : ''}
                </div>
              )}
              <button type="button" onClick={() => openDecide(selected)} style={{ alignSelf: 'flex-start', background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 8, padding: '9px 14px', fontSize: '0.875rem', fontWeight: 600, minHeight: 40, cursor: 'pointer' }}>
                {selected.verdict ? 'Change the verdict…' : 'Decide…'}
              </button>
              {mapsDoor(selected) && (
                <a href={mapsDoor(selected) ?? '#'} target="_blank" rel="noreferrer" style={{ ...mutedStyle, color: 'var(--text-link)' }}>
                  Open in Google Maps
                </a>
              )}
            </div>
          )}
        </ResearchMapCard>
      )}

      {view === 'ledger' && visible.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr>
                <th style={thStyle}>Filed</th>
                <th style={thStyle}>Where</th>
                <th style={thStyle}>Work</th>
                <th style={thStyle}>Who pulled it</th>
                <th style={thStyle}>Plumber</th>
                <th style={{ ...thStyle, width: 300 }}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const work = workWords(row)
                const lens = rowLens(row)
                const maps = mapsDoor(row)
                return (
                  <tr key={row.id} style={lens === 'taken' ? { opacity: 0.75 } : undefined}>
                    <td style={tdStyle}>
                      {shortDay(row.filed_on)}
                      <br />
                      <span style={mutedStyle}>{row.stage}</span>
                    </td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => setSiteRow(row)} style={{ ...namePress, fontWeight: 700 }} title="The building: the permit as the city gave it, the property at the county, every permit on this address">
                        {row.address ?? row.permit_number}
                      </button>
                      {maps && (
                        <>
                          {' '}
                          <a href={maps} target="_blank" rel="noreferrer" style={{ ...mutedStyle, color: 'var(--text-link)' }}>
                            map
                          </a>
                        </>
                      )}
                      <br />
                      <span style={mutedStyle}>
                        {row.city}
                        {row.zip ? ` ${row.zip}` : ''} · {row.permit_number}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {work.main}
                      <br />
                      <span style={mutedStyle}>{work.detail}</span>
                    </td>
                    <td style={tdStyle}>
                      {row.contact ? (
                        <button type="button" onClick={() => setWhoRow(row)} style={namePress} title="Who pulled it: the company on Google, the owner at the county, our history, the city's record">
                          {row.contact}
                        </button>
                      ) : (
                        <span style={mutedStyle}>nobody named</span>
                      )}
                      <br />
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <HintChip hint={hintFor(row.contact, history)} />
                        {(() => {
                          const asks = googleAsksForContact(row.contact, row.city)
                          return <GoogleSearchPress ask={asks.company ?? asks.person} />
                        })()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {(() => {
                        const pw = plumberWords(row)
                        return (
                          <>
                            <span style={chipStyle(pw.kind === 'none' ? 'green' : 'grey')}>{pw.chip}</span>
                            {pw.under && (
                              <>
                                <br />
                                <span style={mutedStyle}>{pw.under}</span>
                              </>
                            )}
                          </>
                        )
                      })()}
                    </td>
                    <td style={tdStyle}>
                      {row.verdict ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>
                            <span style={chipStyle(row.verdict === 'approach' ? 'green' : row.verdict === 'look' ? 'blue' : 'grey')}>{VERDICT_WORDS[row.verdict].chip}</span>{' '}
                            <span style={mutedStyle}>
                              · {row.verdict_by_name ?? 'someone'}, {shortDay(row.verdict_at ? row.verdict_at.slice(0, 10) : null)}
                              {row.verdict === 'look' && row.verdict_look_again_on ? ` · again ${shortDay(row.verdict_look_again_on)}` : ''}
                              {row.verdict === 'approach' && row.verdict_prospect_id ? (
                                <>
                                  {' · '}
                                  <Link to={leadDoor(row.verdict_prospect_id)} style={{ color: 'var(--text-link)' }}>
                                    the GC lead
                                  </Link>
                                </>
                              ) : null}
                            </span>
                          </span>
                          {row.verdict_reason && <span style={mutedStyle}>“{row.verdict_reason}”</span>}
                          <button type="button" onClick={() => openDecide(row)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, padding: 0, color: 'var(--text-link)', fontSize: '0.78rem', cursor: 'pointer' }}>
                            Change
                          </button>
                        </div>
                      ) : lens === 'taken' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>
                            <span style={chipStyle('grey')}>Has a plumber</span> <span style={mutedStyle}>· read off the feed</span>
                          </span>
                          <button type="button" onClick={() => openDecide(row)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, padding: 0, color: 'var(--text-link)', fontSize: '0.78rem', cursor: 'pointer' }}>
                            Decide anyway
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => openDecide(row)} style={{ background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 8, padding: '8px 14px', fontSize: '0.875rem', fontWeight: 600, minHeight: 36, cursor: 'pointer' }}>
                          Decide…
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={mutedStyle}>
<strong>Skim</strong> shows one permit at a time, best first, with two answers: Keep or Pass. The grey <strong>passed</strong> count beside it opens a second look at what someone else passed, once each. An address opens <strong>The building</strong> and a name opens <strong>Who pulled it</strong>. The round <strong>G</strong> searches Google in a new tab. On the ledger, <strong>Decide…</strong> opens one sheet with the same words: Keep, Pass, Pursue, Has a plumber. <strong>Pursue</strong> makes a GC lead on the GCs deck with <em>A permit</em> as its source. The word under who pulled it reads our own bid history with that name and is never the verdict.
      </div>

      {digRow && !closing && !whoRow && (
        <PermitBuildingSheet
          row={digRow}
          onClose={() => setDigRow(null)}
          onDecide={() => {
            // A permit that is not kept (pursued, closed) changes its verdict on the Decide sheet, as on the ledger.
            const r = digRow
            setDigRow(null)
            openDecide(r)
          }}
          onWho={() => setWhoRow(digRow)}
          closeOut={
            digRow.verdict === 'look'
              ? {
                  onPursue: () => {
                    setCloseError(null)
                    setClosing({ mode: 'pursue', row: digRow })
                  },
                  onNotPursuing: () => {
                    setCloseError(null)
                    setClosing({ mode: 'not_pursuing', row: digRow })
                  },
                }
              : undefined
          }
        />
      )}
      {closing && <PermitCloseOutSheet mode={closing.mode} row={closing.row} me={authUserId} researchers={researchers} saving={saving} error={closeError} onDone={(out) => void closeOut(closing.row, out)} onCancel={() => !saving && setClosing(null)} />}
      {siteRow && !deciding && !whoRow && (
        <PermitBuildingSheet
          row={siteRow}
          onClose={() => setSiteRow(null)}
          onDecide={() => {
            const r = siteRow
            setSiteRow(null)
            openDecide(r)
          }}
          onWho={() => {
            const r = siteRow
            setSiteRow(null)
            setWhoRow(r)
          }}
        />
      )}
      {whoRow && !deciding && (
        <WhoPulledItSheet
          row={whoRow}
          hint={hintFor(whoRow.contact, history)}
          onClose={() => setWhoRow(null)}
          onApproach={(facts) => {
            const r = whoRow
            setWhoRow(null)
            openDecide(r, facts, 'approach')
          }}
        />
      )}
      {deciding && <PermitDecideSheet row={deciding} todayYmd={todayYmd} saving={saving} error={decideError} initialVerdict={startVerdict ?? undefined} facts={leadFacts} onDecide={(d) => void decide(deciding, d)} onCancel={() => !saving && setDeciding(null)} />}
    </div>
  )
}
