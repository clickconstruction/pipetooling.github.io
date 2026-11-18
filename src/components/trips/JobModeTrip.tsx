/**
 * The phone's trip on Job Mode's card (v2.7701, punch list #379, PR 7b): the question once somebody is
 * clocked in on a job of a site that is a trip from home, and the banner while their own trip is open,
 * with **Heading home** and **End the trip**.
 *
 * The card mounts this for the job in its header: the job of an open clock session, or the job that is
 * ready to start. The question is asked only with a `sessionId`, so only after a clock in went through,
 * and no press here reaches the clock. Every act that fails says its reason in the place it was pressed
 * and leaves the clock as it was. The rules are `lib/trips/tripPhone.ts`; the reads and the acts are
 * `hooks/useTripPhone.ts`. The sheets and the presses are the On my way family's (`jobMode/sheetStyles.ts`).
 */
import { useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useTripPhone, type TripPhoneIo } from '../../hooks/useTripPhone'
import { TRIP_PHONE_WORDS as W, type TripPhoneStorage, type TripSessionTravel } from '../../lib/trips/tripPhone'
import { formatErrorMessage } from '../../utils/errorHandling'
import * as S from '../jobMode/sheetStyles'

export interface JobModeTripProps {
  /** The job in the card's header. */
  jobId: string
  /** The open clock session on that job, or null before the clock in: then the banner alone, never the question. */
  sessionId: string | null
  /**
   * The open session's On my way and I'm here stamps as the card holds them: null for none, undefined
   * while the card is still reading. They say whether a trip act paints today On the road or At the site.
   */
  travel: TripSessionTravel | null | undefined
  /** The job as the card names it: *PLUM 2101 · Lift station*. */
  jobLabel: string
  jobAddress: string | null
  /** For a smoke. */
  io?: TripPhoneIo
  storage?: TripPhoneStorage | null
}

type Busy = 'start' | 'home' | 'end' | `join:${string}`

const banner: CSSProperties = { borderRadius: 10, padding: '0.6rem 0.75rem', background: 'var(--bg-green-tint)', border: '1px solid var(--text-green-700)', textAlign: 'left' }
const bannerTitle: CSSProperties = { fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-green-700)' }
const bannerSub: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-700)' }
const bannerRow: CSSProperties = { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }
const bannerPress: CSSProperties = { ...S.secondaryBtn, flex: '1 1 0', minWidth: 0 }
const smallLine: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }
const stackPress: CSSProperties = { width: '100%', marginTop: '0.5rem' }
const outcomeBox: CSSProperties = { width: '100%', minHeight: 96, fontSize: '1rem', fontFamily: 'inherit', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box', resize: 'vertical' }
const dead = (style: CSSProperties, on: boolean): CSSProperties => (on ? { ...style, ...S.disabled } : style)

export function JobModeTrip({ jobId, sessionId, travel, jobLabel, jobAddress, io, storage }: JobModeTripProps) {
  const toast = useOptionalToastContext()
  const trip = useTripPhone({ jobId, sessionId, travel, address: jobAddress, io, storage })
  const [busy, setBusy] = useState<Busy | null>(null)
  /** The reason an act failed, by where it was pressed. */
  const [problem, setProblem] = useState<{ at: 'ask' | 'banner' | 'end'; words: string } | null>(null)
  const [ending, setEnding] = useState(false)
  const [outcome, setOutcome] = useState('')

  const run = async (which: Busy, at: 'ask' | 'banner' | 'end', act: () => Promise<void>, done: string | null, failed: string): Promise<boolean> => {
    if (busy) return false
    setBusy(which)
    setProblem(null)
    try {
      await act()
      if (done) toast?.showToast(done, 'success')
      return true
    } catch (e) {
      setProblem({ at, words: formatErrorMessage(e, failed) })
      return false
    } finally {
      setBusy(null)
    }
  }

  const view = trip.view

  if (view.kind === 'ask') {
    return (
      <ResponsiveModalShell title={jobLabel} onRequestClose={() => !busy && trip.justClockIn()}>
        <div data-testid="trip-phone-ask">
          {view.siteLine ? (
            <p style={{ ...S.muted, margin: 0 }} data-testid="trip-phone-site">
              {view.siteLine}
            </p>
          ) : null}
          <p style={{ fontSize: '1rem', color: 'var(--text-strong)', margin: '0.75rem 0 0.25rem' }}>{W.question}</p>
          <button type="button" style={dead({ ...S.primaryBtn, ...stackPress }, busy != null)} disabled={busy != null} onClick={() => void run('start', 'ask', trip.start, W.started, W.startFailed)} data-testid="trip-phone-start">
            {busy === 'start' ? 'One moment…' : W.start}
          </button>
          {view.joins.map((j) => (
            <button key={j.tripId} type="button" style={dead({ ...S.secondaryBtn, ...stackPress }, busy != null)} disabled={busy != null} onClick={() => void run(`join:${j.tripId}`, 'ask', () => trip.join(j.tripId), W.joined, W.joinFailed)} data-testid="trip-phone-join">
              {busy === `join:${j.tripId}` ? 'One moment…' : j.label}
            </button>
          ))}
          <button type="button" style={{ ...S.quietLink, ...stackPress, minHeight: 48 }} disabled={busy != null} onClick={trip.justClockIn} data-testid="trip-phone-just-clock-in">
            {W.justClockIn}
          </button>
          {problem?.at === 'ask' ? (
            <p role="alert" style={S.warn} data-testid="trip-phone-problem">
              {problem.words}
            </p>
          ) : null}
          <p style={smallLine}>{W.promise}</p>
        </div>
      </ResponsiveModalShell>
    )
  }

  if (view.kind !== 'banner') return null

  const closeEnd = () => {
    if (busy) return
    setEnding(false)
    setProblem(null)
  }
  const endTrip = async () => {
    const ok = await run('end', 'end', () => trip.end(outcome), W.ended, W.endFailed)
    if (ok) {
      setEnding(false)
      setOutcome('')
    }
  }
  const onRoad = view.todayKind === 'road'

  return (
    <div style={banner} data-testid="trip-phone-banner">
      <div style={bannerTitle} data-testid="trip-phone-banner-title">
        {view.title}
      </div>
      <div style={bannerSub} data-testid="trip-phone-banner-sub">
        {view.sub}
      </div>
      <div style={bannerRow}>
        {onRoad ? null : (
          <button type="button" style={dead(bannerPress, busy != null)} disabled={busy != null} onClick={() => void run('home', 'banner', trip.headHome, W.roadToday, W.homeFailed)} data-testid="trip-phone-heading-home">
            {busy === 'home' ? 'One moment…' : W.headingHome}
          </button>
        )}
        <button
          type="button"
          style={dead(bannerPress, busy != null)}
          disabled={busy != null}
          onClick={() => {
            setProblem(null)
            setEnding(true)
          }}
          data-testid="trip-phone-end"
        >
          {W.end}
        </button>
      </div>
      {problem?.at === 'banner' ? (
        <p role="alert" style={S.warn} data-testid="trip-phone-problem">
          {problem.words}
        </p>
      ) : null}
      <p style={smallLine} data-testid="trip-phone-home-line">
        {onRoad ? W.roadToday : W.headingHomeLine}
      </p>
      {ending ? (
        <ResponsiveModalShell
          title={W.endTitle}
          onRequestClose={closeEnd}
          footer={
            <div style={S.footerRow}>
              <button type="button" style={dead(S.secondaryBtn, busy != null)} disabled={busy != null} onClick={closeEnd} data-testid="trip-phone-not-yet">
                {W.notYet}
              </button>
              <button type="button" style={dead(S.primaryBtn, busy != null)} disabled={busy != null} onClick={() => void endTrip()} data-testid="trip-phone-end-confirm">
                {busy === 'end' ? 'One moment…' : W.end}
              </button>
            </div>
          }
        >
          <div data-testid="trip-phone-end-sheet">
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', margin: 0 }} data-testid="trip-phone-end-heading">
              {view.heading}
            </p>
            <p style={{ ...S.muted, margin: '0.15rem 0 0' }}>{view.when}</p>
            {view.daysLine ? (
              <p style={{ fontSize: '1rem', color: 'var(--text-strong)', margin: '0.75rem 0 0' }} data-testid="trip-phone-days">
                {view.daysLine}
              </p>
            ) : null}
            <label style={{ display: 'block', marginTop: '0.9rem' }}>
              <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.3rem' }}>{W.outcomeLabel}</span>
              <textarea style={outcomeBox} value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={2000} data-testid="trip-phone-outcome" />
            </label>
            {problem?.at === 'end' ? (
              <p role="alert" style={S.warn} data-testid="trip-phone-problem">
                {problem.words}
              </p>
            ) : null}
            <p style={smallLine}>{W.endLine}</p>
          </div>
        </ResponsiveModalShell>
      ) : null}
    </div>
  )
}
