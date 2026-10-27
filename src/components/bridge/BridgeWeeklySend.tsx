/**
 * The weekly email's switch on the Monday sheet (v2.5883): a dev turns the Monday 6 AM send on or off here, after a
 * confirm when turning it on, and reads when the sheet last went and to how many people. The words and the keys are
 * `weeklySend.ts`'s; the read and the write are `weeklySendIo.ts`'s. It ships off, so nothing mails until a dev turns
 * it on.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { WEEKLY_SEND_CONFIRM, WEEKLY_SEND_OFF_TOAST, WEEKLY_SEND_ON_TOAST, WEEKLY_SEND_TITLE, WEEKLY_SEND_WHAT, lastRunWords, weeklySendStateWords, type WeeklySendRun } from '../../lib/bridge/weeklySend'
import { supabaseWeeklySendIo, type WeeklySendIo } from '../../lib/bridge/weeklySendIo'
import { md } from '../../lib/bridge/sheetBuild'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseWeeklySendIo()

const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', display: 'grid', gap: '0.4rem' }
const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }

export function BridgeWeeklySend({ io = DEFAULT_IO }: { io?: WeeklySendIo }) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const [on, setOn] = useState<boolean | null>(null)
  const [lastRun, setLastRun] = useState<WeeklySendRun | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (!live) return
        setOn(r.on)
        setLastRun(r.lastRun)
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
    // Turning it on starts mailing every dev on Monday, so it asks first. Turning it off does not.
    if (next && !(await confirm({ ...WEEKLY_SEND_CONFIRM, cancelIsSafe: true }))) return
    setSaving(true)
    setProblem(null)
    try {
      await io.setOn(next)
      setOn(next)
      showToast(next ? WEEKLY_SEND_ON_TOAST : WEEKLY_SEND_OFF_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="bridge-weekly-send" data-testid="bridge-weekly-send" style={panel}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span id="bridge-weekly-send" style={label}>
          {WEEKLY_SEND_TITLE}
        </span>
        {on !== null && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={WEEKLY_SEND_TITLE}
            onClick={() => void flip()}
            disabled={saving}
            style={{
              border: '1px solid var(--border-strong)',
              borderRadius: 999,
              padding: '0.1rem 0.6rem',
              fontSize: '0.78rem',
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
      <p style={{ margin: 0, fontSize: '0.85rem' }}>{WEEKLY_SEND_WHAT}</p>
      {on !== null ? (
        <p data-testid="bridge-weekly-send-state" style={det}>
          {weeklySendStateWords(on)} {lastRunWords(lastRun, md)}
        </p>
      ) : (
        !problem && <p style={det}>Loading the switch…</p>
      )}
      {problem && (
        <p role="alert" style={{ ...det, color: 'var(--text-red-700)' }}>
          {problem}
        </p>
      )}
    </section>
  )
}
