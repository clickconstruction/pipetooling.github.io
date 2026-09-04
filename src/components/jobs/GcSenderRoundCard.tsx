import { useEffect, useState } from 'react'
import { formatMinutes, parseHhMm } from '../../lib/emailSchedule/emailScheduleWeek'
import { formatWeekdays } from '../../lib/gcStatementStandingCopies'
import { latestGcStatementMarkBy } from '../../lib/gcStatementRoundIo'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { sendChannelLabel, senderRoundQueue, type RoundMarkRow, type StatementRoundItem } from '../../lib/jobs/gcStatementRounds'
import type { StatementRoundChainGroup } from '../../lib/statementRoundEmail'

/**
 * The sender card (v2.2792): what one sender's statement round looks like
 * from THEIR seat — the queue in Start-round order with each GC's state, how
 * they are being prompted (Dashboard row, round email, last activity), and
 * the manager's moves (preview their email, set up / edit their email, assign
 * elsewhere, undo a mark). Read-only on purpose: nothing here marks a GC sent
 * as someone else. Opens from any rounds-panel chip and the per-sender tally.
 */
export default function GcSenderRoundCard({
  sender,
  items,
  chain,
  heldReason,
  highlightGcId,
  busy,
  canAct,
  onClose,
  onPreviewEmail,
  onSetupEmail,
  onAssign,
  onUndoMark,
}: {
  sender: { id: string; name: string }
  items: readonly StatementRoundItem[]
  /** the sender's round-email chains, if subscribed */
  chain: StatementRoundChainGroup | null
  /** why a held GC is held: 'uncertified' | 'changed' (the parent knows the cert status) */
  heldReason: (gcId: string) => 'uncertified' | 'changed' | null
  highlightGcId: string | null
  busy: boolean
  canAct: boolean
  onClose: () => void
  onPreviewEmail: () => void
  onSetupEmail: () => void
  onAssign: (gcId: string) => void
  onUndoMark: (gcId: string) => void
}) {
  const { queue, sent, assigned } = senderRoundQueue(items, sender.id)
  const ready = queue.filter((it) => it.state === 'ready')
  const [lastMark, setLastMark] = useState<RoundMarkRow | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void latestGcStatementMarkBy(sender.id).then((m) => {
      if (!cancelled) setLastMark(m)
    })
    return () => {
      cancelled = true
    }
  }, [sender.id])
  const possessive = `${sender.name}’s`
  const stateLabel = (it: StatementRoundItem): { text: string; color: string; dot: string } => {
    if (it.state === 'ready') return { text: 'ready', color: 'var(--text-blue-700)', dot: '#3b82f6' }
    if (it.state === 'sent') {
      const when = it.mark ? new Date(it.mark.acted_at).toLocaleDateString('en-US', { weekday: 'short' }) : ''
      return { text: `sent ${when} · ${sendChannelLabel(it.mark?.channel).toLowerCase()}`, color: 'var(--text-green-800)', dot: '#16a34a' }
    }
    if (it.state === 'skipped') return { text: 'skipped this week', color: 'var(--text-muted)', dot: 'var(--border-400)' }
    if (it.state === 'needs_sender') return { text: 'needs a sender', color: 'var(--text-red-600)', dot: '#dc2626' }
    const why = heldReason(it.gcId)
    return { text: why === 'changed' ? 'held · changed since certified' : 'held · not certified yet', color: 'var(--text-amber-800)', dot: '#f59e0b' }
  }
  const rowStyle = (it: StatementRoundItem): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.35rem 0.5rem',
    borderRadius: 6,
    fontSize: '0.8125rem',
    background: it.gcId === highlightGcId ? 'var(--bg-blue-tint)' : 'transparent',
    border: it.gcId === highlightGcId ? '1px solid var(--border-blue)' : '1px solid transparent',
  })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${possessive} round this week`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem 1.2rem', width: 'min(520px, 92vw)', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{possessive} round this week</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {sent} of {assigned} sent
          </span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '0.1rem 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>In the order {sender.name}’s Start round walks them.</p>

        {queue.length === 0 ? (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing is assigned to {sender.name} this week.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {queue.map((it) => {
              const st = stateLabel(it)
              return (
                <div key={it.gcId} style={rowStyle(it)}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: st.dot, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <b>{it.gcName}</b>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' '}· ${formatCurrency(it.amount)} · {it.jobCount} job{it.jobCount === 1 ? '' : 's'}
                      {it.group.oldestAgeDays != null ? ` · oldest ${it.group.oldestAgeDays}d` : ''}
                    </span>
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: st.color, whiteSpace: 'nowrap' }} title={it.mark?.note?.trim() ? `Note: ${it.mark.note.trim()}` : undefined}>
                    {st.text}
                    {it.mark?.note?.trim() ? ' ✎' : ''}
                  </span>
                  {canAct && it.mark ? (
                    <button type="button" disabled={busy} onClick={() => onUndoMark(it.gcId)} title="Undo this mark — the GC re-enters the round" style={{ font: 'inherit', fontSize: '0.72rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}>
                      undo
                    </button>
                  ) : null}
                  {canAct && !it.mark ? (
                    <button type="button" disabled={busy} onClick={() => onAssign(it.gcId)} title={`Move ${it.gcName} to someone else’s round`} style={{ font: 'inherit', fontSize: '0.72rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}>
                      reassign
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.8rem 0 0.3rem' }}>How {sender.name} is being prompted</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.15rem 0', color: 'var(--text-muted)', width: 110, verticalAlign: 'top' }}>Dashboard</td>
              <td style={{ padding: '0.15rem 0' }}>
                {ready.length > 0 ? (
                  <>
                    Needs you row showing <span style={{ color: 'var(--text-muted)' }}>· {ready.length} GC{ready.length === 1 ? '' : 's'} waiting</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>quiet — nothing ready to send</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.15rem 0', color: 'var(--text-muted)', verticalAlign: 'top' }}>Round email</td>
              <td style={{ padding: '0.15rem 0' }}>
                {chain ? (
                  <>
                    {formatWeekdays(chain.weekdays)} · {formatMinutes(parseHhMm(chain.timeHm) ?? 0)} · weekly
                    {canAct ? (
                      <button type="button" onClick={onSetupEmail} style={{ marginLeft: '0.4rem', font: 'inherit', fontSize: '0.72rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}>
                        edit
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>not subscribed</span>
                    {canAct ? (
                      <button type="button" onClick={onSetupEmail} style={{ marginLeft: '0.4rem', font: 'inherit', fontSize: '0.72rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}>
                        set it up for {sender.name}
                      </button>
                    ) : null}
                  </>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.15rem 0', color: 'var(--text-muted)', verticalAlign: 'top' }}>Last activity</td>
              <td style={{ padding: '0.15rem 0', color: lastMark ? 'inherit' : 'var(--text-muted)' }}>
                {lastMark === undefined
                  ? 'Loading…'
                  : lastMark
                    ? `marked a statement sent ${new Date(lastMark.acted_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${sendChannelLabel(lastMark.channel).toLowerCase()}`
                    : 'never marked a statement sent'}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.8rem', alignItems: 'center' }}>
          <button type="button" disabled={busy} onClick={onPreviewEmail} title={`The round email exactly as it would land in ${sender.name}’s inbox right now`} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}>
            Preview {sender.name}’s email
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
