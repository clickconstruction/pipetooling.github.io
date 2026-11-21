import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { readPaperRemindersSwitch, writePaperRemindersSwitch } from '../../lib/contracts/personPaperReminderIo'
import { PERSON_PAPER_MAX_REMINDERS, PERSON_PAPER_REMINDER_DAYS } from '../../../supabase/functions/_shared/personPaperReminder'

/**
 * Settings → People & teams → Paper reminders by email (punch list #376): the one switch for all. It ships off. While
 * it is off no staff or sub paper is reminded, and a paper sent while it is off is never reminded, so turning it on
 * reaches no paper already out. The owner and a dev change it: one `app_settings` row under its own policy. Turning it
 * on asks first, since the app then emails people by itself.
 */
export default function PaperRemindersSettingsBlock() {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [on, setOn] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void readPaperRemindersSwitch()
      .then((v) => {
        if (!cancelled) setOn(v)
      })
      .catch(() => {
        if (!cancelled) setOn(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function change(next: boolean) {
    if (saving) return
    if (
      next &&
      !(await confirmDialog({
        title: 'Turn reminders on',
        message: `From now on, a staff or sub paper you send by email is reminded by itself: up to ${PERSON_PAPER_MAX_REMINDERS} emails, ${PERSON_PAPER_REMINDER_DAYS} days apart, until it is signed. Papers already out are not reminded.`,
        confirmLabel: 'Turn reminders on',
      }))
    )
      return
    setSaving(true)
    try {
      await writePaperRemindersSwitch(next)
      setOn(next)
      showToast(next ? 'Reminders are on for papers sent from now on.' : 'Reminders are off. No more go out.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The switch was not saved.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const dead = on === null || saving
  return (
    <div id="settings-people-paper-reminders" style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 10, display: 'grid', gap: '0.6rem' }} data-testid="paper-reminders-settings">
      <div>
        <div style={{ fontWeight: 600, fontSize: '1rem' }}>Paper reminders by email</div>
        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 2 }}>
          A staff or sub paper that waits on a signature gets up to {PERSON_PAPER_MAX_REMINDERS} reminders by email, {PERSON_PAPER_REMINDER_DAYS} days apart. Each reminder carries a new signing link, and the link before it stops
          working. Only a paper sent after this is turned on is reminded. One paper&#8217;s reminders turn off on its line in Documents, Agreements.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem' }} data-testid="paper-reminders-state">
          Reminders are <strong>{on === null ? '…' : on ? 'on' : 'off'}</strong>.
        </span>
        <button
          type="button"
          disabled={dead}
          onClick={() => void change(!on)}
          style={{
            padding: '0.4rem 0.9rem',
            fontSize: '0.86rem',
            fontWeight: 600,
            borderRadius: 6,
            border: dead ? '1px solid var(--border)' : on ? '1px solid var(--border-strong)' : '1px solid #2563eb',
            background: dead ? DEAD_PRESS_FILL : on ? 'var(--surface)' : '#2563eb',
            color: dead ? DEAD_PRESS_TEXT : on ? 'var(--text-strong)' : 'white',
            cursor: dead ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : on ? 'Turn reminders off' : 'Turn reminders on'}
        </button>
      </div>
    </div>
  )
}
