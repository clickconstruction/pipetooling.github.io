/**
 * Residential R5's push: Settings → Phone and texts → **Reply push**, for the owner and a dev. The switch for the minute
 * sweep that pushes a customer's, a lead's or a sub's reply to whoever has the conversation (`app_settings`'s
 * `REPLY_PUSH_ON_KEY`, through `replyPushSwitchIo.ts`), turned on after a confirm since every reply after it reaches a
 * phone, and what that means in words (`replyPushStateWords`). It is how the owner turns the push on after the live test.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { REPLY_PUSH_CONFIRM, REPLY_PUSH_OFF_TOAST, REPLY_PUSH_ON_TOAST, REPLY_PUSH_TITLE, REPLY_PUSH_WHAT, replyPushStateWords } from '../../lib/messages/replyPushSwitch'
import { supabaseReplyPushSwitchIo, type ReplyPushSwitchIo } from '../../lib/messages/replyPushSwitchIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseReplyPushSwitchIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }

export function ReplyPushSettingsCard({ io = DEFAULT_IO }: { io?: ReplyPushSwitchIo }) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const [on, setOn] = useState<boolean | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (live) setOn(r.on)
      },
      (e: unknown) => {
        if (live) setProblem(formatErrorMessage(e))
      },
    )
    return () => {
      live = false
    }
  }, [io])

  const flip = async () => {
    if (on === null) return
    const next = !on
    // Turning it on starts pushing people's phones, so it asks first. Turning it off does not.
    if (next && !(await confirm({ ...REPLY_PUSH_CONFIRM, cancelIsSafe: true }))) return
    setSaving(true)
    setProblem(null)
    try {
      await io.setOn(next)
      setOn(next)
      showToast(next ? REPLY_PUSH_ON_TOAST : REPLY_PUSH_OFF_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="phone-texts-reply-push" data-settings-reply-push style={cardStyle}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 id="phone-texts-reply-push" style={{ margin: 0, fontSize: '1rem' }}>
          {REPLY_PUSH_TITLE}
        </h3>
        {on !== null && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={REPLY_PUSH_TITLE}
            onClick={() => void flip()}
            disabled={saving}
            style={{
              border: '1px solid var(--border-strong)',
              borderRadius: 999,
              padding: '0.15rem 0.7rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              background: on ? '#16a34a' : 'var(--surface)',
              color: on ? 'white' : 'var(--text-base)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : on ? 'On' : 'Off'}
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{REPLY_PUSH_WHAT}</p>
      {on !== null ? (
        <p data-reply-push-state style={muted}>
          {replyPushStateWords(on)}
        </p>
      ) : (
        !problem && <p style={muted}>Loading the switch…</p>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
