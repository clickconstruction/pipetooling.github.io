/**
 * "Ask for other dates" on a GC portal stage (v2.2934): two dates and a why,
 * posted as a `stage_window` portal request. Shows the ask's state afterwards
 * — waiting, accepted, or the office's answer — and "re-scheduling" while the
 * sub re-picks under the new window.
 */
import { useState } from 'react'
import { formatPortalDate, type PortalStageEntry } from '../../lib/portal/portalPayload'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { askProblem } from '../../../supabase/functions/_shared/stageAsk'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

export function PortalStageAsk({ entry, token, todayYmd }: { entry: PortalStageEntry; token: string; todayYmd: string }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(entry.window?.start ?? '')
  const [end, setEnd] = useState(entry.window?.end ?? '')
  const [note, setNote] = useState('')
  const [ui, setUi] = useState<{ kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; start: string; end: string } | { kind: 'error'; text: string }>({ kind: 'idle' })
  const fmt = (d: string) => formatPortalDate(d) ?? d
  const span = (x: { start: string; end: string }) => (x.start === x.end ? fmt(x.start) : `${fmt(x.start)} – ${fmt(x.end)}`)
  const askable = entry.state !== 'passed' && entry.state !== 'inspection'
  const asked = ui.kind === 'sent' ? { start: ui.start, end: ui.end, note: note.trim() || null, answer: 'open' as const, answerNote: null } : entry.asked

  async function send() {
    const problem = askProblem(start, end, todayYmd)
    if (problem) {
      setUi({ kind: 'error', text: problem })
      return
    }
    setUi({ kind: 'sending' })
    if (sampleStateFromToken(token)) {
      setUi({ kind: 'sent', start, end })
      setOpen(false)
      return
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, kind: 'stage_window', stageId: entry.id, start, end, note: note.trim() || undefined }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setUi({ kind: 'error', text: json?.error ?? 'Something went wrong. Please try again, or call the office.' })
        return
      }
      setUi({ kind: 'sent', start, end })
      setOpen(false)
    } catch {
      setUi({ kind: 'error', text: 'Something went wrong. Please check your connection.' })
    }
  }

  return (
    <div data-testid="portal-stage-ask" style={{ fontSize: 12.5 }}>
      {entry.rescheduling ? <div style={{ color: COPPER, fontWeight: 700 }}>Re-scheduling — the sub is picking new days inside the window.</div> : null}
      {asked ? (
        <div style={{ color: MUTED }}>
          {asked.answer === 'open'
            ? `You asked for ${span(asked)} · waiting on the office`
            : asked.answer === 'accepted'
              ? `You asked for ${span(asked)} · accepted`
              : `You asked for ${span(asked)} · the office answered${entry.window ? ` ${span(entry.window)}` : ''}${asked.answerNote ? ` — ${asked.answerNote}` : ''}`}
        </div>
      ) : null}
      {askable && !open && ui.kind !== 'sending' ? (
        <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: '#1d4e89', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
          {asked ? 'Ask again' : 'Ask for other dates'}
        </button>
      ) : null}
      {open ? (
        <div style={{ marginTop: 6, border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '8px 10px', display: 'grid', gap: 6 }}>
          <div style={{ fontWeight: 700, color: INK }}>{entry.window ? 'We need it between' : 'When do you need it?'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="From" style={{ padding: '0.35rem 0.5rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, fontSize: 13 }} />
            <span style={{ color: MUTED }}>and</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="To" style={{ padding: '0.35rem 0.5rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, fontSize: 13 }} />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="Why? (optional — framing slips, inspection moved…)" style={{ padding: '0.4rem 0.55rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, fontSize: 13, fontFamily: 'inherit' }} />
          {ui.kind === 'error' ? <div style={{ color: '#b42318' }}>{ui.text}</div> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={ui.kind === 'sending'} onClick={() => void send()} style={{ background: COPPER, color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {ui.kind === 'sending' ? '…' : 'Ask'}
            </button>
            <button type="button" disabled={ui.kind === 'sending'} onClick={() => { setOpen(false); if (ui.kind === 'error') setUi({ kind: 'idle' }) }} style={{ background: CARD, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {ui.kind === 'sent' ? <div style={{ color: PAPER_GREEN, fontWeight: 700, marginTop: 4 }}>Asked — the office will answer here.</div> : null}
    </div>
  )
}

export default PortalStageAsk
