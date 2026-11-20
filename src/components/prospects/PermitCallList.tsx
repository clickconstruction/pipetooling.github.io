import { useMemo, useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { PermitChip } from '../bids/PermitChip'
import { GoogleSearchPress } from './GoogleSearchPress'
import { PermitCloseOutSheet, type PermitCloseOut } from './PermitCloseOutSheet'
import type { Researcher } from './PermitSkimDeck'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { leadMadeWords, shortDay, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { builderName, pursueReason, type BuilderRow } from '../../lib/research/permitBuilders'
import { googleAskForCompany } from '../../lib/research/permitPublic'
import { approachFromPermit, loadPermitsOfBuilder, recordVerdict } from '../../lib/research/permitResearchIo'
import { recordCallAnswer } from '../../lib/research/permitMarketIo'
import {
  ASK_FOR_EMPTY,
  CALL_SHOWING_WORDS,
  NOT_FOR_US_REASONS,
  answeredWords,
  callChipCounts,
  callCountWords,
  callEmptyWords,
  callHistoryWords,
  callNoteWords,
  callRowsShowing,
  callTags,
  callWorkWords,
  lookAgainOn,
  permitRowOfSite,
  pursuePermit,
  standingWords,
  type CallRow,
  type CallShowing,
  type CallStanding,
} from '../../lib/research/permitCallList'

/**
 * Permits, Market: the call list (punch list #405, step two). Five builders to call this week,
 * each with its reasons as tags, the jobs it has applied for with no plumber yet and our history
 * with it. **Pursue** makes the lead the skim's Pursue makes, from the builder's newest open job.
 * **Not for us** passes on the name. Either answer takes the name off the list and the next
 * takes its place. The answers are kept in `builder_call_answers`, so the list is the same for
 * everyone and on a reload, and **Put back** undoes one. *Ask for* stands empty until a name is
 * looked up, with the Google press beside it.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }
const chip = (on: boolean): CSSProperties => ({ padding: '5px 11px', borderRadius: 999, fontSize: '0.78rem', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)', fontWeight: on ? 600 : 400, minHeight: 32, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
const press: CSSProperties = { background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem', minHeight: 36, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const primary: CSSProperties = { ...press, background: '#2563eb', border: '1px solid #2563eb', color: '#ffffff', fontWeight: 600 }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }
// A press inside a line of words: the underline alone marks it, in the words' own colour.
const wordPress: CSSProperties = { background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2, textAlign: 'left' }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 600 }

/** How many rows a chip other than This week draws before it asks. */
const PAGE = 20

type Pursuing = { call: CallRow; permit: ResearchPermitRow; live: boolean }

export function PermitCallList({
  city,
  authUserId,
  todayYmd,
  isMobile,
  list,
  chips,
  builders,
  standings,
  rows,
  loading,
  error,
  reach,
  trendKnown,
  hasApplications,
  recordsStart,
  researchers,
  onAnswered,
  onChanged,
  onOpenBuilder,
  onOpenPermit,
}: {
  city: string
  authUserId: string
  todayYmd: string
  isMobile: boolean
  /** The call list in order, every name that may be on it. */
  list: readonly CallRow[]
  chips: readonly CallShowing[]
  /** The city's Builders rows, for the name of an answered builder. */
  builders: readonly BuilderRow[]
  standings: ReadonlyMap<string, CallStanding>
  /** The tab's rows for the city: the open jobs open The building, and a pursue's lead is made from one. */
  rows: readonly ResearchPermitRow[]
  loading: boolean
  error: string | null
  /** "in the last year" or "since Aug 26": how far back a count here can see. */
  reach: string | null
  trendKnown: boolean
  hasApplications: boolean
  recordsStart: string | null
  researchers: readonly Researcher[]
  /** An answer was written: the answers read again. */
  onAnswered: () => void
  /** A pursue wrote a verdict on a permit: the tab's rows read again. */
  onChanged: () => void
  onOpenBuilder: (row: BuilderRow) => void
  onOpenPermit: (row: ResearchPermitRow) => void
}) {
  const { showToast } = useToastContext()
  const [showing, setShowing] = useState<CallShowing>('week')
  const [more, setMore] = useState(PAGE)
  const [pursuing, setPursuing] = useState<Pursuing | null>(null)
  const [passing, setPassing] = useState<CallRow | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [answeredOpen, setAnsweredOpen] = useState(false)

  const counts = useMemo(() => callChipCounts(list), [list])
  const shown = useMemo(() => callRowsShowing(list, showing), [list, showing])
  const visible = showing === 'week' ? shown : shown.slice(0, more)
  const nameOf = (userId: string) => (userId === authUserId ? 'You' : (researchers.find((r) => r.id === userId)?.name ?? null))
  // The answers that still hold a name off the list, the newest first, for this city's names.
  const answered = useMemo(() => {
    const byKey = new Map(builders.map((b) => [b.key, b]))
    return [...standings.entries()]
      .filter(([key, s]) => s.off && (byKey.has(key) || s.row.city === city))
      .map(([key, s]) => ({ key, standing: s, name: byKey.get(key) ? builderName(byKey.get(key) as BuilderRow) : key }))
      .sort((a, b) => b.standing.row.answered_at.localeCompare(a.standing.row.answered_at))
  }, [standings, builders, city])

  const pick = (s: CallShowing) => {
    setShowing(s)
    setMore(PAGE)
  }

  /** Pursue opens on the permit the lead is made from: a job open now, else their newest permit. */
  const startPursue = async (call: CallRow) => {
    setSheetError(null)
    const held = pursuePermit(call, rows)
    if (held) {
      setPursuing({ call, permit: held, live: true })
      return
    }
    setBusyKey(call.key)
    try {
      const theirs = await loadPermitsOfBuilder(city, call.key, todayYmd)
      const newest = theirs[0]
      if (!newest) throw new Error(`Could not find a permit of ${call.name} to make the lead from.`)
      setPursuing({ call, permit: permitRowOfSite(city, newest, call.builder), live: false })
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const pursue = async (p: Pursuing, out: Extract<PermitCloseOut, { kind: 'pursue' }>) => {
    setSaving(true)
    setSheetError(null)
    try {
      const lead = await approachFromPermit(p.permit, out.role, authUserId, {})
      // A permit the tab holds joins Pursuing with its lead, as a pursue on the skim does. A history row was never on the skim.
      if (p.live) await recordVerdict({ permitId: p.permit.id, verdict: 'approach', reason: pursueReason(out.pursueFor), lookAgainOn: null, prospectId: lead.prospectId, userId: authUserId, pursueFor: out.pursueFor, forUserId: out.forUserId })
      const again = lookAgainOn('pursue', todayYmd)
      await recordCallAnswer({ builderKey: p.call.key, answer: 'pursue', reason: pursueReason(out.pursueFor), lookAgainOn: again, city, prospectId: lead.prospectId, permitId: p.permit.id })
      showToast(`${leadMadeWords(lead)} ${answeredWords(p.call.name, 'pursue', again, todayYmd)}`, 'success')
      setPursuing(null)
      onAnswered()
      if (p.live) onChanged()
    } catch (e) {
      setSheetError(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const pass = async (call: CallRow) => {
    setSaving(true)
    setSheetError(null)
    try {
      const again = lookAgainOn('not_for_us', todayYmd)
      await recordCallAnswer({ builderKey: call.key, answer: 'not_for_us', reason: reason ?? '', lookAgainOn: again, city })
      showToast(answeredWords(call.name, 'not_for_us', again, todayYmd), 'success')
      setPassing(null)
      setReason(null)
      onAnswered()
    } catch (e) {
      setSheetError(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const putBack = async (key: string, name: string) => {
    setBusyKey(key)
    try {
      await recordCallAnswer({ builderKey: key, answer: 'back', reason: '', lookAgainOn: null, city })
      showToast(`${name} may be offered on the list again.`, 'success')
      onAnswered()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section aria-labelledby="market-call-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 id="market-call-list" style={heading}>
          Call this week
        </h3>
        <div style={muted}>Builders who keep pulling permits here, with why each is on the list. Five a week, so one person can call them all. Nothing is a score.</div>
      </div>
      <div role="group" aria-label="Which builders to call" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {chips.map((s) => (
          <button key={s} type="button" aria-pressed={showing === s} onClick={() => pick(s)} style={chip(showing === s)}>
            {CALL_SHOWING_WORDS[s]} {counts[s]}
          </button>
        ))}
      </div>

      {error && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{error}</div>}

      {loading ? (
        <div style={muted}>Reading the year of permits…</div>
      ) : visible.length === 0 ? (
        <EmptyState main={callEmptyWords({ city, builders: builders.length, eligible: list.length, showing })} compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((call, i) => {
            const work = callWorkWords(call)
            const history = callHistoryWords(call, todayYmd)
            const busy = busyKey === call.key
            return (
              <article key={call.key} data-call-row={call.key} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 12px', display: 'grid', gridTemplateColumns: isMobile ? '26px minmax(0, 1fr)' : '26px minmax(0, 1fr) auto', gap: 10, alignItems: 'start' }}>
                <div aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--text-strong)', color: 'var(--surface)', fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i + 1}
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: 5 }}>
                  <strong style={{ fontSize: '0.9375rem', overflowWrap: 'anywhere' }}>{call.name}</strong>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {callTags(call, todayYmd).map((t) => (
                      <PermitChip key={t.words} chip={t} />
                    ))}
                  </div>
                  <div style={{ fontSize: '0.8125rem' }}>
                    {callCountWords(call, reach, trendKnown)}
                    {work ? ` ${work}` : ''}
                  </div>
                  {call.openJobs.length > 0 && (
                    <div style={{ fontSize: '0.8125rem' }}>
                      <strong>Open now:</strong>{' '}
                      {call.openJobs.slice(0, 4).map((job, j) => {
                        const row = rows.find((r) => r.id === job.id)
                        const where = job.address ?? job.work ?? 'a job'
                        return (
                          <span key={job.id}>
                            {j > 0 ? ' · ' : ''}
                            {row ? (
                              <button type="button" onClick={() => onOpenPermit(row)} title="The building: the permit as the city gave it, and every permit on this address" style={wordPress}>
                                {where}
                              </button>
                            ) : (
                              where
                            )}
                            {job.appliedOn ? `, applied ${shortDay(job.appliedOn, todayYmd)}` : ''}
                          </span>
                        )
                      })}
                      {call.openJobs.length > 4 ? ` · and ${call.openJobs.length - 4} more` : ''}. {call.openJobs.length === 1 ? 'It has no plumbing permit.' : 'None has a plumbing permit.'}
                    </div>
                  )}
                  {history && <div style={{ fontSize: '0.8125rem' }}>{history}</div>}
                  <div style={{ fontSize: '0.8125rem', background: 'var(--bg-200)', borderRadius: 8, padding: '6px 8px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>Ask for</strong>
                    <span>{ASK_FOR_EMPTY.main}</span>
                    <GoogleSearchPress ask={googleAskForCompany(call.name, city)} words="Google the builder" />
                    <span style={muted}>{ASK_FOR_EMPTY.tail}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 6, flexWrap: 'wrap', gridColumn: isMobile ? '2' : undefined }}>
                  <button type="button" aria-label={`Pursue ${call.name}`} aria-disabled={busy} onClick={() => !busy && void startPursue(call)} style={busy ? { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : primary}>
                    {busy ? 'Reading…' : 'Pursue'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Not for us: ${call.name}`}
                    onClick={() => {
                      setSheetError(null)
                      setReason(null)
                      setPassing(call)
                    }}
                    style={press}
                  >
                    Not for us
                  </button>
                  <button type="button" aria-label={`Open builder ${call.name}`} onClick={() => onOpenBuilder(call.builder)} style={press}>
                    Open builder
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!loading && showing === 'week' && list.length > shown.length && (
        <div style={muted}>
          {list.length - shown.length} more wait behind these. A name leaves the list when it is answered, the way a permit leaves the skim, and the next takes its place.
        </div>
      )}
      {!loading && showing !== 'week' && shown.length > visible.length && (
        <button type="button" onClick={() => setMore((n) => n + PAGE)} style={{ ...linkPress, alignSelf: 'flex-start' }}>
          Show {Math.min(PAGE, shown.length - visible.length)} more of {shown.length}
        </button>
      )}
      {!loading && builders.length > 0 && <div style={muted}>{callNoteWords({ city, trendKnown, hasApplications, recordsStart })}</div>}

      {answered.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <button type="button" aria-expanded={answeredOpen} onClick={() => setAnsweredOpen((o) => !o)} style={{ ...linkPress, justifySelf: 'start' }}>
            Answered {answered.length} {answeredOpen ? '▾' : '▸'}
          </button>
          {answeredOpen && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
              {answered.map((a, i) => (
                <div key={a.key} data-call-answered={a.key} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '9px 12px', borderTop: i === 0 ? 0 : '1px solid var(--border)', fontSize: '0.8125rem' }}>
                  <strong>{a.name}</strong>
                  <span style={{ flex: '1 1 220px', minWidth: 0, color: 'var(--text-muted)' }}>{standingWords(a.standing, nameOf, todayYmd)}</span>
                  <button type="button" disabled={busyKey === a.key} aria-label={`Put ${a.name} back on the list`} onClick={() => void putBack(a.key, a.name)} style={linkPress}>
                    Put back
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pursuing && <PermitCloseOutSheet mode="pursue" row={pursuing.permit} me={authUserId} researchers={researchers} saving={saving} error={sheetError} onDone={(out) => out.kind === 'pursue' && void pursue(pursuing, out)} onCancel={() => !saving && setPursuing(null)} />}

      {passing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 760, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={() => !saving && setPassing(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="call-pass-title" style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 12, padding: '1.25rem 1.5rem', maxWidth: 480, width: '92%', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', display: 'grid', gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <h2 id="call-pass-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {passing.name} is not for us
            </h2>
            <div style={muted}>Say why in one press, or leave it unsaid.</div>
            <div role="group" aria-label="Why" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NOT_FOR_US_REASONS.map((r) => (
                <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? null : r)} style={chip(reason === r)}>
                  {r}
                </button>
              ))}
            </div>
            <div style={muted}>The name leaves the list for everyone, with your name and today. It can be put back. A name that files for others is better said on its builder’s sheet: it then leaves every list for good.</div>
            {sheetError && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{sheetError}</div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
              <button type="button" aria-disabled={saving} onClick={() => !saving && void pass(passing)} style={{ ...primary, background: saving ? DEAD_PRESS_FILL : '#2563eb', color: saving ? DEAD_PRESS_TEXT : '#ffffff', border: 0, padding: '11px 16px', fontSize: '0.9375rem', minHeight: 44, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Keeping…' : reason ? `Not for us · ${reason.toLowerCase()}` : 'Not for us'}
              </button>
              <button type="button" onClick={() => setPassing(null)} disabled={saving} style={{ ...press, padding: '11px 14px', minHeight: 44 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
