/**
 * Set or edit a teammate's goal in one trade (punch list #255, v2.6626): the license they work toward and the
 * number the board asks for, or the ladder's seeded rule; and the hours (HVAC: months) worked before the clock
 * started, with where they came from. One `license_targets` row a person and trade, read by the logbook, Your week
 * and the Monday email.
 */
import { useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { formatErrorMessage } from '../../utils/errorHandling'
import { TRADE_LABEL, unitOfTrade, type LicenseClass, type LicenseTarget, type ParsedLicense, type Trade } from '../../lib/logbook/logbook'
import { draftFrom, ladderOptionWords, seededAmountToward, targetFromDraft, targetMissing, targetOptions, targetSummary } from '../../lib/logbook/licenseTarget'
import { saveLicenseTarget } from '../../lib/logbook/licenseTargetIo'

const label: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.85rem', fontWeight: 600 }
const input: CSSProperties = { font: 'inherit', fontWeight: 400, padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', fontWeight: 700, padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }
const btnBlue: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }

export default function LicenseTargetWindow({
  personName,
  userId,
  trade,
  holds,
  current,
  onClose,
  onSaved,
}: {
  personName: string
  userId: string
  trade: Trade
  /** The highest license held in the trade, so the options start above it. */
  holds: ParsedLicense | null
  current: LicenseTarget | null
  onClose: () => void
  onSaved: (saved: LicenseTarget) => void
}) {
  const [draft, setDraft] = useState(() => draftFrom(current))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unit = unitOfTrade(trade)
  const Unit = unit === 'hours' ? 'Hours' : 'Months'
  const missing = targetMissing(trade, draft)
  const firstName = personName.split(' ')[0] || personName

  async function save() {
    if (missing) return
    setSaving(true)
    setError(null)
    try {
      const target = targetFromDraft(trade, draft)
      await saveLicenseTarget(userId, target)
      onSaved(target)
    } catch (e) {
      setError(formatErrorMessage(e))
      setSaving(false)
    }
  }

  return (
    <ResponsiveModalShell
      title={`${firstName}’s ${TRADE_LABEL[trade].toLowerCase() === 'hvac' ? 'HVAC' : TRADE_LABEL[trade].toLowerCase()} goal`}
      onRequestClose={onClose}
      maxWidthDesktop={520}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="license-target-summary">{missing ?? targetSummary(trade, draft)}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn} onClick={onClose}>Cancel</button>
            <button type="button" style={{ ...btnBlue, opacity: missing || saving ? 0.6 : 1 }} disabled={Boolean(missing) || saving} onClick={() => void save()} data-testid="license-target-save">
              {saving ? 'Saving…' : 'Save the goal'}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 12, padding: '0.25rem 0' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {holds ? `${firstName} holds ${holds.name}${holds.number ? ` #${holds.number}` : ''}. ` : ''}
          The goal names the next license and the board’s own number. {Unit} worked before the clock started go in once, with their source.
        </p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={label}>
            Working toward
            <select
              style={input}
              value={draft.targetClass}
              data-testid="license-target-class"
              onChange={(e) => {
                const cls = (e.target.value || '') as LicenseClass | ''
                setDraft((d) => {
                  const seeded = cls ? seededAmountToward(trade, cls) : null
                  return { ...d, targetClass: cls, targetAmount: cls ? (d.targetAmount || (seeded != null ? String(seeded) : '')) : '' }
                })
              }}
            >
              <option value="">{ladderOptionWords(trade, holds)}</option>
              {targetOptions(trade, holds).map((o) => (
                <option key={o.level} value={o.level}>{o.name}</option>
              ))}
            </select>
          </label>
          {draft.targetClass ? (
            <label style={label}>
              {Unit} the board asks for
              <input style={input} inputMode="decimal" value={draft.targetAmount} onChange={(e) => setDraft((d) => ({ ...d, targetAmount: e.target.value }))} placeholder={unit === 'hours' ? '8000' : '24'} data-testid="license-target-amount" />
            </label>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={label}>
            {Unit} before the clock started
            <input style={input} inputMode="decimal" value={draft.openingAmount} onChange={(e) => setDraft((d) => ({ ...d, openingAmount: e.target.value }))} placeholder="0" data-testid="license-target-opening" />
          </label>
          <label style={label}>
            Where they came from
            <input style={input} value={draft.openingSource} onChange={(e) => setDraft((d) => ({ ...d, openingSource: e.target.value }))} placeholder="Hours at Rio Plumbing, 2023 to 2025, their signed form on file" data-testid="license-target-source" />
          </label>
        </div>
        {error ? <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</div> : null}
      </div>
    </ResponsiveModalShell>
  )
}
