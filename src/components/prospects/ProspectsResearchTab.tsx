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
import { approachFromPermit, loadContactHistory, loadLatestPull, loadResearchPermits, pullPermitsNow, recordVerdict, type LatestPull } from '../../lib/research/permitResearchIo'
import { PermitDecideSheet, type PermitDecision } from './PermitDecideSheet'
import { ResearchMapCard } from './ResearchMapCard'
import { WhoPulledItSheet } from './WhoPulledItSheet'
import { PermitBuildingSheet } from './PermitBuildingSheet'
import { PermitSkimDeck } from './PermitSkimDeck'
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
  // Skim is step one and where the tab opens; the ledger and the map are the wide view of the same rows.
  const [view, setView] = useState<'skim' | 'ledger' | 'map'>('skim')
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
        {view !== 'skim' && (
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
        {view !== 'skim' && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text)' }}>
            <input type="checkbox" checked={residential} onChange={(e) => setResidential(e.target.checked)} />
            Include houses
          </label>
        )}
        <span style={{ flex: '1 1 auto' }} />
        <div role="group" aria-label="View" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {(['skim', 'ledger', 'map'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                // An answer on the skim changes the rows the ledger and the map show, so they read again.
                if (view === 'skim' && v !== 'skim') void load()
                setView(v)
              }}
              style={{ background: view === v ? 'var(--bg-200)' : 'var(--surface)', color: 'var(--text)', border: 0, borderRight: v === 'map' ? 0 : '1px solid var(--border)', padding: '7px 12px', fontSize: '0.8125rem', fontWeight: view === v ? 600 : 400, minHeight: 36, cursor: 'pointer' }}
            >
              {v === 'skim' ? 'Skim' : v === 'ledger' ? 'Ledger' : 'Map'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void pullNow()}
          aria-disabled={pulling}
          style={{ background: pulling ? DEAD_PRESS_FILL : 'var(--surface)', color: pulling ? DEAD_PRESS_TEXT : 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem', minHeight: 36, cursor: pulling ? 'default' : 'pointer' }}
        >
          {pulling ? 'Pulling…' : 'Pull now'}
        </button>
      </div>

      <div style={mutedStyle}>{loading ? 'Reading the permits…' : view === 'skim' ? pulledAtWords(pull) : line}</div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--text-red-700, var(--text-red-700))', fontSize: '0.875rem' }}>
          <span>{error}</span>
          <button type="button" onClick={() => void load()} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {view !== 'skim' && tally.length > 0 && (
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
        <PermitSkimDeck
          authUserId={authUserId}
          city={city}
          floor={floor}
          todayYmd={todayYmd}
          isMobile={isMobile}
          onDigIn={() => {
            setShowing('look')
            setWindowDays(90)
            setView('ledger')
            void load()
          }}
        />
      )}

      {view !== 'skim' && !loading && !error && visible.length === 0 && emptyState()}

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
<strong>Skim</strong> shows one permit at a time, best first, with two answers: Keep or Pass. An address opens <strong>The building</strong> and a name opens <strong>Who pulled it</strong>. The round <strong>G</strong> searches Google in a new tab. On the ledger, <strong>Decide…</strong> opens one sheet with the same words: Keep, Pass, Pursue, Has a plumber. <strong>Pursue</strong> makes a GC lead on the GCs deck with <em>A permit</em> as its source. The word under who pulled it reads our own bid history with that name and is never the verdict.
      </div>

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
