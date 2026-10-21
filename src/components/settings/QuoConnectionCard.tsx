/**
 * Settings → Phone and texts → **Quo connection** (v2.5718, the owner's ask of 2026-10-21: no terminal in setup), above
 * Company phone seats and written like it. The owner or a dev pastes Quo's API key here; `quo-config` keeps it in
 * Vault, and the card shows only its last four characters, when it was saved and by whom. With a key saved the card
 * reads Quo's numbers and people once, and the two cards under it pick from those lists (`QuoConnectionProvider`).
 * The words and the states are `quo/connection.ts`'s. Nobody else sees the card.
 */
import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { canSetAssignSeats } from '../../lib/messages/assignRule'
import {
  directoryWords,
  maskedKeyWords,
  NO_QUO_KEY,
  QUO_CONNECTION_INTRO,
  QUO_CONNECTION_TITLE,
  QUO_CONNECTION_WHERE,
  QUO_KEY_LABEL,
  QUO_KEY_SAVE,
  QUO_KEY_SAVED_TOAST,
  QUO_READ_AGAIN,
  quoKeyProblem,
  savedWords,
} from '../../lib/quo/connection'
import { formatErrorMessage } from '../../utils/errorHandling'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'
import { useQuoConnection } from './QuoConnectionContext'

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }

export function QuoConnectionCard({ nowIso }: { nowIso?: string }) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const quo = useQuoConnection()
  const [key, setKey] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  if (!canSetAssignSeats(role)) return null

  const now = nowIso ?? new Date().toISOString()
  const status = quo.status ?? NO_QUO_KEY
  const saved = savedWords(status, now)
  // The key's line: what the function said of it; while it has not answered, that the card is reading, or that it could not.
  const keyLine = quo.status ? `${maskedKeyWords(status)}${saved ? ` ${saved}` : ''}` : quo.state === 'read-failed' ? 'The key was not read.' : 'Reading the connection…'

  const save = async () => {
    const stop = quoKeyProblem(key)
    if (stop) {
      setProblem(stop)
      return
    }
    setProblem(null)
    try {
      await quo.saveKey(key)
      setKey('')
      showToast(QUO_KEY_SAVED_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    }
  }

  const quoLine = (() => {
    switch (quo.state) {
      case 'ready':
        return quo.directory ? directoryWords(quo.directory) : null
      case 'read-failed':
        return quo.problem
      case 'loading':
        return quo.status?.set ? 'Asking Quo…' : null
      default:
        return null
    }
  })()

  return (
    <section aria-labelledby="phone-texts-quo" id="settings-phone-texts-quo" data-settings-quo-connection style={cardStyle}>
      <h3 id="phone-texts-quo" style={{ margin: 0, fontSize: '1rem' }}>
        {QUO_CONNECTION_TITLE}
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{QUO_CONNECTION_INTRO}</p>
      <p style={muted}>{QUO_CONNECTION_WHERE}</p>
      <p data-quo-key-status style={{ margin: 0, fontSize: '0.9rem' }}>
        {keyLine}
      </p>
      <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 420 }}>
        <span>{QUO_KEY_LABEL}</span>
        <input
          type="password"
          autoComplete="off"
          value={key}
          placeholder={status.set ? 'Paste a new key to replace it' : 'Paste the key'}
          disabled={quo.saving}
          onChange={(e) => {
            setKey(e.target.value)
            setProblem(null)
          }}
          style={{ ...clauseInputStyle, width: '100%' }}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void save()} disabled={quo.saving || !key.trim()} style={key.trim() && !quo.saving ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }}>
          {quo.saving ? 'Saving…' : QUO_KEY_SAVE}
        </button>
        {quo.state === 'read-failed' && (
          <button type="button" onClick={() => void quo.readAgain()} style={clauseButtonStyle}>
            {QUO_READ_AGAIN}
          </button>
        )}
      </div>
      {quoLine && (
        <p data-quo-line style={quo.state === 'read-failed' ? { ...muted, color: 'var(--text-red-700)' } : muted}>
          {quoLine}
        </p>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
