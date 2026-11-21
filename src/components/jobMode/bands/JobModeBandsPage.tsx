import { lazy, Suspense, useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserRole } from '../../../hooks/useAuth'
import { useTallyUnlinkedCounts } from '../../../hooks/useTallyUnlinkedCounts'
import { readPhoneFoldOpen, writePhoneFoldOpen } from '../../../lib/dashboard/phoneFolds'
import { BANDS_WORDS, buildWaitingRows, crewHereSentences, crewSentence, crewToday, latestJobLines, reportToWrite, waitingCount, weekSentence, weekStrip, type WaitingRow } from '../../../lib/jobMode/bands'
import { clockHm } from '../../../lib/jobMode/onMyWay'
import { formatReviewMonthLabel } from '../../../lib/prospects/teamMemberReviews'
import { DashboardCardHead, DashboardCardTitle } from '../../dashboard/DashboardCardTitle'
import DashboardYourRecordCard from '../../dashboard/DashboardYourRecordCard'
import DashboardMyVehicleCard from '../../DashboardMyVehicleCard'
import RateMyCrewDeck from '../../team-feedback/RateMyCrewDeck'
import { useBandsReads } from './useBandsReads'

const DashboardSupervisorSection = lazy(() => import('../../dashboard/DashboardSupervisorSection'))

/**
 * Job Mode in three bands (design spike, 2026-11-20; to-dos/crew-lead-dashboard). The page a crew lead on a long
 * job opens: **My job** (the card and the day's row), **Around me** (his crew, the latest on the job, his week,
 * the company's day), **Waiting on me** (one list with one count) and **Everything else**, where each piece of
 * the page he had is one line that opens in place. Nothing leaves the page: a section stays mounted while its
 * line is closed, so its reads run and its presses land where they landed.
 *
 * The Dashboard hands in the pieces it already owns. This page owns the order, the two new bands and the two
 * sections it brings forward from the foot of the full Dashboard: My crew and My truck.
 */

export type BandFoldSpec = {
  /** The storage handle and the anchor: stable, one per section. */
  section: string
  title: string
  /** What the closed line says about what is inside. */
  headline?: string | null
  tone?: 'quiet' | 'amber' | 'red'
  node: ReactNode
}

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.7rem 0.9rem', display: 'grid', gap: '0.55rem' }
const MUTED: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
const LINE: CSSProperties = { fontSize: '0.9375rem', color: 'var(--text)' }
const ROW: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', padding: '0.55rem 0.7rem', borderLeft: '4px solid #f59e0b', background: 'var(--surface)', borderRadius: 6 }
const PRESS_FIRST: CSSProperties = { fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, padding: '0.45rem 0.8rem', minHeight: 36, borderRadius: 6, border: 'none', background: '#b45309', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }
const PRESS: CSSProperties = { ...PRESS_FIRST, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)' }
const TONE = { quiet: 'var(--text-muted)', amber: 'var(--text-amber-800)', red: 'var(--text-red-600)' } as const

function BandHead({ title, right, count }: { title: string; right?: string | null; count?: number }) {
  return (
    <DashboardCardHead card={null} below="0.4rem" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
      <DashboardCardTitle nowrap>{title}</DashboardCardTitle>
      {count != null && count > 0 ? (
        <span data-testid="bands-waiting-count" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: '#b45309', borderRadius: 999, padding: '0.05rem 0.5rem' }}>
          {count}
        </span>
      ) : null}
      {right ? <span style={{ ...MUTED, marginLeft: 'auto' }}>{right}</span> : null}
    </DashboardCardHead>
  )
}

/** One line that opens in place. The section stays mounted while closed. */
function BandFold({ spec, open, onToggle }: { spec: BandFoldSpec; open: boolean; onToggle: () => void }) {
  const bodyId = `bands-fold-${spec.section}`
  return (
    <section id={`bands-${spec.section}`} data-bands-fold={spec.section} data-open={open ? 'yes' : 'no'} style={{ scrollMarginTop: '4.5rem' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 48, padding: '0.6rem 0.85rem', border: '1px solid var(--border)', borderRadius: open ? '10px 10px 0 0' : 10, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9375rem', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong>{spec.title}</strong>
          {spec.headline ? <span style={{ color: TONE[spec.tone ?? 'quiet'] }}> · {spec.headline}</span> : null}
        </span>
        <span style={{ color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{open ? 'Close ▴' : 'Open ▾'}</span>
      </button>
      <div id={bodyId} hidden={!open} style={{ paddingTop: open ? '0.5rem' : 0 }}>
        {spec.node}
      </div>
    </section>
  )
}

export function JobModeBandsPage({
  userId,
  role,
  displayName,
  isSalary,
  top,
  card,
  companyDay,
  yourWeek,
  folds,
  coursesOwed,
  onLeaveReport,
  onFullDashboard,
  tail,
  spikeSwitch,
}: {
  userId: string
  role: UserRole | null
  displayName: string
  isSalary: boolean
  /** Above the card: the hidden clock mount the card's presses need, and the two strips that are rare. */
  top?: ReactNode
  /** The job card in its bands shape, with the day's row inside it. It tells the page which job it is about, and is handed the press that opens a line of Everything else. */
  card: (onDayJob: (jobId: string | null) => void, openFold: (section: string) => void) => ReactNode
  /** Crew Day, the company's day, behind one line of Around me. */
  companyDay?: { headline: string | null; node: ReactNode } | null
  /** Your week: draws nothing unless the office set a signal. */
  yourWeek?: ReactNode
  /** Everything else, in order: each piece of the page as it was, behind its own line. */
  folds: ReadonlyArray<BandFoldSpec>
  coursesOwed: number
  onLeaveReport: (job: { id: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
  onFullDashboard: () => void
  /** The Leave report and Turnaway windows the card opens. */
  tail?: ReactNode
  /** The spike's own before and after switch. */
  spikeSwitch?: ReactNode
}) {
  const navigate = useNavigate()
  const [jobId, setJobId] = useState<string | null>(null)
  const reads = useBandsReads(userId, role, jobId)
  const tally = useTallyUnlinkedCounts(true)
  const [truck, setTruck] = useState<{ vehicle: string; age: string | null } | null>(null)
  const [recordRows, setRecordRows] = useState(0)
  const [reportHours, setReportHours] = useState<Record<string, number>>({})
  const [deckOpen, setDeckOpen] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const isOpen = (section: string): boolean => open[section] ?? readPhoneFoldOpen(userId, `bands-${section}`)
  const setFold = useCallback(
    (section: string, next: boolean) => {
      setOpen((o) => ({ ...o, [section]: next }))
      writePhoneFoldOpen(userId, `bands-${section}`, next)
    },
    [userId],
  )
  /** A row's press opens the section it is about, where it sits, and brings it into view. */
  const openFold = (section: string) => {
    setFold(section, true)
    window.setTimeout(() => document.getElementById(`bands-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const nowMs = useMemo(() => Date.now(), [reads.jobEvents, reads.payload]) // eslint-disable-line react-hooks/exhaustive-deps -- the clock is read again when a read lands
  const crew = useMemo(() => crewToday(reads.payload, jobId, reads.today, userId), [reads.payload, jobId, reads.today, userId])
  const crewLine = crewSentence(crew)
  const hereLines = crewHereSentences(crew, clockHm)
  const latest = useMemo(() => (reads.jobEvents ? latestJobLines(reads.jobEvents, nowMs) : null), [reads.jobEvents, nowMs])
  const strip = useMemo(() => weekStrip(reads.weekBlocks, reads.today), [reads.weekBlocks, reads.today])

  const pastReports = reads.view.reportsOwed.filter((r) => !r.isToday).length
  const rows = useMemo(
    () => buildWaitingRows({ reportsOwed: reads.view.reportsOwed, toRate: reads.toRate, rateMonth: formatReviewMonthLabel(reads.reviewMonth), cardCharges: tally.unlinked, truck, coursesOwed, hoursByJob: reportHours }),
    [reads.view.reportsOwed, reads.toRate, reads.reviewMonth, tally.unlinked, truck, coursesOwed, reportHours],
  )
  const count = waitingCount(rows, recordRows)
  /** The jobs a led day already asks a report for: Your record leaves its own row for those out, and keeps it for any other job. */
  const ledReportJobs = useMemo(() => new Set(reads.view.reportsOwed.map((r) => r.jobId)), [reads.view.reportsOwed])

  const press = (row: WaitingRow) => {
    if (row.key === 'reports') {
      const r = reportToWrite(reads.view.reportsOwed)
      if (r) onLeaveReport({ id: r.jobId, hcpNumber: r.hcpNumber, jobName: r.jobName, jobAddress: r.address ?? '' })
    } else if (row.key === 'rate') setDeckOpen(true)
    else if (row.key === 'cards') navigate('/tally?tab=transactions')
    else openFold(row.key)
  }

  const crewSummary = [pastReports > 0 ? `${pastReports} ${pastReports === 1 ? 'report' : 'reports'} owed` : null, reads.toRate > 0 ? `${reads.toRate} to rate` : null].filter(Boolean).join(' · ')
  const ownFolds: BandFoldSpec[] = [
    ...(reads.view.supervisor
      ? [
          {
            section: 'crew',
            title: 'My crew',
            headline: crewSummary || 'the days you led, and their hours',
            tone: crewSummary ? ('amber' as const) : ('quiet' as const),
            node: (
              <Suspense fallback={null}>
                <DashboardSupervisorSection authUserId={userId} role={role} onLeaveReport={onLeaveReport} />
              </Suspense>
            ),
          },
        ]
      : []),
    ...folds,
  ]

  return (
    <div data-job-mode-bands>
      {spikeSwitch}
      {top}

      <BandHead title={BANDS_WORDS.myJob} right={crewLine} />
      {card(setJobId, openFold)}

      <BandHead title={BANDS_WORDS.aroundMe} />
      <div style={CARD} data-testid="bands-around-me">
        {hereLines.length > 0 ? (
          <div style={{ display: 'grid', gap: 2 }}>
            {hereLines.map((s) => (
              <div key={s} style={LINE}>
                {s}
              </div>
            ))}
          </div>
        ) : null}
        {jobId ? (
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ ...MUTED, fontWeight: 600 }}>{BANDS_WORDS.latest}</div>
            {latest == null ? (
              <div style={MUTED}>Reading the job.</div>
            ) : latest.length === 0 ? (
              <div style={MUTED}>{BANDS_WORDS.noLatest}</div>
            ) : (
              latest.map((l) => (
                <div key={l.key} style={LINE}>
                  {l.words}
                  <span style={MUTED}>
                    {' '}
                    · {l.who ? `${l.who}, ` : ''}
                    {l.age}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ ...MUTED, fontWeight: 600 }}>{BANDS_WORDS.week}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }} data-testid="bands-week">
            {strip.map((d) => (
              <div key={d.ymd} style={{ textAlign: 'center', minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: d.isToday ? 700 : 500, color: d.isToday ? 'var(--text)' : 'var(--text-muted)' }}>{d.weekday}</div>
                <div
                  style={{ fontSize: '0.75rem', border: `1px solid ${d.isToday ? 'var(--text-link)' : 'var(--border)'}`, borderRadius: 6, padding: '0.2rem 0', color: d.labels.length > 0 ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={d.labels.join(', ')}
                >
                  {d.labels.length === 0 ? '—' : d.labels.length === 1 ? d.labels[0] : `${d.labels.length} jobs`}
                </div>
              </div>
            ))}
          </div>
          <div style={MUTED}>{weekSentence(strip)}</div>
        </div>
      </div>
      {companyDay ? (
        <div style={{ marginTop: '0.5rem' }}>
          <BandFold spec={{ section: 'company', title: BANDS_WORDS.company, headline: companyDay.headline, node: companyDay.node }} open={isOpen('company')} onToggle={() => setFold('company', !isOpen('company'))} />
        </div>
      ) : null}
      {yourWeek}

      <BandHead title={BANDS_WORDS.waiting} count={count} />
      <div style={{ display: 'grid', gap: '0.45rem' }} data-testid="bands-waiting">
        {rows.map((row, i) => (
          <div key={row.key} style={ROW} data-bands-waiting-row={row.key}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{row.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.note}</div>
            </div>
            <button type="button" style={i === 0 ? PRESS_FIRST : PRESS} onClick={() => press(row)}>
              {row.action}
            </button>
          </div>
        ))}
        {/* Your record's own rows: a clock left open, a job with no percent, and the report row where no led day already asks for it. */}
        <DashboardYourRecordCard userId={userId} role={role} displayName={displayName} isSalary={isSalary} bare omitReportJobs={ledReportJobs} onCount={setRecordRows} onReportHours={setReportHours} />
        {count === 0 ? <div style={{ ...MUTED, padding: '0.4rem 0.2rem' }}>{BANDS_WORDS.waitingClear}</div> : null}
      </div>

      <BandHead title={BANDS_WORDS.everythingElse} right="each line opens here" />
      <div style={{ display: 'grid', gap: '0.5rem' }} data-testid="bands-everything-else">
        {ownFolds.map((spec) => (
          <BandFold key={spec.section} spec={spec} open={isOpen(spec.section)} onToggle={() => setFold(spec.section, !isOpen(spec.section))} />
        ))}
        {/* My truck: mounted always, so the waiting list can say a reading is asked. It draws nothing with no vehicle held. */}
        <BandFold
          spec={{ section: 'truck', title: 'My truck', headline: truck ? 'a mileage reading is asked' : 'mileage, oil and problems', tone: truck ? 'amber' : 'quiet', node: <DashboardMyVehicleCard userId={userId} onReadingAsked={setTruck} /> }}
          open={isOpen('truck')}
          onToggle={() => setFold('truck', !isOpen('truck'))}
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
          <button type="button" onClick={onFullDashboard} style={{ padding: '0.5rem 0.9rem', minHeight: 44, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-gray-800)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
            {BANDS_WORDS.fullDashboard}
          </button>
        </div>
      </div>

      <RateMyCrewDeck open={deckOpen} onClose={() => setDeckOpen(false)} userId={userId} reviewMonth={reads.reviewMonth} onSaved={reads.reread} />
      {tail}
    </div>
  )
}

export default JobModeBandsPage
