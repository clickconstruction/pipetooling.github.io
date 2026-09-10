import { useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'

export type RfqNudgePreviewState = { rfqId: string; subject: string; text: string }

/**
 * The one nudge flow (v2.3245): preview the exact reminder, then send it.
 * Shared by the Pricing desk and the Edit Bid price-requests table so a
 * vendor is nudged the same way from either door — same edge function, same
 * preview-before-send, same 24h rest enforced server-side.
 */
export function useRfqNudge({ onSent }: { onSent: () => void | Promise<void> }) {
  const { showToast } = useToastContext()
  const [preview, setPreview] = useState<RfqNudgePreviewState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function previewNudge(rfqId: string) {
    setBusyId(rfqId)
    try {
      const { data, error } = await supabase.functions.invoke('send-rfq-email', { body: { mode: 'preview', rfqId } })
      const res = (data ?? {}) as { ok?: boolean; previews?: Array<{ subject: string; text: string }>; error?: string }
      if (error || !res.ok || !res.previews?.[0]) throw new Error(res.error ?? error?.message ?? 'Could not build the preview')
      setPreview({ rfqId, subject: res.previews[0].subject, text: res.previews[0].text })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not build the preview.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function sendNudge(rfqId: string, houseName: string | null) {
    setPreview(null)
    setBusyId(rfqId)
    try {
      const { data, error } = await supabase.functions.invoke('send-rfq-email', { body: { mode: 'remind', rfqId } })
      const res = (data ?? {}) as { ok?: boolean; error?: string }
      if (error || !res.ok) throw new Error(res.error ?? error?.message ?? 'Send failed')
      showToast(`Nudged ${houseName ?? 'the vendor'}.`, 'success')
      await onSent()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'That didn’t go through.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return { preview, busyId, previewNudge, sendNudge, cancel: () => setPreview(null) }
}

const ghostBtn: CSSProperties = { padding: '0.28rem 0.6rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600 }
const blueBtn: CSSProperties = { ...ghostBtn, background: '#2563eb', color: 'white', border: 'none' }

/** The preview panel: the exact reminder, Cancel, Send this nudge. Nothing sends until the button. */
export function RfqNudgePreview({ preview, busy, onCancel, onSend }: { preview: RfqNudgePreviewState; busy: boolean; onCancel: () => void; onSend: () => void }) {
  return (
    <div style={{ width: '100%', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This is the exact reminder — nothing sends until you say so:</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-strong)' }}>{preview.subject}</span>
      <pre style={{ margin: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.7rem', lineHeight: 1.5, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '9rem', overflowY: 'auto' }}>{preview.text}</pre>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" style={ghostBtn} onClick={onCancel}>Cancel</button>
        <button type="button" style={blueBtn} disabled={busy} onClick={onSend}>Send this nudge</button>
      </div>
    </div>
  )
}
