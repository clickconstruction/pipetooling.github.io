import { useCallback, useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { fetchTypedHoursMode, saveTypedHoursMode, TYPED_HOURS_MODE_CHOICES, type TypedHoursMode } from '../../lib/clock/typedHoursSwitch'

/**
 * Settings → People & teams (dev): the switch behind the typed-hours hold (v2.4263) — whoever
 * typed hours cannot approve them, and nobody approves their own. One app_settings row, read by
 * typed_hours_rule_applies(), so what this saves is what the database enforces. Turning it on
 * asks first: from that moment a person who types and approves alone has to find a second person.
 */
export default function TypedHoursSwitchBlock() {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [mode, setMode] = useState<TypedHoursMode | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setMode(await fetchTypedHoursMode())
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the typed hours setting'), 'error')
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function choose(next: TypedHoursMode) {
    if (saving || mode == null || next === mode) return
    if (next === 'on') {
      const ok = await confirmDialog({
        message:
          'Turn the rule on for everyone? From now on whoever typed hours cannot approve them, and nobody can approve their own hours — a second person who approves hours has to. Hours waiting on that show in Needs You.',
        confirmLabel: 'Turn it on',
      })
      if (!ok) return
    }
    setSaving(true)
    try {
      await saveTypedHoursMode(next)
      setMode(next)
      showToast(next === 'on' ? 'Typed hours: the rule is on for everyone' : next === 'test' ? 'Typed hours: the rule holds for test accounts only' : 'Typed hours: the rule is off', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the typed hours setting'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-labelledby="settings-typed-hours-title"
      id="settings-typed-hours"
      style={{ marginTop: '1.5rem', padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}
    >
      <div id="settings-typed-hours-title" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Typed hours: a second person approves</div>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Hours someone typed — a day the clock missed, a longer day — wear a pencil wherever hours are approved, whatever is picked here.
        This decides whether the rule holds: <strong>whoever typed the hours cannot approve them, and nobody approves their own.</strong>
      </p>
      <fieldset disabled={mode == null || saving} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <legend className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>The rule</legend>
        {TYPED_HOURS_MODE_CHOICES.map((c) => (
          <label key={c.mode} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="radio" name="typed-hours-mode" checked={mode === c.mode} onChange={() => void choose(c.mode)} style={{ marginTop: '0.2rem' }} />
            <span>
              <strong>{c.label}</strong>
              <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{c.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  )
}
