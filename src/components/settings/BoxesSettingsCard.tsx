/**
 * Residential R6's screens: Settings → Phone and texts → **Inboxes**, under Company phone seats and written the same
 * way. Each of the two boxes, the team inbox for our own customers and the bids inbox for the GC side, keeps its email
 * address, its phone and its Quo number id in `app_settings.messages_boxes_v1` (through `messages/boxesCardIo.ts`, the
 * words and checks `messages/boxesCard.ts`'s). The owner's team@ or office@ answer is typed here. Everyone who sees the
 * group reads it; the owner and a dev change it and save. An empty field keeps today's number or mailbox, which only the
 * server knows, so the card says so in words. Nothing reads the row until the two inboxes are switched on.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { canSetAssignSeats } from '../../lib/messages/assignRule'
import { MAILBOXES, type BoxSetting, type BoxSettings, type Mailbox } from '../../lib/messages/boxes'
import { BOX_EMPTY_WORDS, BOX_TITLE, BOXES_INTRO, BOXES_SAVED_TOAST, BOXES_WHEN, boxForWords, boxesProblem, cleanBoxes, sameBoxes } from '../../lib/messages/boxesCard'
import { supabaseBoxesCardIo, type BoxesCardIo } from '../../lib/messages/boxesCardIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const DEFAULT_IO = supabaseBoxesCardIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const boxStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.45rem', margin: 0 }
const fieldRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(8rem, 10rem) minmax(0, 1fr)', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }

const FIELDS: ReadonlyArray<{ key: keyof BoxSetting; label: string; placeholder: string; type: string }> = [
  { key: 'address', label: 'Email address', placeholder: 'team@…', type: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '(512) 555-0144', type: 'tel' },
  { key: 'numberId', label: 'Quo number id', placeholder: 'PN…', type: 'text' },
]

export function BoxesSettingsCard({ io = DEFAULT_IO }: { io?: BoxesCardIo }) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const canSet = canSetAssignSeats(role)
  const [loaded, setLoaded] = useState<BoxSettings | null>(null)
  const [draft, setDraft] = useState<BoxSettings | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.load().then(
      (b) => {
        if (!live) return
        setLoaded(b)
        setDraft(b)
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e)),
    )
    return () => {
      live = false
    }
  }, [io])

  const changed = loaded !== null && draft !== null && !sameBoxes(draft, loaded)
  const shown = canSet ? draft : loaded

  const setField = (box: Mailbox, key: keyof BoxSetting, value: string) =>
    setDraft((d) => (d ? { ...d, [box]: { ...d[box], [key]: value } } : d))

  const save = async () => {
    if (!draft) return
    const stop = boxesProblem(draft)
    if (stop) {
      setProblem(stop)
      return
    }
    setSaving(true)
    setProblem(null)
    const clean = cleanBoxes(draft)
    try {
      await io.save(clean)
      setLoaded(clean)
      setDraft(clean)
      showToast(BOXES_SAVED_TOAST, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="phone-texts-boxes" id="settings-phone-texts-boxes" data-settings-boxes style={cardStyle}>
      <h3 id="phone-texts-boxes" style={{ margin: 0, fontSize: '1rem' }}>
        Inboxes
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{BOXES_INTRO}</p>
      <p style={muted}>{BOXES_WHEN}</p>
      {shown ? (
        MAILBOXES.map((box) => (
          <fieldset key={box} data-settings-box={box} style={boxStyle}>
            <legend style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0 0.25rem' }}>{BOX_TITLE[box]}</legend>
            <p style={muted}>{boxForWords(box)}</p>
            {FIELDS.map((f) => {
              const value = shown[box][f.key]
              return (
                <label key={f.key} style={fieldRow}>
                  <span>{f.label}</span>
                  {canSet ? (
                    <input
                      type={f.type}
                      aria-label={`${BOX_TITLE[box]}: ${f.label}`}
                      value={value}
                      placeholder={f.placeholder}
                      disabled={saving}
                      onChange={(e) => setField(box, f.key, e.target.value)}
                      style={{ ...clauseInputStyle, width: '100%', maxWidth: 320 }}
                    />
                  ) : value ? (
                    f.key === 'numberId' ? <code>{value}</code> : <span>{value}</span>
                  ) : (
                    <span style={muted}>Empty</span>
                  )}
                </label>
              )
            })}
            <p style={muted}>{BOX_EMPTY_WORDS[box]}</p>
          </fieldset>
        ))
      ) : (
        !problem && <p style={muted}>Loading the inboxes…</p>
      )}
      {canSet ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void save()} disabled={!changed || saving} style={changed && !saving ? clausePrimaryStyle : { ...clauseButtonStyle, cursor: 'default', opacity: 0.6 }}>
            {saving ? 'Saving…' : 'Save the inboxes'}
          </button>
          {changed && !saving && (
            <button
              type="button"
              onClick={() => {
                setDraft(loaded)
                setProblem(null)
              }}
              style={clauseButtonStyle}
            >
              Put them back
            </button>
          )}
        </div>
      ) : (
        <p style={muted}>The owner or a dev sets the inboxes.</p>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
