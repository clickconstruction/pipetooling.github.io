/**
 * Edit or add a teammate's license from their logbook (punch list #255). A trade and a level picked,
 * not typed, so the saved words always read back as the same license (`licenseTypeText`). For an
 * electrical or HVAC license, Check TDLR reads the state's open list and offers its expiry date; a
 * plumbing license gets the TSBPE search, which asks for a robot check a person answers.
 */
import { useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { formatErrorMessage } from '../../utils/errorHandling'
import { parseLicenseType } from '../../lib/logbook/logbook'
import {
  LICENSE_LEVELS,
  TSBPE_SEARCH_URL,
  cleanLicenseNumber,
  licenseTypeText,
  tdlrAnswer,
  tdlrNumberFor,
  tradeCheckedByTdlr,
  type LicenseLevel,
  type LicenseTrade,
  type TdlrAnswer,
} from '../../lib/logbook/licenseText'
import { fetchTdlrRows, notifyDispatchLicenseExpiry, saveLicense } from '../../lib/logbook/licenseSaveIo'

export type LicenseEditTarget = {
  /** null to add a license */
  id: string | null
  raw: string
  expiryYmd: string | null
  note: string | null
}

const label: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.85rem', fontWeight: 600 }
const input: CSSProperties = { font: 'inherit', fontWeight: 400, padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', fontWeight: 700, padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }
const btnBlue: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }

const TRADE_OPTIONS: Array<{ value: LicenseTrade; label: string }> = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'other', label: 'Other, such as a notary' },
]

function startFrom(target: LicenseEditTarget) {
  // A new license starts as the commonest one the office adds: a plumber's apprentice registration.
  if (!target.raw) return { trade: 'plumbing' as LicenseTrade, level: 'apprentice' as LicenseLevel | null, otherName: '', number: '' }
  const p = parseLicenseType(target.raw)
  const trade: LicenseTrade = p.trade ?? 'other'
  return { trade, level: (p.cls ?? null) as LicenseLevel | null, otherName: p.trade ? '' : p.name, number: p.number ?? '' }
}

function longDate(ymd: string): string {
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LicenseEditWindow({ personName, target, onClose, onSaved }: { personName: string; target: LicenseEditTarget; onClose: () => void; onSaved: (warning: string | null) => void }) {
  const first = startFrom(target)
  const [trade, setTrade] = useState<LicenseTrade>(first.trade)
  const [level, setLevel] = useState<LicenseLevel | null>(first.level)
  const [otherName, setOtherName] = useState(first.otherName)
  const [number, setNumber] = useState(first.number)
  const [expiry, setExpiry] = useState(target.expiryYmd ?? '')
  const [note, setNote] = useState(target.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [state, setState] = useState<TdlrAnswer | null>(null)

  const text = licenseTypeText({ trade, level, otherName, number })
  const tdlrNumber = tradeCheckedByTdlr(trade) ? tdlrNumberFor(number) : null
  const missing = !text ? (trade === 'other' ? 'Type the license’s name and number.' : 'Pick the level and type the number.') : !expiry ? 'Set the expiry date.' : null
  const adding = target.id === null
  const pressWords = adding ? 'Add the license' : 'Save the license'

  async function checkTdlr() {
    if (!tdlrNumber) return
    setChecking(true)
    setState(null)
    try {
      setState(tdlrAnswer(await fetchTdlrRows(tdlrNumber), trade, level))
    } catch (e) {
      setState({ kind: 'none', reason: formatErrorMessage(e) })
    } finally {
      setChecking(false)
    }
  }

  async function save() {
    if (!text || !expiry) return
    setSaving(true)
    setError(null)
    try {
      const id = await saveLicense({ id: target.id, personName, licenseType: text, expiryYmd: expiry, note })
      const warning = await notifyDispatchLicenseExpiry(id)
      onSaved(warning ? `The license is saved. The Dispatch notice may not have gone: ${warning}` : null)
    } catch (e) {
      setError(formatErrorMessage(e))
      setSaving(false)
    }
  }

  return (
    <ResponsiveModalShell
      title={adding ? `Add a license for ${personName}` : `Edit ${personName}’s license`}
      onRequestClose={onClose}
      maxWidthDesktop={520}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{missing ?? `Saves as ${text}`}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn} onClick={onClose}>Cancel</button>
            <button type="button" style={{ ...btnBlue, opacity: missing || saving ? 0.6 : 1 }} disabled={Boolean(missing) || saving} onClick={() => void save()} data-testid="license-save">
              {saving ? 'Saving…' : pressWords}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 12, padding: '0.25rem 0' }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={label}>
            Trade
            <select
              style={input}
              value={trade}
              onChange={(e) => {
                const t = e.target.value as LicenseTrade
                setTrade(t)
                setLevel(t === 'other' ? null : LICENSE_LEVELS[t][0]?.level ?? null)
                setState(null)
              }}
            >
              {TRADE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {trade === 'other' ? (
            <label style={label}>
              License name
              <input style={input} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Notary" />
            </label>
          ) : (
            <label style={label}>
              Level
              <select
                style={input}
                value={level ?? ''}
                onChange={(e) => {
                  setLevel((e.target.value || null) as LicenseLevel | null)
                  setState(null)
                }}
              >
                <option value="">Pick a level</option>
                {LICENSE_LEVELS[trade].map((l) => (
                  <option key={l.level} value={l.level}>{l.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={label}>
            Number
            <input
              style={input}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value)
                setState(null)
              }}
              onBlur={() => setNumber((n) => cleanLicenseNumber(n))}
              inputMode="text"
              placeholder="191717"
            />
          </label>
          <label style={label}>
            Expires
            <input style={input} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
        </div>

        {tradeCheckedByTdlr(trade) ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem' }}>The state’s record, from TDLR’s open list.</span>
              <button type="button" style={btn} disabled={!tdlrNumber || !level || checking} onClick={() => void checkTdlr()} data-testid="license-check-tdlr">
                {checking ? 'Checking…' : 'Check TDLR'}
              </button>
            </div>
            {state?.kind === 'found' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.875rem' }} data-testid="license-tdlr-answer">
                <span>
                  <b>{state.holder || 'The holder'}</b>, {state.type}. {state.expiryYmd ? `Expires ${longDate(state.expiryYmd)}.` : 'TDLR lists no expiry date.'}
                </span>
                {state.expiryYmd && state.expiryYmd !== expiry ? (
                  <button type="button" style={btn} onClick={() => setExpiry(state.expiryYmd ?? expiry)}>Use this date</button>
                ) : state.expiryYmd ? (
                  <span style={{ color: 'var(--text-green-700)', fontWeight: 700 }}>Matches</span>
                ) : null}
              </div>
            ) : state?.kind === 'none' ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-amber-800)' }}>{state.reason}</div>
            ) : null}
          </div>
        ) : trade === 'plumbing' ? (
          <div style={{ fontSize: '0.85rem' }}>
            TSBPE keeps the plumbing record. Its search asks you to prove you are not a robot.{' '}
            <a href={TSBPE_SEARCH_URL} target="_blank" rel="noreferrer">Open the TSBPE search</a>
          </div>
        ) : null}

        <label style={label}>
          Note
          <input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Where the date came from" />
        </label>

        {error ? <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</div> : null}
      </div>
    </ResponsiveModalShell>
  )
}
