import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { useWaitingOnLeader } from '../../hooks/useWaitingOnLeader'
import { WAITING_ON_LEADER_WORDS, type WaitingOnLeaderCard, type WaitingOnLeaderRow, type WaitingOnLeaderRowKey } from '../../lib/dashboard/waitingOnLeader'
import type { WaitingOnLeaderDesk } from '../../lib/dashboard/waitingOnLeaderLien'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { lienReminderOutcome, lienReminderWords } from '../../lib/jobs/lienLeaderReminder'
import { sendLienReminder } from '../../lib/jobs/lienReminderRun'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import { DashboardCardHead, DashboardCardTitle } from './DashboardCardTitle'

/**
 * The office's Waiting on card (punch list #365, PR 2): on an assistant's Dashboard, under Needs you, the lines
 * that wait on the leader alone. They are the lines his own short Dashboard lists, so the office sees what he
 * sees and can chase it. A lien row has **Remind**, the Lien desk's own press: his phone buzzes, or the words go
 * by email. A waiver, a tagged note and the line budgets have no message yet, and the row says so. When a notice
 * waits on his signature, one wide press opens the desk's Ready pile, where a notice takes his signing code.
 *
 * `WaitingOnLeaderBody` takes everything as props, so a test and a look can mount it with sample rows.
 * `DashboardWaitingOnLeaderCard` is the page's part: the reads, the confirm window, the send and the toast.
 */

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '1rem', boxSizing: 'border-box' }
const PILL: CSSProperties = { marginLeft: 'auto', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 999, padding: '1px 9px', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: 0 }
const ROW: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 12px', alignItems: 'center', padding: '0.65rem 0', borderTop: '1px solid var(--border)' }
const TITLE: CSSProperties = { fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)', minWidth: 0 }
const DETAIL: CSSProperties = { gridColumn: '1 / -1', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const GHOST: CSSProperties = { font: 'inherit', minHeight: 44, minWidth: 84, padding: '0 14px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-link)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const DEAD: CSSProperties = { ...GHOST, border: '1px solid transparent', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const LINK: CSSProperties = { font: 'inherit', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }

export type WaitingOnLeaderBodyProps = {
  card: WaitingOnLeaderCard
  /** What could not be read, each as the start of a sentence: *The lien waivers*. */
  notRead: ReadonlyArray<string>
  /** The row whose reminder is going out now. */
  reminding: WaitingOnLeaderRowKey | null
  /** When this visit last reminded him of a row: the press then reads that, and is dead. */
  reminded: Partial<Record<WaitingOnLeaderRowKey, string>>
  onRemind: (row: WaitingOnLeaderRow) => void
  onOpen: (href: string, what: string) => void
}

export function WaitingOnLeaderBody({ card, notRead, reminding, reminded, onRemind, onOpen }: WaitingOnLeaderBodyProps) {
  const w = WAITING_ON_LEADER_WORDS
  const who = card.leaderName?.trim().split(/\s+/)[0] ?? ''
  return (
    <section aria-label={card.title} data-waiting-on-leader style={CARD}>
      <DashboardCardHead card={{ top: '0.9rem', side: '1rem', radius: 12 }} below="0.4rem" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <DashboardCardTitle>{card.title}</DashboardCardTitle>
        <span data-waiting-on-leader-count style={PILL}>
          {card.count}
        </span>
      </DashboardCardHead>
      {card.rows.map((row, i) => {
        const words = row.remind ? lienReminderWords(row.remind, card.leaderName, reminded[row.key] ?? null) : null
        const busy = reminding === row.key
        const dead = words ? words.dead || reminding != null : false
        return (
          <div key={row.key} data-waiting-row={row.key} style={{ ...ROW, ...(i === 0 ? { borderTop: 'none' } : null) }}>
            <span style={TITLE}>{row.title}</span>
            {words ? (
              <button type="button" data-waiting-remind={row.key} disabled={dead} aria-label={words.button} title={words.button} onClick={() => onRemind(row)} style={dead ? DEAD : GHOST}>
                {busy ? 'Reminding…' : reminded[row.key] ? `Reminded ${reminded[row.key]}` : w.remind}
              </button>
            ) : row.open ? (
              <button type="button" data-waiting-open={row.key} onClick={() => onOpen(row.open!.href, row.key)} style={GHOST}>
                {row.open.label}
              </button>
            ) : (
              <span />
            )}
            <span style={DETAIL}>
              {row.detail}
              {words && row.open ? (
                <>
                  {' '}
                  <button type="button" data-waiting-open={row.key} onClick={() => onOpen(row.open!.href, row.key)} style={LINK}>
                    {row.open.label} ›
                  </button>
                </>
              ) : null}
              {!words ? ` ${w.noReminder(who)}` : null}
            </span>
          </div>
        )
      })}
      {card.code ? (
        <button
          type="button"
          data-waiting-code
          onClick={() => onOpen(card.code!.href, 'code')}
          style={{ display: 'block', width: '100%', minHeight: 48, marginTop: '0.5rem', padding: '0 1rem', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', font: 'inherit', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}
        >
          {card.code.label}
        </button>
      ) : null}
      {notRead.map((what) => (
        <p key={what} role="alert" data-waiting-not-read style={{ margin: '0.6rem 0 0', padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text)', fontSize: '0.8125rem' }}>
          {w.notRead(what)}
        </p>
      ))}
    </section>
  )
}

export default function DashboardWaitingOnLeaderCard({ authUserId, role, enabled, desk, deskReading }: { authUserId: string | null | undefined; role: UserRole | null; enabled: boolean; desk: WaitingOnLeaderDesk | null | undefined; deskReading: boolean }) {
  const navigate = useNavigate()
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const { card, notRead } = useWaitingOnLeader(enabled, desk, deskReading)
  const [reminding, setReminding] = useState<WaitingOnLeaderRowKey | null>(null)
  const [reminded, setReminded] = useState<Partial<Record<WaitingOnLeaderRowKey, string>>>({})

  // A read that failed is said even when no row arrived: an empty card must not pass for *nothing waits*.
  if (!enabled || (!card && notRead.length === 0)) return null
  const shown: WaitingOnLeaderCard = card ?? { leaderName: null, title: WAITING_ON_LEADER_WORDS.title(''), count: 0, rows: [], code: null }

  const remind = async (row: WaitingOnLeaderRow) => {
    if (!row.remind || reminding) return
    const words = lienReminderWords(row.remind, shown.leaderName, reminded[row.key] ?? null)
    if (words.dead) return
    recordNavClick(authUserId, role, 'waiting-on-leader', `#remind-${row.key}`)
    if (!(await confirmDialog({ title: words.title, message: words.message, confirmLabel: words.confirmLabel }))) return
    setReminding(row.key)
    try {
      const sent = await sendLienReminder(row.remind)
      const said = lienReminderOutcome(sent, shown.leaderName, sent.text)
      showToast(said.line, said.tone)
      if (sent.done > 0) setReminded((r) => ({ ...r, [row.key]: formatDenverTimeOnly(Date.now()) }))
    } finally {
      setReminding(null)
    }
  }

  return (
    <WaitingOnLeaderBody
      card={shown}
      notRead={notRead}
      reminding={reminding}
      reminded={reminded}
      onRemind={(row) => void remind(row)}
      onOpen={(href, what) => {
        recordNavClick(authUserId, role, 'waiting-on-leader', `#open-${what}`)
        navigate(href)
      }}
    />
  )
}
