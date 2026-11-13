import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { JOB_HOURS_DAYS_SHOWN, hoursWords, jobHoursLead, type JobHours } from '../../lib/bridge/jobHours'

/**
 * The hours behind one job (punch list #334, PR 10; `jobHours.ts` has the owner's words): a line for each person, then
 * every day worked, newest first. It changes nothing. *Set the percent* at its foot opens the app's own percent
 * window, since the hours are what a percent is judged from.
 */

const cell: CSSProperties = { padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '0.86rem', fontVariantNumeric: 'tabular-nums' }
const head: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const num: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' }

export function BridgeJobHoursWindow({ jobLabel, hours, dayLabel, onClose, onSetPct, jobHref }: { jobLabel: string; hours: JobHours; dayLabel: (ymd: string) => string; onClose: () => void; onSetPct?: () => void; jobHref?: string | null }) {
  const [allDays, setAllDays] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const days = allDays ? hours.days : hours.days.slice(0, JOB_HOURS_DAYS_SHOWN)
  const anyWaiting = hours.waitingHours > 0
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 770, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} data-testid="bridge-job-hours-backdrop">
      <div role="dialog" aria-modal="true" aria-label={`Hours on ${jobLabel}`} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto', padding: '1rem 1.1rem 1.1rem' }} data-testid="bridge-job-hours">
        <div style={head}>Hours on this job</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3, margin: '4px 0 6px' }}>{jobLabel}</div>
        <div style={{ display: 'grid', gap: 2, fontSize: '0.86rem', color: 'var(--text-700)' }} data-testid="bridge-job-hours-lead">
          {jobHoursLead(hours, dayLabel).map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>

        {hours.people.length > 0 && (
          <div style={{ marginTop: 12 }} data-testid="bridge-job-hours-people">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', columnGap: 14, alignItems: 'baseline' }}>
              <div style={head}>Who</div>
              <div style={{ ...head, ...num }}>Hours</div>
              <div style={{ ...head, ...num }}>Days</div>
              <div style={{ ...head, ...num }}>Last day</div>
              {hours.people.map((p) => (
                <div key={p.userId} style={{ display: 'contents' }} data-testid="bridge-job-hours-person">
                  <div style={{ ...cell, fontWeight: 600, minWidth: 0 }}>{p.name}</div>
                  <div style={{ ...cell, ...num }}>
                    {hoursWords(p.hours).replace(/ hours?$/, '')}
                    {p.waitingHours > 0 && <span style={{ color: 'var(--text-amber-800)' }}> +{hoursWords(p.waitingHours).replace(/ hours?$/, '')}*</span>}
                  </div>
                  <div style={{ ...cell, ...num }}>{p.days}</div>
                  <div style={{ ...cell, ...num }}>{dayLabel(p.lastYmd)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hours.days.length > 0 && (
          <div style={{ marginTop: 14 }} data-testid="bridge-job-hours-days">
            <div style={head}>Day by day, newest first</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', columnGap: 14, alignItems: 'baseline', marginTop: 2 }}>
              {days.map((d) => (
                <div key={`${d.ymd}|${d.userId}|${d.waiting ? 'w' : 'a'}`} style={{ display: 'contents' }} data-testid="bridge-job-hours-day">
                  <div style={{ ...cell, whiteSpace: 'nowrap', color: 'var(--text-700)' }}>{dayLabel(d.ymd)}</div>
                  <div style={{ ...cell, minWidth: 0 }}>{d.name}</div>
                  <div style={{ ...cell, ...num, color: d.waiting ? 'var(--text-amber-800)' : undefined }}>
                    {hoursWords(d.hours)}
                    {d.waiting ? '*' : ''}
                  </div>
                </div>
              ))}
            </div>
            {hours.days.length > JOB_HOURS_DAYS_SHOWN && (
              <button type="button" onClick={() => setAllDays((a) => !a)} data-testid="bridge-job-hours-all" style={{ font: 'inherit', fontSize: '0.82rem', minHeight: 36, padding: 0, marginTop: 4, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}>
                {allDays ? `Show the newest ${JOB_HOURS_DAYS_SHOWN}` : `Show all ${hours.days.length}`}
              </button>
            )}
          </div>
        )}
        {anyWaiting && <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', marginTop: 8 }}>* Still waiting on approval.</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          {jobHref && (
            <Link to={jobHref} style={{ marginRight: 'auto', fontSize: '0.86rem', color: 'var(--text-link)' }}>
              Open the job ›
            </Link>
          )}
          <button type="button" onClick={onClose} style={{ font: 'inherit', fontSize: '0.86rem', fontWeight: 600, minHeight: 40, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
            Close
          </button>
          {onSetPct && (
            <button type="button" onClick={onSetPct} data-testid="bridge-job-hours-set-pct" style={{ font: 'inherit', fontSize: '0.86rem', fontWeight: 700, minHeight: 40, padding: '0 0.9rem', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: 'white', cursor: 'pointer' }}>
              Set the percent
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
