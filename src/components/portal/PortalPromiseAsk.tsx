/**
 * "Can't pay today? Tell us when to expect it." — the customer's own pay-by
 * date on the portal statement ("Their Word" PR 2). One tap on a Friday
 * chip, or any date, posted as a `payment_promise` portal request. Only
 * offered once a bill is at least a week old (the caller gates on
 * promiseAskVisible), so the first invoice asks for money, not a date.
 * Customer-facing ⇒ single-theme light with the statement's own palette.
 */
import { useState } from 'react'
import { formatPortalDate } from '../../lib/portal/portalPayload'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { promiseDateChoices, promiseDateProblem } from '../../../supabase/functions/_shared/portalPromise'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

export type PortalPromiseAskProps = {
  token: string
  todayYmd: string
  /** The date already on record for this account, when there is one. */
  existing: { promisedYmd: string; source: 'office' | 'customer' } | null
  totalDue: number
  formatUsd: (n: number) => string
}

export function PortalPromiseAsk({ token, todayYmd, existing, totalDue, formatUsd }: PortalPromiseAskProps) {
  const choices = promiseDateChoices(todayYmd)
  const [picked, setPicked] = useState<string>('')
  const [custom, setCustom] = useState(false)
  const [note, setNote] = useState('')
  const [ui, setUi] = useState<{ kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; ymd: string } | { kind: 'error'; text: string }>({ kind: 'idle' })
  const fmt = (d: string) => formatPortalDate(d) ?? d

  async function send() {
    const problem = promiseDateProblem(picked, todayYmd)
    if (problem) {
      setUi({ kind: 'error', text: problem })
      return
    }
    setUi({ kind: 'sending' })
    if (sampleStateFromToken(token)) {
      setUi({ kind: 'sent', ymd: picked })
      return
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, kind: 'payment_promise', date: picked, note: note.trim() || undefined }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setUi({ kind: 'error', text: json?.error ?? 'Something went wrong. Please try again, or call our office.' })
        return
      }
      setUi({ kind: 'sent', ymd: picked })
    } catch {
      setUi({ kind: 'error', text: 'Something went wrong. Please check your connection.' })
    }
  }

  if (ui.kind === 'sent') {
    return (
      <div data-testid="portal-promise-ask" data-screen-only style={{ marginTop: 10, border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '10px 12px', fontSize: 13 }}>
        <div style={{ color: PAPER_GREEN, fontWeight: 700 }}>Thank you — we'll expect {formatUsd(totalDue)} by {fmt(ui.ymd)}.</div>
        <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>We'll hold off on reminders until then.</div>
      </div>
    )
  }

  const chipStyle = (on: boolean) => ({
    border: `1px solid ${on ? COPPER : HAIR}`,
    background: on ? COPPER : CARD,
    color: on ? '#fff' : INK,
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 12.5,
    fontWeight: on ? 700 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  })

  return (
    <div data-testid="portal-promise-ask" data-screen-only style={{ marginTop: 10, border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '10px 12px', display: 'grid', gap: 7, fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: INK }}>
        {existing ? `You told us to expect payment by ${fmt(existing.promisedYmd)}. Changed?` : "Can't pay today? Tell us when to expect it."}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {choices.map((c) => (
          <button
            key={c.ymd}
            type="button"
            aria-pressed={!custom && picked === c.ymd}
            onClick={() => {
              setCustom(false)
              setPicked(c.ymd)
              if (ui.kind === 'error') setUi({ kind: 'idle' })
            }}
            style={chipStyle(!custom && picked === c.ymd)}
          >
            {c.label}
          </button>
        ))}
        <button type="button" aria-pressed={custom} onClick={() => { setCustom(true); setPicked('') }} style={chipStyle(custom)}>
          Pick a date
        </button>
        {custom ? (
          <input
            type="date"
            aria-label="Pay-by date"
            value={picked}
            min={todayYmd}
            onChange={(e) => { setPicked(e.target.value); if (ui.kind === 'error') setUi({ kind: 'idle' }) }}
            style={{ padding: '0.35rem 0.5rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, fontSize: 13 }}
          />
        ) : null}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 300))}
        placeholder="Anything we should know? (optional)"
        aria-label="Note"
        style={{ padding: '0.4rem 0.55rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, fontSize: 13, fontFamily: 'inherit' }}
      />
      {ui.kind === 'error' ? <div style={{ color: '#b42318' }}>{ui.text}</div> : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={ui.kind === 'sending' || !picked}
          onClick={() => void send()}
          style={{ background: picked ? COPPER : HAIR, color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 700, cursor: picked ? 'pointer' : 'not-allowed' }}
        >
          {ui.kind === 'sending' ? '…' : 'Tell us'}
        </button>
        <span style={{ color: MUTED, fontSize: 11.5 }}>One tap, no sign-in. We'll hold off on reminders until then.</span>
      </div>
    </div>
  )
}

export default PortalPromiseAsk
