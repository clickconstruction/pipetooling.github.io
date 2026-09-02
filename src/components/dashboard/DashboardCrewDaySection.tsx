import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { UserRole } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { toLocalDateString } from '../../lib/dailyGoalsGate'
import {
  buildCrewDayView,
  crewDayNavWord,
  crewDayReportLabel,
  crewDaySummaryFor,
  formatCrewDayBlockTime,
  formatCrewDayHours,
  isCrewDayEmailRole,
  isCrewDayRole,
  type CrewDayFlag,
  type CrewDayPayload,
} from '../../lib/crewDay'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import CrewDayEmailModal from './CrewDayEmailModal'

/**
 * Dashboard "Crew Day" section (v2.2602): who was on what jobs and what they
 * did for one company-calendar day — schedule vs clocked hours, field-report
 * excerpts, % complete movement, and attention flags. Renders for office
 * roles (company-wide) and superintendents (scoped server-side to their
 * assigned projects by `get_crew_day_payload`). Self-gates on `isCrewDayRole`;
 * the parent mounts it unconditionally above the My Inbox card.
 *
 * Hours only, never wages.
 */

const COLLAPSED_PEOPLE = 8

const clockFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  hour: 'numeric',
  minute: '2-digit',
})
const compactClock = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return clockFmt.format(d).replace(' AM', 'a').replace(' PM', 'p')
}

const dayTitleFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}
const dayDateSuffix = (ymd: string): string => dayTitleFmt.format(new Date(`${ymd}T12:00:00Z`))

/** Per-device "Show office staff" preference for the superintendent fold (v2.2617). */
const SHOW_OFFICE_STORAGE_KEY = 'pipetooling_crew_day_show_office'
function readShowOfficePref(): boolean {
  try {
    return localStorage.getItem(SHOW_OFFICE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
function writeShowOfficePref(v: boolean): void {
  try {
    localStorage.setItem(SHOW_OFFICE_STORAGE_KEY, v ? '1' : '0')
  } catch {
    /* per-device convenience only */
  }
}

const FLAG_COPY: Record<CrewDayFlag, { text: string; tone: 'amber' | 'red' }> = {
  no_report: { text: 'No report left', tone: 'amber' },
  scheduled_no_clock: { text: 'Scheduled — never clocked in', tone: 'red' },
  unscheduled_work: { text: 'Unscheduled work', tone: 'amber' },
}

const flagChipStyle = (tone: 'amber' | 'red') =>
  ({
    display: 'inline-block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    borderRadius: 6,
    padding: '0.1rem 0.5rem',
    background: tone === 'red' ? 'var(--bg-red-100)' : 'var(--bg-amber-100)',
    color: tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-700)',
  }) as const

const statChipStyle = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  borderRadius: 999,
  padding: '0.1rem 0.55rem',
  border: '1px solid var(--border)',
  background: 'var(--surface-raised, var(--surface))',
  color: 'var(--text-700)',
  whiteSpace: 'nowrap',
} as const

const navBtnStyle = {
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: '0.05rem 0.5rem',
  fontSize: '0.8125rem',
} as const

export function DashboardCrewDaySection({
  authUserId,
  role,
}: {
  authUserId: string | undefined
  role: UserRole | null
}) {
  const todayYmd = toLocalDateString(new Date())
  const [ymd, setYmd] = useState(todayYmd)
  const [payload, setPayload] = useState<CrewDayPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadedAtMs, setLoadedAtMs] = useState(() => Date.now())
  const [showAllPeople, setShowAllPeople] = useState(false)
  /** ✉ share modal (v2.2603) — schedule/send the crew_day email stream. */
  const [emailModalOpen, setEmailModalOpen] = useState(false)

  const visible = Boolean(authUserId) && isCrewDayRole(role)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.rpc('get_crew_day_payload' as never, { p_day: ymd } as never),
          'get_crew_day_payload',
        )
        if (cancelled) return
        const body = data as unknown as (CrewDayPayload & { error?: string }) | null
        if (!body || body.error) {
          setLoadError(true)
          setPayload(null)
        } else {
          setPayload(body)
          setLoadedAtMs(Date.now())
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible, ymd, authUserId])

  const view = useMemo(
    () => (payload ? buildCrewDayView(payload, loadedAtMs) : null),
    [payload, loadedAtMs],
  )

  /**
   * Office fold (v2.2617): superintendent viewers see field crews first —
   * office-role people collapse behind "Show office staff" (remembered per
   * device). Office viewers always see everyone. A pre-roles payload marks
   * nobody office, so the fold is silently inert until the migration lands.
   */
  const [showOffice, setShowOffice] = useState(readShowOfficePref)
  const officeFoldActive = role === 'superintendent' && !showOffice
  const visiblePeople = useMemo(
    () => (view ? (officeFoldActive ? view.people.filter((p) => !p.office) : view.people) : []),
    [view, officeFoldActive],
  )
  const hiddenOffice = useMemo(
    () => (view && officeFoldActive ? view.people.filter((p) => p.office) : []),
    [view, officeFoldActive],
  )
  const displaySummary = useMemo(() => crewDaySummaryFor(visiblePeople), [visiblePeople])

  if (!visible) return null

  return (
    <div
      id="dash-crew-day"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.85rem 1rem 1rem',
        marginBottom: '1rem',
        scrollMarginTop: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', margin: 0, whiteSpace: 'nowrap' }}>Crew Day</h2>
          {/* Office roles only (v2.2615): superintendents don't get the email —
              the dashboard is their window (owner decision; server enforces too). */}
          {isCrewDayEmailRole(role) ? (
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              title="Email Crew Day — now or on a schedule"
              aria-label="Email Crew Day"
              style={{ ...navBtnStyle, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
            >
              {/* Icon: Font Awesome Free 7.x — envelope (OFL/CC-BY), owner-picked. */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={14} height={14} fill="currentColor" aria-hidden focusable={false}>
                <path d="M112 128C85.5 128 64 149.5 64 176C64 191.1 71.1 205.3 83.2 214.4L291.2 370.4C308.3 383.2 331.7 383.2 348.8 370.4L556.8 214.4C568.9 205.3 576 191.1 576 176C576 149.5 554.5 128 528 128L112 128zM64 260L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 260L377.6 408.8C343.5 434.4 296.5 434.4 262.4 408.8L64 260z" />
              </svg>
            </button>
          ) : null}
        </div>
        {/* Restacked day nav (v2.2617): arrows together, label floating beneath;
            Today / Yesterday keep their names, older days read "N days ago". */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button type="button" style={navBtnStyle} aria-label="Previous day" onClick={() => setYmd((d) => shiftYmd(d, -1))}>
              ◀
            </button>
            <button
              type="button"
              style={{ ...navBtnStyle, ...(ymd === todayYmd ? { opacity: 0.35, cursor: 'default' } : null) }}
              aria-label="Next day"
              disabled={ymd === todayYmd}
              onClick={() => setYmd((d) => (d === todayYmd ? d : shiftYmd(d, 1)))}
            >
              ▶
            </button>
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {crewDayNavWord(ymd, todayYmd)}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {dayDateSuffix(ymd)}</span>
          </span>
        </div>
      </div>

      {role === 'superintendent' ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Scoped to your assigned projects.
        </div>
      ) : null}

      {loading ? (
        <DashboardListRowSkeleton rows={3} />
      ) : loadError ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Couldn't load this day — try again in a moment.
        </p>
      ) : !view || view.people.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: '0.875rem' }}>No crew activity for this day.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
            <span style={statChipStyle}>{displaySummary.people} people</span>
            <span style={statChipStyle}>{displaySummary.jobs} jobs</span>
            <span style={statChipStyle}>{formatCrewDayHours(displaySummary.totalMs)}</span>
            <span style={statChipStyle}>
              {displaySummary.reports} report{displaySummary.reports === 1 ? '' : 's'}
            </span>
            {displaySummary.flags > 0 ? (
              <span
                style={{
                  ...statChipStyle,
                  background: 'var(--bg-amber-tint)',
                  color: 'var(--text-amber-700)',
                  border: '1px solid var(--text-amber-700)',
                }}
              >
                {displaySummary.flags} flag{displaySummary.flags === 1 ? '' : 's'}
              </span>
            ) : null}
            {hiddenOffice.length > 0 ? (
              <span style={{ ...statChipStyle, borderStyle: 'dashed', fontWeight: 500, color: 'var(--text-muted)' }}>
                +{hiddenOffice.length} office hidden
              </span>
            ) : null}
          </div>

          {visiblePeople.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: '0.875rem' }}>
              No field crew activity for this day.
            </p>
          ) : null}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(showAllPeople ? visiblePeople : visiblePeople.slice(0, COLLAPSED_PEOPLE)).map((p) => {
              const worstTone: 'amber' | 'red' | null = p.flags.some((f) => FLAG_COPY[f].tone === 'red')
                ? 'red'
                : p.flags.length > 0
                  ? 'amber'
                  : null
              return (
                <li
                  key={p.userId}
                  style={{
                    border: '1px solid var(--border)',
                    borderLeft:
                      worstTone === 'red'
                        ? '3px solid var(--text-red-600)'
                        : worstTone === 'amber'
                          ? '3px solid #f59e0b'
                          : '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.5rem 0.7rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatCrewDayHours(p.totalMs)}
                      {p.open ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · on the clock</span> : null}
                    </span>
                  </div>
                  {p.jobs.map((j, ji) => (
                    <div key={j.jobId ?? `x${ji}`} style={{ marginTop: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8125rem' }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 500 }}>{j.label}</span>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {[
                              j.sessions.length > 0
                                ? j.sessions
                                    .map((s) => `${compactClock(s.inAt)} – ${s.outAt ? compactClock(s.outAt) : 'now'}`)
                                    .join(', ')
                                : null,
                              j.scheduled.length > 0
                                ? `scheduled ${j.scheduled
                                    .map((b) => `${formatCrewDayBlockTime(b.start)} – ${formatCrewDayBlockTime(b.end)}`)
                                    .join(', ')}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                            {view.pctMovement.has(j.jobId ?? '') ? (
                              <span style={{ color: 'var(--text-green-600)', fontWeight: 600 }}>
                                {' '}
                                · ▲ {view.pctMovement.get(j.jobId ?? '')?.from}% → {view.pctMovement.get(j.jobId ?? '')?.to}%
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {formatCrewDayHours(j.hoursMs)}
                        </span>
                      </div>
                      {j.reports.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            marginTop: '0.3rem',
                            borderLeft: '3px solid var(--text-green-600)',
                            background: 'var(--bg-green-tint)',
                            borderRadius: '0 6px 6px 0',
                            padding: '0.3rem 0.5rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-700)',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--text-green-700)' }}>
                            {crewDayReportLabel(r.templateName)} · {compactClock(r.createdAt)}
                          </span>
                          {r.excerpt ? <span> — {r.excerpt}</span> : null}
                        </div>
                      ))}
                    </div>
                  ))}
                  {p.flags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                      {p.flags.map((f) => (
                        <span key={f} style={flagChipStyle(FLAG_COPY[f].tone)}>
                          {FLAG_COPY[f].text}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {visiblePeople.length > COLLAPSED_PEOPLE && !showAllPeople ? (
            <button
              type="button"
              onClick={() => setShowAllPeople(true)}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--text-link)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                padding: 0,
              }}
            >
              Show all {visiblePeople.length} people
            </button>
          ) : null}
          {hiddenOffice.length > 0 ? (
            <div
              style={{
                border: '1px dashed var(--border-strong)',
                borderRadius: 8,
                padding: '0.45rem 0.7rem',
                marginTop: '0.5rem',
                textAlign: 'center',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
              }}
            >
              {hiddenOffice.length} office staff hidden (
              {hiddenOffice.slice(0, 3).map((p) => p.name).join(' · ')}
              {hiddenOffice.length > 3 ? ' …' : ''}) —{' '}
              <button
                type="button"
                onClick={() => {
                  setShowOffice(true)
                  writeShowOfficePref(true)
                }}
                style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem', padding: 0 }}
              >
                Show office staff
              </button>
            </div>
          ) : null}
          {role === 'superintendent' && showOffice ? (
            <button
              type="button"
              onClick={() => {
                setShowOffice(false)
                writeShowOfficePref(false)
              }}
              style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, marginTop: '0.4rem' }}
            >
              Hide office staff
            </button>
          ) : null}
        </>
      )}
      {emailModalOpen && isCrewDayEmailRole(role) ? <CrewDayEmailModal onClose={() => setEmailModalOpen(false)} /> : null}
    </div>
  )
}
