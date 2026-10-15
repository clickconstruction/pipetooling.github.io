/**
 * Messages, cut 5: Settings → Phone and texts → **Send texts**, for the owner and a dev. The switch that lets the office
 * text from the company number (`app_settings.messages_texts_on_v1`, through `quo/textsSwitchIo.ts`), turned on after a
 * confirm since every text after it reaches a real phone. The send window and `quo-send` read the same row. The app's
 * answer to HELP and a stop's confirmation go either way, and the card says so.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { TEXTS_OFF_TOAST, TEXTS_ON_TOAST, TEXTS_SWITCH_ALWAYS, TEXTS_SWITCH_CONFIRM, TEXTS_SWITCH_FIRST, TEXTS_SWITCH_TITLE, TEXTS_SWITCH_WHAT } from '../../lib/quo/textsSwitch'
import { supabaseTextsSwitchIo, type TextsSwitchIo } from '../../lib/quo/textsSwitchIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseTextsSwitchIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }

export function TextsSwitchSettingsCard({ io = DEFAULT_IO }: { io?: TextsSwitchIo }) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const [on, setOn] = useState<boolean | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (live) setOn(r)
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
    // Turning texts on lets real texts go, so it asks first. Turning them off does not.
    if (next && !(await confirm({ ...TEXTS_SWITCH_CONFIRM, cancelIsSafe: true }))) return
    setSaving(true)
    setProblem(null)
    try {
      await io.setOn(next)
      setOn(next)
      showToast(next ? TEXTS_ON_TOAST : TEXTS_OFF_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="phone-texts-send-texts" data-settings-send-texts style={cardStyle}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 id="phone-texts-send-texts" style={{ margin: 0, fontSize: '1rem' }}>
          {TEXTS_SWITCH_TITLE}
        </h3>
        {on !== null && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={TEXTS_SWITCH_TITLE}
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
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{TEXTS_SWITCH_WHAT}</p>
      <p data-send-texts-first style={muted}>
        {TEXTS_SWITCH_FIRST}
      </p>
      {on === null && !problem ? <p style={muted}>Loading the switch…</p> : <p style={muted}>{TEXTS_SWITCH_ALWAYS}</p>}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
