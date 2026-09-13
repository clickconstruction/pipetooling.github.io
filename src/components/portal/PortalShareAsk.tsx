/**
 * Share this bill, PR 4 (v2.3378): "Ask the office" under a bill on the GC's
 * shared card. A GC looking at a homeowner's open bill can ask two things —
 * bill it to us instead, or remind the owner for us — and the ask lands in
 * the dispatch inbox as a Customer Waiting request; the office decides and
 * acts with Bill to ▾ or the Followup tools. The GC never emails the owner
 * and never pays the owner's bill from here. Customer-facing ⇒ single-theme
 * light with the statement's own palette.
 */
import { useState } from 'react'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

export type PortalShareAskKind = 'bill_me' | 'remind_owner'

export const PORTAL_SHARE_ASKS: ReadonlyArray<{ key: PortalShareAskKind; label: string; hint: string }> = [
  { key: 'bill_me', label: 'Bill this to us instead', hint: 'We move the bill onto your account and send it to you.' },
  { key: 'remind_owner', label: 'Remind the owner for us', hint: 'We reach out to them about this bill; you are not copied.' },
]

export type PortalShareAskProps = {
  token: string
  jobId: string
  /** "J1017 · 4410 Cedar Hollow" — the words the confirmation repeats. */
  billLabel: string
  amount: number
  formatUsd: (n: number) => string
}

export function PortalShareAsk({ token, jobId, billLabel, amount, formatUsd }: PortalShareAskProps) {
  const [open, setOpen] = useState(false)
  const [ask, setAsk] = useState<PortalShareAskKind | null>(null)
  const [note, setNote] = useState('')
  const [ui, setUi] = useState<{ kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; ask: PortalShareAskKind } | { kind: 'error'; text: string }>({ kind: 'idle' })

  async function send() {
    if (!ask) {
      setUi({ kind: 'error', text: 'Pick what you are asking for.' })
      return
    }
    setUi({ kind: 'sending' })
    if (sampleStateFromToken(token)) {
      setUi({ kind: 'sent', ask })
      return
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, kind: 'share_bill_ask', ask, jobId, amount, note: note.trim() || undefined }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setUi({ kind: 'error', text: json?.error ?? 'Something went wrong. Please try again, or call our office.' })
        return
      }
      setUi({ kind: 'sent', ask })
    } catch {
      setUi({ kind: 'error', text: 'Something went wrong. Please check your connection.' })
    }
  }

  if (ui.kind === 'sent') {
    return (
      <div data-testid="portal-share-ask" data-screen-only style={{ marginTop: 6, fontSize: 12, color: PAPER_GREEN, fontWeight: 700 }}>
        {ui.ask === 'bill_me' ? `Sent — we'll move ${formatUsd(amount)} on ${billLabel} onto your account and call you during office hours.` : `Sent — we'll reach out to the owner about ${billLabel} and let you know.`}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="portal-share-ask-open"
        data-screen-only
        onClick={() => setOpen(true)}
        style={{ border: 'none', background: 'none', padding: '4px 0 0', color: COPPER, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Ask the office ›
      </button>
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
    <div data-testid="portal-share-ask" data-screen-only style={{ marginTop: 8, border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '10px 12px', display: 'grid', gap: 7, fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: INK }}>About {billLabel} · {formatUsd(amount)}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PORTAL_SHARE_ASKS.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-pressed={ask === a.key}
            onClick={() => {
              setAsk(a.key)
              if (ui.kind === 'error') setUi({ kind: 'idle' })
            }}
            style={chipStyle(ask === a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {ask ? <div style={{ fontSize: 12, color: MUTED }}>{PORTAL_SHARE_ASKS.find((a) => a.key === ask)?.hint}</div> : null}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Anything we should know (optional)"
        aria-label="Note to the office"
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${HAIR}`, borderRadius: 6, padding: '6px 8px', fontSize: 12.5, fontFamily: 'inherit', background: CARD, color: INK }}
      />
      {ui.kind === 'error' ? <div style={{ color: '#b42318', fontSize: 12 }}>{ui.text}</div> : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void send()}
          disabled={ui.kind === 'sending'}
          style={{ background: COPPER, color: '#fff', border: 'none', padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 4 }}
        >
          {ui.kind === 'sending' ? 'Sending…' : 'Send to the office'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
