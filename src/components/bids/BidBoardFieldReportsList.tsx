import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { reportForViewFromListReportsForBidRow, type ReportForBidListRow } from '../../lib/reportForViewFromJobLedgerRow'
import { ReportDetailBody } from '../ReportViewModal'

const fieldReportBadgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.125rem 0.35rem',
  borderRadius: 4,
  background: '#ede9fe',
  color: '#5b21b6',
}

type Props = {
  bidId: string
  onLoadError: (message: string) => void
}

export function BidBoardFieldReportsList({ bidId, onLoadError }: Props) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ReportForBidListRow[]>([])
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  useEffect(() => {
    if (!bidId) return
    setLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.rpc('list_reports_for_bid', { p_bid_id: bidId }),
          'list_reports_for_bid',
        )
        if (cancelled) return
        setRows((data as ReportForBidListRow[] | null) ?? [])
      } catch (e: unknown) {
        if (cancelled) return
        onLoadErrorRef.current(formatErrorMessage(e, 'Failed to load field reports'))
        setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId])

  if (loading) {
    return <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading field reports…</p>
  }

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No field reports for this bid yet.</p>
    )
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {[...rows].reverse().map((r, i) => {
        const view = reportForViewFromListReportsForBidRow(r)
        return (
          <li
            key={r.id}
            style={{
              padding: '0.75rem',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              background: 'var(--bg-page)',
            }}
          >
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={fieldReportBadgeStyle}>Field report</span>
              <span
                style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-700)',
                }}
              >
                {r.template_name}
              </span>
            </div>
            <ReportDetailBody report={view} />
          </li>
        )
      })}
    </ul>
  )
}
