/**
 * Settings → Phone and texts → **Text a receipt link when a card charge posts** (punch list #299, PR 2), for the owner
 * and a dev. The switch that lets the app text a card's holder a receipt link when a charge posts
 * (`app_settings.receipt_texts_v1`, through `tickets/receiptTextsIo.ts`). It ships off. Turning it on asks first, since
 * every charge after it texts a real phone, and stamps the moment, so no charge from before is texted. A trial texts
 * the person who presses alone. Send texts, the card above, must be on too; the card says so, and says it in amber
 * while this switch is on and that one is off. The day it went on is read back from the row, which the database stamps.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { RECEIPT_TEXTS_WORDS as W, receiptTextsOnWords, type ReceiptTextsSetting } from '../../lib/tickets/receiptText'
import { supabaseReceiptTextsIo, type ReceiptTextsIo } from '../../lib/tickets/receiptTextsIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseReceiptTextsIo()

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }

export function ReceiptTextsSettingsCard({ io = DEFAULT_IO }: { io?: ReceiptTextsIo }) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const myId = user?.id ?? null
  const [setting, setSetting] = useState<ReceiptTextsSetting | null>(null)
  /** Who a press of On texts: everyone with a card, or the person pressing alone. */
  const [trial, setTrial] = useState(false)
  /** Send texts, the card above: null until read. A read that fails says nothing here; the sweep reads it itself. */
  const [sendTextsOn, setSendTextsOn] = useState<boolean | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.sendTextsOn().then(
      (r) => {
        if (live) setSendTextsOn(r)
      },
      () => {},
    )
    io.load().then(
      (r) => {
        if (!live) return
        setSetting(r)
        setTrial(r.on && r.only.length > 0)
      },
      (e: unknown) => {
        if (live) setProblem(formatErrorMessage(e))
      },
    )
    return () => {
      live = false
    }
  }, [io])

  const save = async (next: { on: boolean; only: string[] }, toast: string) => {
    setSaving(true)
    setProblem(null)
    try {
      setSetting(await io.set(next))
      showToast(toast, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const flip = async () => {
    if (!setting) return
    if (setting.on) {
      await save({ on: false, only: [] }, W.offToast)
      return
    }
    const mine = trial && myId ? [myId] : []
    // Turning it on lets real texts go, so it asks first. Turning it off does not.
    if (!(await confirm({ ...(mine.length > 0 ? W.confirmTrial : W.confirm), cancelIsSafe: true }))) return
    await save({ on: true, only: mine }, mine.length > 0 ? W.trialToast : W.onToast)
  }

  const on = setting?.on ?? false
  const onWords = setting ? receiptTextsOnWords(setting, myId) : null
  return (
    <section aria-labelledby="phone-texts-receipt-texts" id="settings-phone-texts-receipt-texts" data-settings-receipt-texts style={cardStyle}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 id="phone-texts-receipt-texts" style={{ margin: 0, fontSize: '1rem' }}>
          {W.title}
        </h3>
        {setting !== null && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={W.title}
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
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{W.what}</p>
      <p style={muted}>{W.rules}</p>
      {setting === null && !problem ? <p style={muted}>Loading the switch…</p> : <p style={muted}>{W.needs}</p>}
      {onWords ? (
        <p data-receipt-texts-on style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
          {onWords}
        </p>
      ) : null}
      {on && sendTextsOn === false ? (
        <p data-receipt-texts-held style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
          {W.sendTextsOff}
        </p>
      ) : null}
      {setting !== null && (
        <fieldset disabled={on || saving} style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem', opacity: on ? 0.7 : 1 }}>
          <legend style={{ fontSize: '0.85rem', fontWeight: 600, padding: 0, marginBottom: '0.2rem' }}>{W.whoLabel}</legend>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem' }}>
            <input type="radio" name="receipt-texts-who" checked={!trial} onChange={() => setTrial(false)} />
            {W.everyone}
          </label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem' }}>
            <input type="radio" name="receipt-texts-who" checked={trial} onChange={() => setTrial(true)} disabled={!myId} />
            {W.onlyMe}
          </label>
          {on ? <p style={muted}>{W.changeWho}</p> : null}
        </fieldset>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
