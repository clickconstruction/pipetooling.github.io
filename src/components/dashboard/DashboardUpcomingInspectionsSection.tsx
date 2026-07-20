import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { toLocalDateString } from '../../lib/dailyGoalsGate'
import { formatUpcomingInspectionDateLine, type UpcomingInspectionRow } from '../../lib/dashboardUpcomingInspections'

export function DashboardUpcomingInspectionsSection({
  authUserId,
  role,
  inspectionsButtonVisible,
}: {
  authUserId: string | undefined
  role: string | null
  inspectionsButtonVisible: boolean
}) {
  const [upcomingInspections, setUpcomingInspections] = useState<UpcomingInspectionRow[]>([])
  const [upcomingInspectionsLoading, setUpcomingInspectionsLoading] = useState(false)

  const roleAllowed = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'

  useEffect(() => {
    const showUpcomingInspections = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
    if (!authUserId || !showUpcomingInspections) return
    setUpcomingInspectionsLoading(true)
    const today = new Date()
    const startStr = toLocalDateString(today)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 2)
    const endStr = toLocalDateString(endDate)
    supabase
      .from('inspections')
      .select('id, address, inspection_type, scheduled_date')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setUpcomingInspections([])
        } else {
          setUpcomingInspections((data as UpcomingInspectionRow[]) ?? [])
        }
        setUpcomingInspectionsLoading(false)
      })
  }, [authUserId, role])

  if (!(roleAllowed && inspectionsButtonVisible && (upcomingInspectionsLoading || upcomingInspections.length > 0))) return null

  return (
    <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Upcoming inspection (3 days)</h2>
      {upcomingInspectionsLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : upcomingInspections.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No inspections in the next 3 days.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {upcomingInspections.map((i) => {
            const formatted = formatUpcomingInspectionDateLine(i.scheduled_date, new Date())
            return (
              <li key={i.id} style={{ marginBottom: '0.5rem' }}>
                <Link
                  to="/jobs?tab=inspections"
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-blue-tint)',
                    border: '1px solid var(--border-blue)',
                    borderRadius: 4,
                    color: 'var(--text-blue-800)',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>{formatted}</span>
                    <span style={{ color: 'var(--text-600)' }}>{' - '}{i.inspection_type}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>{i.address}</span>
                    {i.address?.trim() && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openInExternalBrowser(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address.trim())}`) }}
                        title={`View ${i.address} on map`}
                        style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 16, height: 16, fill: 'currentColor' }}>
                          <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
