/**
 * Settings → Phone and texts → **Model keys** (punch list #186, v2.5916), under the Quo connection and written like it.
 * The owner or a dev pastes a language model's API key here; `model-config` keeps it in Vault, and the card shows only
 * its last four characters, when it was saved and by whom. With a key saved the report form drafts from a voice note
 * (`report-draft`); without one the words go into Notes as said. The words and the states are `models/modelKeys.ts`'s.
 * Nobody else sees the card.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { isOwnerOrDev } from '../../lib/gc/access'
import {
  MODEL_KEY_FORGET,
  MODEL_KEY_FORGOT_TOAST,
  MODEL_KEY_LABEL,
  MODEL_KEY_SAVE,
  MODEL_KEY_SAVED_TOAST,
  MODEL_KEYS_COST,
  MODEL_KEYS_INTRO,
  MODEL_KEYS_TITLE,
  MODEL_KEYS_WHERE,
  maskedModelKeyWords,
  modelKeyProblem,
  modelKeySavedWords,
  type ModelKeyStatus,
} from '../../lib/models/modelKeys'
import { supabaseModelKeysIo, type ModelKeysIo } from '../../lib/models/modelKeysIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }

const DEFAULT_IO = supabaseModelKeysIo()

export function ModelKeysSettingsCard({ io = DEFAULT_IO, nowIso }: { io?: ModelKeysIo; nowIso?: string }) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [status, setStatus] = useState<ModelKeyStatus | null>(null)
  const [readFailed, setReadFailed] = useState<string | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const canSet = isOwnerOrDev(role)

  useEffect(() => {
    if (!canSet) return
    let live = true
    io.status('anthropic')
      .then((s) => {
        if (live) setStatus(s)
      })
      .catch((e) => {
        if (live) setReadFailed(formatErrorMessage(e))
      })
    return () => {
      live = false
    }
  }, [canSet, io])

  if (!canSet) return null

  const now = nowIso ?? new Date().toISOString()
  const keyLine = status ? `${maskedModelKeyWords(status)} ${modelKeySavedWords(status, now)}`.trim() : readFailed ? 'The key was not read.' : 'Reading the keys…'

  const save = async () => {
    const stop = modelKeyProblem(key)
    if (stop) {
      setProblem(stop)
      return
    }
    setProblem(null)
    setBusy(true)
    try {
      setStatus(await io.save('anthropic', key))
      setKey('')
      showToast(MODEL_KEY_SAVED_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const forget = async () => {
    setProblem(null)
    setBusy(true)
    try {
      setStatus(await io.forget('anthropic'))
      showToast(MODEL_KEY_FORGOT_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="phone-texts-model-keys" id="settings-phone-texts-model-keys" data-settings-model-keys style={cardStyle}>
      <h3 id="phone-texts-model-keys" style={{ margin: 0, fontSize: '1rem' }}>
        {MODEL_KEYS_TITLE}
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{MODEL_KEYS_INTRO}</p>
      <p style={muted}>{MODEL_KEYS_WHERE}</p>
      <p style={muted}>{MODEL_KEYS_COST}</p>
      <p data-model-key-status style={{ margin: 0, fontSize: '0.9rem' }}>
        {keyLine}
      </p>
      <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 420 }}>
        <span>{MODEL_KEY_LABEL}</span>
        <input
          type="password"
          autoComplete="off"
          value={key}
          placeholder={status?.set ? 'Paste a new key to replace it' : 'Paste the key'}
          disabled={busy}
          onChange={(e) => {
            setKey(e.target.value)
            setProblem(null)
          }}
          style={{ ...clauseInputStyle, width: '100%' }}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void save()} disabled={busy || !key.trim()} style={key.trim() && !busy ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }}>
          {busy ? 'Saving…' : MODEL_KEY_SAVE}
        </button>
        {status?.set && status.source === 'vault' ? (
          <button type="button" onClick={() => void forget()} disabled={busy} style={clauseButtonStyle}>
            {MODEL_KEY_FORGET}
          </button>
        ) : null}
      </div>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
