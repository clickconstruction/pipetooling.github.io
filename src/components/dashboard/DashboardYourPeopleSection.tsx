import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useDashboardYourPeople } from '../../hooks/useDashboardYourPeople'
import { reminderBody, type YourPersonRow } from '../../lib/dashboardYourPeople'
import { DashboardGroupCard } from './DashboardGroupCard'
import { TaskRing } from '../checklist/TaskRing'
import { PeopleWeekSheet } from '../checklist/PeopleWeekSheet'

/**
 * Your people (punch list #273, PR 3c): the office's morning read of the people's open one-off cards, under My Inbox.
 * One row per person: their newest-moved card with its ring, *moved today* / *moved Wed* / *stuck 32 days* (Review's
 * own age rule, so the two never disagree), and 🔔 Remind through the same function Review's board uses. The row's
 * tap and **Open Review** land on Checklist → Review, Outstanding by person. Draws nothing while nobody has an open
 * card. **✉ Get this every Monday** joins the card with the people's week email (PR 5).
 */
export function DashboardYourPeopleSection({ authUserId, enabled, onVisibleChange }: { authUserId: string | null; enabled: boolean; onVisibleChange?: (visible: boolean) => void }) {
  const { rows, headline, loading, error, titlesFor } = useDashboardYourPeople(authUserId, enabled)
  const { showToast } = useToastContext()
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [weekOpen, setWeekOpen] = useState(false)
  const visible = enabled && (loading || rows.length > 0)
  useEffect(() => {
    onVisibleChange?.(visible)
  }, [visible, onVisibleChange])
  if (!visible) return null

  async function remind(row: YourPersonRow) {
    if (remindingId) return
    setRemindingId(row.userId)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('send-checklist-notification', {
        body: { recipient_user_id: row.userId, push_title: 'Task reminder', push_body: reminderBody(titlesFor(row.userId)), push_url: '/checklist', tag: 'task-reminder' },
      })
      if (fnError) throw fnError
      const sent = (data as { push_sent?: number } | null)?.push_sent ?? 0
      if (sent > 0) showToast(`Reminded ${row.name} on ${sent} device${sent === 1 ? '' : 's'}.`, 'success')
      else showToast(`${row.name} has no notification-enabled devices — the reminder had nowhere to land. A text or call is the sure path.`, 'error')
    } catch {
      showToast(`Couldn't send the reminder to ${row.name} — try again.`, 'error')
    } finally {
      setRemindingId(null)
    }
  }

  const chip = (row: YourPersonRow) => {
    const style =
      row.state === 'moved_today'
        ? { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }
        : row.state === 'moved_week'
          ? { background: 'var(--bg-muted)', color: 'var(--text-700)' }
          : row.state === 'stuck'
            ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
            : { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
    return <span style={{ ...style, fontSize: '0.75rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{row.words}</span>
  }

  return (
    <DashboardGroupCard
      id="dash-your-people"
      title="Your people"
      headerRight={
        <span style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setWeekOpen(true)}
            style={{ fontSize: '0.8rem', fontWeight: 600, padding: '3px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
          >
            ✉ Get this every Monday
          </button>
          <Link to="/checklist?tab=review" style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
            Open Review →
          </Link>
        </span>
      }
    >
      <PeopleWeekSheet open={weekOpen} onClose={() => setWeekOpen(false)} meId={authUserId} canPickOthers suggested={rows.map((r) => r.userId)} />
      {headline ? <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }} data-testid="your-people-headline">{headline}</div> : null}
      {error ? <div style={{ fontSize: '0.875rem', color: 'var(--text-red-700)', marginBottom: '0.5rem' }}>{error}</div> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {rows.map((row) => (
          <li key={row.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', border: '1px solid var(--border)', borderRadius: 10, padding: '0.45rem 0.6rem' }} data-testid="your-people-row">
            {row.card ? <TaskRing state={row.card.ring} size={36} title={row.card.title} /> : <span style={{ width: 36, height: 36, flexShrink: 0 }} aria-hidden="true" />}
            <Link to="/checklist?tab=review" style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                {row.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {row.openCount} open</span>
              </div>
              {row.card ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.card.title}
                  {!row.card.ring.untouched ? ` · ${row.card.ring.percent}%` : ''}
                </div>
              ) : null}
            </Link>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {chip(row)}
              <button
                type="button"
                onClick={() => void remind(row)}
                disabled={remindingId !== null}
                aria-label={`Remind ${row.name}`}
                style={{ fontSize: '0.78rem', fontWeight: 600, padding: '4px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: remindingId ? 'not-allowed' : 'pointer' }}
              >
                {remindingId === row.userId ? '…' : '🔔 Remind'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </DashboardGroupCard>
  )
}
