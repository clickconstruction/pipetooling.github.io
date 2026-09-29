import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { trackingShape, type RunSendMethod } from '../../lib/jobs/lienDeskRun'
import { LIEN_SEND_RECIPIENT_WORDS, sendsTrackingOwed, withTracking } from '../../lib/jobs/lienSendTracking'

/**
 * "Add the number" (v2.4119): a recorded notice whose certified or courier
 * send went out without its tracking number — the run let it, the post office
 * gave the number later. One small input per owed recipient, the shape
 * checked as it is typed, Save writes the filing's `sends` back with the
 * number filled in. Drawn on the Lien desk's Sent footer and in the Lien
 * window's Filings list; nothing else about the record changes.
 */
export default function LienTrackingOwedEditor({
  filing,
  onSaved,
  compact = false,
}: {
  filing: { id: string; sends: unknown }
  onSaved: () => void
  compact?: boolean
}) {
  const { showToast } = useToastContext()
  const owed = sendsTrackingOwed(filing.sends)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  if (owed.length === 0) return null

  const save = async (recipient: string) => {
    const tracking = (values[recipient] ?? '').trim()
    if (!tracking || busy) return
    setBusy(true)
    try {
      const sends = withTracking(filing.sends, recipient, tracking)
      await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ sends } as never).eq('id', filing.id), 'lien filing: add the tracking number')
      showToast('Tracking number on record.', 'success')
      setValues((v) => ({ ...v, [recipient]: '' }))
      onSaved()
    } catch {
      showToast('Could not save the tracking number.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="lien-tracking-owed" style={{ display: 'grid', gap: '0.3rem', fontSize: compact ? '0.72rem' : '0.78rem', flexBasis: '100%' }}>
      {owed.map((s) => {
        const v = values[s.recipient] ?? ''
        const shape = trackingShape(s.method as RunSendMethod, v)
        return (
          <div key={s.recipient} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-amber-800)', fontWeight: 700, whiteSpace: 'nowrap' }}>tracking owed</span>
            <span style={{ color: 'var(--text-muted)' }}>{LIEN_SEND_RECIPIENT_WORDS[s.recipient] ?? s.recipient} · {s.method === 'certified_mail' ? 'certified mail' : 'courier'}</span>
            <input
              value={v}
              onChange={(e) => setValues((prev) => ({ ...prev, [s.recipient]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save(s.recipient)
              }}
              placeholder={s.method === 'certified_mail' ? '9407 1118 …' : 'tracking number'}
              aria-label={`Tracking number — ${LIEN_SEND_RECIPIENT_WORDS[s.recipient] ?? s.recipient}`}
              inputMode="numeric"
              style={{ font: 'inherit', fontVariantNumeric: 'tabular-nums', padding: '2px 6px', border: `1px solid ${v && !shape.ok ? 'var(--text-red-600)' : 'var(--border-strong)'}`, borderRadius: 6, background: 'var(--surface)', color: 'inherit', width: compact ? '13rem' : '15rem' }}
            />
            {v && shape.hint ? <span style={{ color: shape.ok ? 'var(--text-green-700)' : 'var(--text-red-600)' }}>{shape.ok ? '✓ ' : ''}{shape.hint}</span> : null}
            <button
              type="button"
              onClick={() => void save(s.recipient)}
              disabled={busy || !v.trim()}
              style={{ border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 700, cursor: busy || !v.trim() ? 'default' : 'pointer', padding: 0, font: 'inherit' }}
            >
              add the number ›
            </button>
          </div>
        )
      })}
    </div>
  )
}
