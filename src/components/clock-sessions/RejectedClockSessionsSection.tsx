import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { restoreRejectedClockSessions } from '../../lib/restoreRejectedClockSessions'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { ClockSessionRow } from '../../types/clockSessions'
import { ClockSessionsSection } from './ClockSessionsSection'

const btnSm = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.8125rem',
  borderRadius: 4,
  cursor: 'pointer' as const,
}

type Props = {
  sessions: ClockSessionRow[]
  title?: string
  onDeleted: () => void
  onError?: (message: string) => void
  /** When both set, section open state is controlled (e.g. People deep link). */
  open?: boolean
  onToggle?: () => void
  /** Open the same edit modal as Pending sessions (People Hours). */
  onEdit?: (session: ClockSessionRow) => void
}

export function RejectedClockSessionsSection({
  sessions,
  title = 'Rejected Sessions',
  onDeleted,
  onError,
  open,
  onToggle,
  onEdit,
}: Props) {
  const { showToast } = useToastContext()

  return (
    <ClockSessionsSection
      title={title}
      sessions={sessions}
      collapsedByDefault={open === undefined && onToggle === undefined}
      open={open}
      onToggle={onToggle}
      showActionsColumn
      renderActions={(s) => (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Return this session to Pending? You can edit and approve it there.')) return
              try {
                const rows = await restoreRejectedClockSessions([s.id])
                const row = rows[0]
                if (row?.error_message) {
                  onError?.(row.error_message)
                  return
                }
                showToast?.(`Returned ${row?.restored_count ?? 0} session(s) to Pending`, 'success')
                onDeleted()
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to restore session'
                onError?.(msg)
              }
            }}
            style={{
              ...btnSm,
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#374151',
            }}
          >
            Return to pending
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(s)}
              style={{
                ...btnSm,
                border: '1px solid #d1d5db',
                background: 'white',
                color: '#374151',
              }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Delete this clock session permanently?')) return
              try {
                await withSupabaseRetry(
                  async () => supabase.from('clock_sessions').delete().eq('id', s.id),
                  'delete rejected clock session',
                )
                showToast?.('Session deleted', 'success')
                onDeleted()
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to delete session'
                onError?.(msg)
              }
            }}
            style={{
              ...btnSm,
              border: '1px solid #dc2626',
              background: '#fef2f2',
              color: '#dc2626',
            }}
          >
            Delete
          </button>
        </div>
      )}
    />
  )
}
