/**
 * Settings → Phone and texts → **Reminders the app offers** (v2.5720), for the owner and a dev, last on the page: every
 * step whose reminder the app can text, across the flows as saved (`remindersCardIo.ts`), each with Settings → Flows'
 * own control **The app and this reminder**, Off, Offers or Sends, and the text the morning run would send under it.
 * The switch is the Flows tab's (`useAppSends` over `flows/appSendsIo.ts`), so a press here is a press there; the
 * words are `remindersCard.ts`'s. Everyone else on the page sees nothing, since only the owner and a dev may change it.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useAppSends } from '../../hooks/useAppSends'
import type { UserRole } from '../../hooks/useAuth'
import { APP_SEND_MODE_WORDS, APP_SEND_MODES, type AppSendMode } from '../../lib/flows/appSends'
import type { AppSendsIo } from '../../lib/flows/appSendsIo'
import { isOwnerOrDev } from '../../lib/gc/access'
import { REMINDER_LEGEND, REMINDERS_CARD_WORDS, reminderControlLabel, reminderRows, rowsByFlow, type ReminderFlows, type ReminderRow } from '../../lib/messages/remindersCard'
import { loadReminderFlows } from '../../lib/messages/remindersCardIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { flowNote, flowSwitch } from './flows/flowStyles'

const W = REMINDERS_CARD_WORDS

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const small: CSSProperties = { ...flowNote, fontSize: '0.8rem' }

export interface RemindersSettingsCardProps {
  role: UserRole | null | undefined
  /** The Flows tab's io for the switch, the newest run and the quick replies. A test hands in a fake. */
  io?: AppSendsIo
  /** The flows the card lists. A test hands in a fake. */
  loadFlows?: () => Promise<ReminderFlows>
}

/** The card, for the owner and a dev; nothing for anyone else, so the page makes no read for them. */
export function RemindersSettingsCard({ role, io, loadFlows }: RemindersSettingsCardProps) {
  if (!isOwnerOrDev(role)) return null
  return <RemindersCardBody io={io} loadFlows={loadFlows ?? loadReminderFlows} />
}

function RemindersCardBody({ io, loadFlows }: { io?: AppSendsIo; loadFlows: () => Promise<ReminderFlows> }) {
  const { showToast } = useToastContext()
  const appSends = useAppSends(io)
  const [flows, setFlows] = useState<ReminderFlows | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadFlows().then(
      (f) => {
        if (live) setFlows(f)
      },
      (e: unknown) => {
        if (live) setProblem(formatErrorMessage(e))
      },
    )
    return () => {
      live = false
    }
  }, [loadFlows])

  const rows = flows && appSends.read ? reminderRows(flows, appSends.read.sends, appSends.read.quickReplies) : null
  const groups = rows ? rowsByFlow(rows) : []
  const reading = !rows && !problem && !appSends.problem

  const press = async (row: ReminderRow, mode: AppSendMode) => {
    if (row.mode === mode) return
    const done = await appSends.set(row.kind, row.step, mode)
    showToast(done.words, done.ok ? 'success' : 'error')
  }

  return (
    <section aria-labelledby="phone-texts-reminders" id="settings-phone-texts-reminders" data-settings-reminders style={cardStyle}>
      <h3 id="phone-texts-reminders" style={{ margin: 0, fontSize: '1rem' }}>
        {W.title}
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{W.note}</p>
      <ul aria-label={W.legend} style={{ ...muted, paddingLeft: '1.1rem', display: 'grid', gap: '0.15rem' }}>
        {REMINDER_LEGEND.map((l) => (
          <li key={l.mode}>
            <strong style={{ color: 'var(--text-base)' }}>{l.word}</strong> {l.hint}
          </li>
        ))}
      </ul>
      {reading && <p style={muted}>{W.loading}</p>}
      {rows && rows.length === 0 && <p style={{ margin: 0, fontSize: '0.9rem' }}>{W.none}</p>}
      {groups.map((g) => (
        <div key={g.kind} data-reminder-flow={g.kind} style={{ display: 'grid', gap: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{g.flowName}</h4>
          {g.rows.map((row) => {
            const busy = appSends.busy === `${row.kind}:${row.step.id}`
            return (
              <div key={row.step.id} data-reminder-step={`${row.kind}:${row.step.id}`} style={{ display: 'grid', gap: '0.2rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{row.step.name}</span>
                <span role="radiogroup" aria-label={reminderControlLabel(row)} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {APP_SEND_MODES.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={row.mode === m} disabled={busy} onClick={() => void press(row, m)} style={flowSwitch(row.mode === m, busy)}>
                      {APP_SEND_MODE_WORDS[m]}
                    </button>
                  ))}
                  {busy && <span style={small}>{W.saving}</span>}
                </span>
                <span data-reminder-sample style={small}>
                  “{row.sample}”
                </span>
              </div>
            )
          })}
        </div>
      ))}
      <p style={muted}>
        <Link to="/settings?tab=settings-flows" style={{ color: 'var(--text-link)' }}>
          {W.flowsDoor}
        </Link>
      </p>
      {(problem || appSends.problem) && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem ?? appSends.problem}
        </div>
      )}
    </section>
  )
}
