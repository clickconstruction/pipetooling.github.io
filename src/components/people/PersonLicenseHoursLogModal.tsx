import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { sanitizeFilenameSegment } from '../../lib/domTableToCsv'
import {
  buildLicenseHoursCsv,
  buildLicenseHoursJobGroups,
  buildLicenseHoursSummary,
  type LicenseHoursLogRow,
} from '../../lib/licenseHoursLog'

// Certification header fields (employer / supervising licensee) are the same
// for every export from this device, so they persist in localStorage.
const HEADER_DEFAULTS_KEY = 'licenseHoursLog.headerDefaults'

type HeaderDefaults = { employerName: string; supervisingLicensee: string }

function loadHeaderDefaults(): HeaderDefaults {
  try {
    const raw = localStorage.getItem(HEADER_DEFAULTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HeaderDefaults>
      return {
        employerName: typeof parsed.employerName === 'string' ? parsed.employerName : '',
        supervisingLicensee: typeof parsed.supervisingLicensee === 'string' ? parsed.supervisingLicensee : '',
      }
    }
  } catch {
    // ignore parse/storage errors — fields just start blank
  }
  return { employerName: '', supervisingLicensee: '' }
}

export type PersonLicenseHoursLogModalProps = {
  personName: string
  /** users.id of the linked app account; null when the roster person has no account */
  userId: string | null
  onClose: () => void
}

const labelStyle = { display: 'block', marginBottom: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' } as const
const inputStyle = {
  width: '100%',
  padding: '0.4rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  boxSizing: 'border-box',
} as const
const thStyle = {
  padding: '0.5rem',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
} as const

export default function PersonLicenseHoursLogModal({ personName, userId, onClose }: PersonLicenseHoursLogModalProps) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<LicenseHoursLogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startYmd, setStartYmd] = useState('')
  const [endYmd, setEndYmd] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [{ employerName, supervisingLicensee }, setHeaderDefaults] = useState<HeaderDefaults>(loadHeaderDefaults)

  useEffect(() => {
    try {
      localStorage.setItem(HEADER_DEFAULTS_KEY, JSON.stringify({ employerName, supervisingLicensee }))
    } catch {
      // storage full/unavailable — non-fatal
    }
  }, [employerName, supervisingLicensee])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.rpc('list_user_license_hours_log', {
              p_user_id: userId,
              ...(startYmd ? { p_start: startYmd } : {}),
              ...(endYmd ? { p_end: endYmd } : {}),
            }),
          'list_user_license_hours_log',
        )
        if (!cancelled) setRows((data ?? []) as LicenseHoursLogRow[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, startYmd, endYmd])

  const groups = useMemo(() => buildLicenseHoursJobGroups(rows), [rows])
  const summary = useMemo(() => buildLicenseHoursSummary(groups), [groups])

  const handleExportCsv = useCallback(() => {
    const generatedOnYmd = new Date().toISOString().slice(0, 10)
    const csv = buildLicenseHoursCsv(
      {
        personName,
        registrationNumber,
        employerName,
        supervisingLicensee,
        generatedOnYmd,
        periodStartYmd: startYmd || null,
        periodEndYmd: endYmd || null,
      },
      groups,
      summary,
    )
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `license-hours-log_${sanitizeFilenameSegment(personName)}_${generatedOnYmd}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Hours log CSV downloaded', 'success')
  }, [personName, registrationNumber, employerName, supervisingLicensee, startYmd, endYmd, groups, summary, showToast])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(960px, 100%)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Hours log — {personName}</h2>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !userId || rows.length === 0}
            style={{
              padding: '0.4rem 0.85rem',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: loading || !userId || rows.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Export CSV
          </button>
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.85rem' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}>
          {!userId ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {personName} has no linked app account. Clock sessions are recorded per app user, so there are no hours
              to report — link this person to a user account first.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Approved clock hours grouped by job — the detail log behind an employer certification of experience
                (e.g. TSBPE / TDLR). Hours only; wages never appear here. The header fields below are printed at the
                top of the CSV.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.6rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <label style={labelStyle}>Registration / license #</label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="e.g. AP-123456"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Employer</label>
                  <input
                    type="text"
                    value={employerName}
                    onChange={(e) => setHeaderDefaults((h) => ({ ...h, employerName: e.target.value }))}
                    placeholder="Company name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Supervising licensee</label>
                  <input
                    type="text"
                    value={supervisingLicensee}
                    onChange={(e) => setHeaderDefaults((h) => ({ ...h, supervisingLicensee: e.target.value }))}
                    placeholder="Name, license #"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>From (optional)</label>
                  <input type="date" value={startYmd} onChange={(e) => setStartYmd(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>To (optional)</label>
                  <input type="date" value={endYmd} onChange={(e) => setEndYmd(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {error && <p style={{ color: 'var(--text-red-700)' }}>{error}</p>}
              {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
              ) : rows.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No approved hours in this period.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem' }}>
                    <strong>{summary.totalHours.toFixed(2)} hours</strong> · {summary.jobCount} job
                    {summary.jobCount === 1 ? '' : 's'} · {summary.sessionCount} session
                    {summary.sessionCount === 1 ? '' : 's'} · {summary.firstWorkDateYmd} – {summary.lastWorkDateYmd}
                    {summary.estimatingHours > 0 && <> · {summary.estimatingHours.toFixed(2)}h estimating</>}
                    {summary.unassignedHours > 0 && <> · {summary.unassignedHours.toFixed(2)}h unassigned</>}
                  </p>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={thStyle}>Week</th>
                          <th style={thStyle}>Job #</th>
                          <th style={thStyle}>Job</th>
                          <th style={thStyle}>Service type</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Sessions</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g) => (
                          <Fragment key={g.jobKey}>
                            <tr style={{ background: 'var(--bg-slate-tint)' }}>
                              <td style={{ padding: '0.5rem', fontWeight: 600 }} colSpan={4}>
                                {g.jobNumber && <span style={{ marginRight: '0.5rem' }}>{g.jobNumber}</span>}
                                {g.jobLabel}
                                {g.jobAddress && (
                                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                    {g.jobAddress}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                {g.sessionCount}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                {g.totalHours.toFixed(2)}
                              </td>
                            </tr>
                            {g.weeks.map((w) => (
                              <tr key={w.weekStartYmd} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.35rem 0.5rem 0.35rem 1.25rem', whiteSpace: 'nowrap' }}>
                                  {w.weekStartYmd} – {w.weekEndYmd}
                                </td>
                                <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>{g.jobNumber}</td>
                                <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>{g.jobLabel}</td>
                                <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>
                                  {g.serviceTypeName}
                                </td>
                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{w.sessionCount}</td>
                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{w.hours.toFixed(2)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
