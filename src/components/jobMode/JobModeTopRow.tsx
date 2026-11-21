/**
 * Job Mode's top row, the day's row (the owner's pick, 2026-11-20): equal named squares under the header.
 * The two on the left are for the job the day points at and change with the day. Paint a map and My spend
 * sit at the right end and never move. `lib/jobMode/topRow.ts` decides which squares and their words; this
 * file reads the day, draws them and opens each door.
 *
 * The day is read when the row is drawn and again when the clock changes. Until it lands the left pair is
 * two empty squares, so nothing jumps when it does. A read that fails draws the person's own squares: no
 * press on this row waits on a weak signal.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useSessionChanges } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { useTallyUnlinkedCounts } from '../../hooks/useTallyUnlinkedCounts'
import { directionsUrlForAddress } from '../../lib/directionsUrl'
import { loadSiteBoxCount, loadTopRowDay } from '../../lib/jobMode/topRowIo'
import {
  TOP_ROW_ARIA,
  TOP_ROW_CONTROL,
  TOP_ROW_NO_DAY,
  TOP_ROW_WORDS,
  topRowBadge,
  topRowHoursValue,
  topRowJobState,
  topRowOnSitePath,
  topRowSquares,
  topRowTarget,
  topRowTomorrowValue,
  type TopRowDay,
  type TopRowSquareId,
} from '../../lib/jobMode/topRow'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { ORANGE_UNDER_WORDS, WORDS_ON_ORANGE } from '../../lib/orangeUnderWords'
import { CameraGlyph } from '../materials/PhotoPress'
import { PaintAMapPress } from '../paintedMap/PaintAMapPress'
import { JobPhotosWindowLazy } from '../photos/JobPhotosWindowLazy'

/** The anchor the hours card carries in Job Mode, where the This week square lands. */
export const JOB_MODE_HOURS_ANCHOR = 'dash-my-hours'

type Props = {
  userId: string | null | undefined
  role: string | null
  /** This week's hours so far, from the hours card's own read. `null` until it lands. */
  hoursThisWeek?: number | null
  /** Tomorrow's stops, from the Dashboard's schedule read. `null` until it lands. */
  tomorrowJobs?: number | null
  /** For a smoke: the day's read. */
  load?: (userId: string) => Promise<TopRowDay>
  /** For a smoke: the site's box count. */
  loadBoxes?: (jobId: string) => Promise<number>
  /** The bands page (design spike): the hours card sits behind a line, so the hours square opens that line. */
  onHours?: () => void
}

const row: CSSProperties = { display: 'flex', alignItems: 'stretch', gap: '0.5rem', marginBottom: '1rem' }
const tile: CSSProperties = { flex: '1 1 0', minWidth: 0, maxWidth: 148, minHeight: 62, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0.3rem 0.15rem', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.15, textAlign: 'center', textDecoration: 'none', cursor: 'pointer', boxSizing: 'border-box', position: 'relative' }
/** The job's squares: the row's loud pair. The border is the fill's own blue, so a loud square is as wide as an outlined one. */
const loud: CSSProperties = { ...tile, borderWidth: 1, borderStyle: 'solid', borderColor: '#2563eb', background: '#2563eb', color: 'white' }
/** The person's own squares: outlined, so the job's pair reads first. */
const quiet: CSSProperties = { ...tile, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
const ghost: CSSProperties = { ...tile, borderWidth: 1, borderStyle: 'dashed', borderColor: 'var(--border)', cursor: 'default' }
const value: CSSProperties = { fontSize: '1rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const badge: CSSProperties = { position: 'absolute', top: -5, right: -4, minWidth: 18, height: 18, padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: ORANGE_UNDER_WORDS, color: WORDS_ON_ORANGE, fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1, boxSizing: 'border-box', pointerEvents: 'none' }

const glyph = (children: ReactNode) => (
  <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }}>
    {children}
  </svg>
)
const DIRECTIONS = glyph(
  <>
    <path d="M12 2 22 12 12 22 2 12Z" />
    <path d="M9 14v-2a2 2 0 0 1 2-2h4" />
    <path d="m13 8 2 2-2 2" />
  </>,
)
const JOB = glyph(
  <>
    <path d="M6 3h9l4 4v14H6Z" />
    <path d="M9 11h7M9 15h7" />
  </>,
)
const BOX = glyph(
  <>
    <path d="M3 8 12 3l9 5v9l-9 5-9-5Z" />
    <path d="M3 8l9 5 9-5M12 13v9" />
  </>,
)
const CLOCK = glyph(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
)
const CALENDAR = glyph(
  <>
    <path d="M4 6h16v14H4Z" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </>,
)
/** A receipt: the door to My spend, the square the old row drew with no name. */
const RECEIPT = glyph(
  <>
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2" />
    <path d="M9 8h6M9 12h6" />
  </>,
)

export function JobModeTopRow({ userId, role, hoursThisWeek = null, tomorrowJobs = null, load = loadTopRowDay, loadBoxes = loadSiteBoxCount, onHours }: Props) {
  const navigate = useNavigate()
  const jobDetailModal = useJobDetailModal()
  const subscribeSessionChanges = useSessionChanges()
  const { unlinked: spendCount } = useTallyUnlinkedCounts(Boolean(userId) && role != null)
  /** The day as last read. `null` until a read lands; a later read keeps the last one on screen meanwhile. */
  const [day, setDay] = useState<TopRowDay | null>(null)
  const [boxes, setBoxes] = useState<{ jobId: string; count: number } | null>(null)
  const [photoJobId, setPhotoJobId] = useState<string | null>(null)
  const gen = useRef(0)

  useEffect(() => {
    if (!userId) return
    const read = () => {
      const mine = ++gen.current
      load(userId).then(
        (got) => mine === gen.current && setDay(got),
        // Nothing known: the person's own squares, which need no day.
        () => mine === gen.current && setDay((had) => had ?? TOP_ROW_NO_DAY),
      )
    }
    read()
    return subscribeSessionChanges(read)
  }, [userId, load, subscribeSessionChanges])

  const state = day ? topRowJobState(day) : null
  const onSiteJobId = state?.kind === 'on-site' ? state.job.id : null

  // The site's boxes, read once per job the person stands on. A read that fails leaves no On site square.
  useEffect(() => {
    if (!onSiteJobId) return
    let live = true
    loadBoxes(onSiteJobId).then(
      (count) => live && setBoxes({ jobId: onSiteJobId, count }),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [onSiteJobId, loadBoxes])

  if (!userId) return null

  const siteBoxes = boxes && boxes.jobId === onSiteJobId ? boxes.count : null
  const squares: TopRowSquareId[] = state ? topRowSquares(state, siteBoxes) : ['paint', 'spend']
  const job = state && state.kind !== 'none' ? state.job : null
  const pressed = (square: TopRowSquareId) => recordNavClick(userId, role, TOP_ROW_CONTROL, topRowTarget(square))
  const hours = topRowHoursValue(hoursThisWeek)
  const tomorrow = topRowTomorrowValue(tomorrowJobs)
  const spendBadge = topRowBadge(spendCount)

  const draw = (square: TopRowSquareId): ReactNode => {
    switch (square) {
      case 'directions': {
        const url = job ? directionsUrlForAddress(job.address) : null
        if (!job || !url) return null
        return (
          <button key={square} type="button" data-top-row-square={square} aria-label={TOP_ROW_ARIA.directions(job)} style={loud} onClick={() => { pressed(square); openInExternalBrowser(url) }}>
            {DIRECTIONS}
            <span>{TOP_ROW_WORDS.directions}</span>
          </button>
        )
      }
      case 'job-details':
        if (!job) return null
        return (
          <button key={square} type="button" data-top-row-square={square} aria-label={TOP_ROW_ARIA.jobDetails(job)} style={loud} onClick={() => { pressed(square); jobDetailModal?.openJobDetail({ jobId: job.id }) }}>
            {JOB}
            <span>{TOP_ROW_WORDS.jobDetails}</span>
          </button>
        )
      case 'photo':
        if (!job) return null
        return (
          <button key={square} type="button" data-top-row-square={square} aria-label={TOP_ROW_ARIA.photo(job)} style={loud} onClick={() => { pressed(square); setPhotoJobId(job.id) }}>
            <CameraGlyph size={22} />
            <span>{TOP_ROW_WORDS.photo}</span>
          </button>
        )
      case 'on-site':
        if (!job || siteBoxes == null) return null
        return (
          <button key={square} type="button" data-top-row-square={square} aria-label={TOP_ROW_ARIA.onSite(siteBoxes)} style={quiet} onClick={() => { pressed(square); navigate(topRowOnSitePath(job.id)) }}>
            {BOX}
            <span>{TOP_ROW_WORDS.onSite}</span>
            <span aria-hidden style={badge}>{topRowBadge(siteBoxes)}</span>
          </button>
        )
      case 'hours':
        return (
          <button key={square} type="button" data-top-row-square={square} aria-label={TOP_ROW_ARIA.hours(hours)} style={quiet} onClick={() => { pressed(square); if (onHours) onHours(); else document.getElementById(JOB_MODE_HOURS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>
            {hours ? <span style={value}>{hours}</span> : CLOCK}
            <span>{hours ? TOP_ROW_WORDS.hours : TOP_ROW_WORDS.hoursUnread}</span>
          </button>
        )
      case 'tomorrow':
        return (
          <button key={square} type="button" data-top-row-square={square} aria-label={TOP_ROW_ARIA.tomorrow(tomorrow)} style={quiet} onClick={() => { pressed(square); navigate('/job-mode/schedule') }}>
            {tomorrow ? <span style={value}>{tomorrow}</span> : CALENDAR}
            <span>{tomorrow ? TOP_ROW_WORDS.tomorrow : TOP_ROW_WORDS.tomorrowUnread}</span>
          </button>
        )
      case 'paint':
        return <PaintAMapPress key={square} userId={userId} role={role} shape="tile" tileStyle={quiet} />
      case 'spend':
        return (
          <Link key={square} to="/tally?tab=transactions" data-top-row-square={square} aria-label={TOP_ROW_ARIA.spend(spendCount)} style={quiet} onClick={() => pressed(square)}>
            {RECEIPT}
            <span>{TOP_ROW_WORDS.spend}</span>
            {spendBadge ? <span aria-hidden style={badge}>{spendBadge}</span> : null}
          </Link>
        )
    }
  }

  return (
    <div data-job-mode-top-row={state ? state.kind : 'reading'} style={row}>
      {state ? null : (
        <>
          <span aria-hidden data-top-row-square="reading" style={ghost} />
          <span aria-hidden data-top-row-square="reading" style={ghost} />
        </>
      )}
      {squares.map(draw)}
      {photoJobId && job && job.id === photoJobId ? (
        <JobPhotosWindowLazy job={{ id: job.id, hcp_number: job.number, job_name: job.name, job_address: job.address }} onClose={() => setPhotoJobId(null)} />
      ) : null}
    </div>
  )
}

export default JobModeTopRow
