/**
 * Punch list #195 PR 2 (v2.6018): Settings → Phone and texts → **Missed calls**, after Office hours, for the owner and
 * a dev. The switch **Text back a missed call** (off as it ships, turned on after a confirm since every missed call
 * then reaches a phone), the three lines the app sends (in office hours, after hours, with a voicemail), what the gates
 * are in plain words, and the last ten texts back with what went or why nothing did. The words and the draft are
 * `messages/missedReplyCard.ts`; the reads and the write are `missedReplyCardIo.ts`; the setting is the one
 * `quo-webhook` reads (`quo/missedReply.ts`). Everyone else on the page reads the lines and the list.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import {
  canSetMissedReply,
  claimLines,
  draftFrom,
  draftProblem,
  LINE_FIELD,
  LINE_KEYS,
  MISSED_LINE_MAX,
  MISSED_REPLY_WORDS,
  sameDraft,
  serializeLines,
  serializeSwitch,
  settingsAfterSave,
  type ClaimRow,
  type MissedReplyDraft,
} from '../../lib/messages/missedReplyCard'
import { supabaseMissedReplyCardIo, type MissedReplyCardIo } from '../../lib/messages/missedReplyCardIo'
import type { MissedReplySettings } from '../../lib/quo/missedReply'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'

const DEFAULT_IO = supabaseMissedReplyCardIo()
const W = MISSED_REPLY_WORDS

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const lineStyle: CSSProperties = {
  width: '100%',
  minHeight: '3.2rem',
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  fontSize: '0.9rem',
  font: 'inherit',
  resize: 'vertical',
}

/** The On/Off pill, as the Office hours and Reply push cards draw theirs. */
function switchStyle(on: boolean, saving: boolean): CSSProperties {
  return {
    border: '1px solid var(--border-strong)',
    borderRadius: 999,
    padding: '0.15rem 0.7rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: saving ? 'default' : 'pointer',
    background: on ? '#16a34a' : 'var(--surface)',
    color: on ? 'white' : 'var(--text-base)',
    opacity: saving ? 0.6 : 1,
  }
}

const TONE: Record<'green' | 'amber' | 'muted', string> = { green: 'var(--text-green-700)', amber: 'var(--text-amber-700)', muted: 'var(--text-muted)' }

export function MissedCallReplyCard({
  role,
  io = DEFAULT_IO,
  now = () => new Date().toISOString(),
}: {
  role: UserRole | null | undefined
  io?: MissedReplyCardIo
  /** When a save happened, for the row's `savedAt` and the list's words. A test hands in a fixed clock. */
  now?: () => string
}) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const canSet = canSetMissedReply(role)
  const [settings, setSettings] = useState<MissedReplySettings | null>(null)
  const [draft, setDraft] = useState<MissedReplyDraft | null>(null)
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (!live) return
        setSettings(r.settings)
        setDraft(draftFrom(r.settings))
        setClaims(r.claims)
      },
      (e: unknown) => {
        if (live) setProblem(formatErrorMessage(e))
      },
    )
    return () => {
      live = false
    }
  }, [io])

  const changed = !!settings && !!draft && !sameDraft(draft, draftFrom(settings))
  const bad = draft ? draftProblem(draft) : null

  const flip = async () => {
    if (!settings) return
    const next = !settings.on
    // Turning it on texts real phones, so it asks first. Turning it off does not.
    if (next && !(await confirm({ ...W.confirm, cancelIsSafe: true }))) return
    setFlipping(true)
    setProblem(null)
    try {
      const json = serializeSwitch(settings, next, now())
      await io.save(json)
      setSettings(settingsAfterSave(json))
      showToast(next ? W.onToast : W.offToast, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setFlipping(false)
    }
  }

  const save = async () => {
    if (!settings || !draft || bad || !changed) return
    setSaving(true)
    setProblem(null)
    try {
      const json = serializeLines(settings, draft, now())
      await io.save(json)
      const saved = settingsAfterSave(json)
      setSettings(saved)
      setDraft(draftFrom(saved))
      showToast(W.saved, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const putBack = () => {
    if (settings) setDraft(draftFrom(settings))
  }

  const list = claimLines(claims, now())

  return (
    <section aria-labelledby="phone-texts-missed-calls" id="settings-phone-texts-missed-calls" data-settings-missed-calls style={cardStyle}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 id="phone-texts-missed-calls" style={{ margin: 0, fontSize: '1rem' }}>
          {W.title}
        </h3>
        {settings && canSet && (
          <button type="button" role="switch" aria-checked={settings.on} aria-label={W.switch} disabled={flipping} onClick={() => void flip()} style={switchStyle(settings.on, flipping)}>
            {flipping ? 'Saving…' : settings.on ? 'On' : 'Off'}
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{W.note}</p>
      {!settings && !problem && <p style={muted}>{W.loading}</p>}
      {settings && (
        <p data-missed-calls-state style={muted}>
          {settings.on ? W.on : W.off}
        </p>
      )}
      {settings && draft && canSet && (
        <div data-missed-calls-form style={{ display: 'grid', gap: '0.5rem' }}>
          {LINE_KEYS.map((key) => {
            const field = LINE_FIELD[key]
            const id = `phone-texts-missed-${key}`
            return (
              <div key={key} style={{ display: 'grid', gap: '0.2rem' }}>
                <label htmlFor={id} style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {W.lines[key]}
                </label>
                <textarea id={id} value={draft[field]} maxLength={MISSED_LINE_MAX + 40} disabled={saving} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} style={lineStyle} />
              </div>
            )
          })}
          {bad && (
            <p data-missed-calls-problem style={{ ...muted, color: 'var(--text-red-700)' }}>
              {bad}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!changed || !!bad || saving}
              style={{
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0.25rem 0.7rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: changed && !bad && !saving ? 'pointer' : 'default',
                background: changed && !bad ? '#2563eb' : 'var(--surface)',
                color: changed && !bad ? '#fff' : 'var(--text-muted)',
              }}
            >
              {saving ? 'Saving…' : W.save}
            </button>
            <button
              type="button"
              onClick={putBack}
              disabled={!changed || saving}
              style={{
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0.25rem 0.7rem',
                fontSize: '0.85rem',
                background: 'var(--surface)',
                color: changed ? 'var(--text-base)' : 'var(--text-muted)',
                cursor: changed && !saving ? 'pointer' : 'default',
              }}
            >
              {W.putBack}
            </button>
          </div>
        </div>
      )}
      {settings && !canSet && (
        <div data-missed-calls-read style={{ display: 'grid', gap: '0.25rem' }}>
          {LINE_KEYS.map((key) => (
            <p key={key} style={{ margin: 0, fontSize: '0.9rem' }}>
              <strong>{W.lines[key]}:</strong> {settings[LINE_FIELD[key]]}
            </p>
          ))}
          <p style={muted}>{W.notAllowed}</p>
        </div>
      )}
      {settings && <p style={muted}>{W.gates}</p>}
      {settings && (
        <div data-missed-calls-list style={{ display: 'grid', gap: '0.3rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{W.lastHead}</h4>
          {list.length === 0 ? (
            <EmptyState compact main={W.empty} />
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.2rem' }}>
              {list.map((row) => (
                <li key={row.key} data-missed-calls-row={row.key} style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.when}</span> · <strong>{row.who}</strong> · <span style={{ color: TONE[row.tone] }}>{row.words}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
