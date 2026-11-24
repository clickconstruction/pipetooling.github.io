/**
 * Settings → Advanced: Global Reload, for a dev (v2.8527). The press that makes every other open copy of the app
 * reload at once, moved here from the gear menu, with the cases for pressing it written under it
 * (`globalReloadWords.ts`) and a window that asks first.
 */
import { useState } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useForceReload } from '../../contexts/ForceReloadContext'
import {
  GLOBAL_RELOAD_CONFIRM,
  GLOBAL_RELOAD_LEAD,
  GLOBAL_RELOAD_NOT_SENT,
  GLOBAL_RELOAD_PRESS,
  GLOBAL_RELOAD_SECTIONS,
  GLOBAL_RELOAD_SENT,
  GLOBAL_RELOAD_TITLE,
} from '../../lib/settings/globalReloadWords'

export default function GlobalReloadSettingsCard() {
  const confirmDialog = useConfirmDialog()
  const forceReload = useForceReload()
  const [said, setSaid] = useState<string | null>(null)

  async function press() {
    setSaid(null)
    if (!(await confirmDialog({ ...GLOBAL_RELOAD_CONFIRM, danger: true }))) return
    if (!forceReload) {
      setSaid(GLOBAL_RELOAD_NOT_SENT)
      return
    }
    forceReload.forceEveryoneToReload()
    setSaid(GLOBAL_RELOAD_SENT)
  }

  return (
    <div id="settings-global-reload" style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{GLOBAL_RELOAD_TITLE}</h2>
      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{GLOBAL_RELOAD_LEAD}</p>
      <button
        type="button"
        onClick={() => void press()}
        style={{
          minHeight: 44,
          padding: '0.5rem 1.25rem',
          borderRadius: '0.375rem',
          border: 'none',
          background: '#ea580c',
          color: '#ffffff',
          fontFamily: 'inherit',
          fontSize: '0.9375rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {GLOBAL_RELOAD_PRESS}
      </button>
      {said ? (
        <p role="status" style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-base)' }}>
          {said}
        </p>
      ) : null}
      {GLOBAL_RELOAD_SECTIONS.map((section) => (
        <div key={section.heading} style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-base)' }}>{section.heading}</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {section.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
