import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchTeamLaborBreakdownForJob } from '../../utils/teamLabor'
import { buildStagesCrewModel, type StagesCrewHours, type StagesCrewRow } from '../../lib/jobs/stagesCrew'
import { humanRoleLabel } from '../../lib/roleLabels'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { formatWorkDateYmdMonthDayShort, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * Everyone on the job (v2.3373): the Pipeline's crew modal. The job's team —
 * live accounts by hours, then archived accounts by hours — with hours, days
 * and last day from the crew-sheet breakdown the Costs tab counts, and a
 * second section for people with hours who are not on the team. A name opens
 * the Person desk when the viewer may open it.
 */
export function StagesCrewModal({ job, onClose }: { job: JobWithDetails; onClose: () => void }) {
  const isMobile = useIsMobile()
  const personDesk = usePersonDeskContext()
  const [hours, setHours] = useState<StagesCrewHours[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setHours(null)
    setFailed(false)
    void fetchTeamLaborBreakdownForJob(supabase, job.id)
      .then((rows) => {
        if (cancelled) return
        setHours(rows.map((r) => ({ personName: r.personName, hours: r.hours, byWorkDate: r.byWorkDate })))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [job.id])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const model = useMemo(() => buildStagesCrewModel({ members: job.team_members, hours }), [job.team_members, hours])
  const num = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  const title = `Everyone on ${(job.job_name ?? '').trim() || 'this job'}`
  const maxHours = Math.max(1, ...model.crew.map((r) => r.hours), ...model.others.map((r) => r.hours))
  const sub = hours == null && !failed ? 'loading hours…' : failed ? 'hours could not be loaded' : `${formatDecimalWorkHoursToHhMm(model.totalHours)} total · hours from the crew sheets, the same hours the Costs tab counts`
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 900, padding: isMobile ? 0 : '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          border: '1px solid var(--border)',
          borderRadius: isMobile ? '14px 14px 0 0' : 10,
          width: '100%',
          maxWidth: isMobile ? undefined : 680,
          maxHeight: isMobile ? '88vh' : '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.9rem 1rem 0.55rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-strong)' }}>{title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {num ? `J${num} · ` : ''}
              {sub}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0, fontFamily: 'inherit' }}>
            {isMobile ? '✕' : 'esc to close ✕'}
          </button>
        </div>
        <div style={{ overflow: 'auto', minHeight: 0 }}>
          {model.crew.length === 0 && model.others.length === 0 ? (
            <p style={{ margin: 0, padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nobody has been put on this job yet.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <Th>Name</Th>
                  {isMobile ? null : <Th>Role</Th>}
                  <Th>Status</Th>
                  <Th right>Hours</Th>
                  <Th right>Days</Th>
                  <Th right>Last day</Th>
                </tr>
              </thead>
              <tbody>
                {model.crew.map((r) => (
                  <CrewRow key={r.key} row={r} maxHours={maxHours} isMobile={isMobile} onOpenPerson={personDesk.canOpen ? () => personDesk.open({ userId: r.userId, payName: r.name, displayName: r.name }) : null} />
                ))}
                {model.others.length > 0 ? (
                  <>
                    <tr>
                      <td colSpan={isMobile ? 5 : 6} style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--bg-subtle)' }}>
                        Hours here, not on the crew list
                      </td>
                    </tr>
                    {model.others.map((r) => (
                      <CrewRow key={r.key} row={r} maxHours={maxHours} isMobile={isMobile} onOpenPerson={personDesk.canOpen ? () => personDesk.open({ payName: r.name, displayName: r.name }) : null} />
                    ))}
                  </>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0.55rem 1rem 0.8rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          Live accounts first, then archived, each by hours.{personDesk.canOpen ? ' A name opens the Person desk.' : ''}
        </div>
      </div>
    </div>
  )
}

function Th({ children, right = false }: { children: string; right?: boolean }) {
  return (
    <th style={{ textAlign: right ? 'right' : 'left', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.5rem 1rem 0.35rem', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )
}

const TD: CSSProperties = { padding: '0.42rem 1rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

function CrewRow({ row, maxHours, isMobile, onOpenPerson }: { row: StagesCrewRow; maxHours: number; isMobile: boolean; onOpenPerson: (() => void) | null }) {
  const gone = row.archivedAt != null
  const barW = row.hours > 0 ? Math.max(4, Math.round((row.hours / maxHours) * (isMobile ? 40 : 72))) : 0
  const muted = gone ? 'var(--text-muted)' : undefined
  return (
    <tr>
      <td style={{ ...TD, color: gone ? 'var(--text-700)' : 'var(--text-strong)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
          {barW > 0 ? <span aria-hidden style={{ display: 'inline-block', width: barW, height: 6, borderRadius: 3, background: gone ? 'var(--text-faint)' : '#2563eb', flexShrink: 0 }} /> : null}
          {onOpenPerson ? (
            <button type="button" onClick={onOpenPerson} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
              {row.name}
            </button>
          ) : (
            row.name
          )}
        </span>
      </td>
      {isMobile ? null : <td style={{ ...TD, color: muted }}>{humanRoleLabel(row.role)}</td>}
      <td style={{ ...TD, color: muted }}>
        {gone ? (
          <span style={{ fontSize: '0.72rem', borderRadius: 999, padding: '0 0.5em', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Archived {formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(row.archivedAt!))}
          </span>
        ) : row.userId ? (
          <span style={{ fontSize: '0.72rem', borderRadius: 999, padding: '0 0.5em', border: '1px solid #16a34a', color: '#15803d', whiteSpace: 'nowrap' }}>Active</span>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>not on the team</span>
        )}
      </td>
      <td style={{ ...NUM, color: muted }}>{formatDecimalWorkHoursToHhMm(row.hours)}</td>
      <td style={{ ...NUM, color: muted }}>{row.days || '—'}</td>
      <td style={{ ...NUM, color: muted }}>{row.lastDay ? formatWorkDateYmdMonthDayShort(row.lastDay) : '—'}</td>
    </tr>
  )
}
