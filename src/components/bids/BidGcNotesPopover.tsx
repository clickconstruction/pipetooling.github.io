import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { partitionNotesForGc } from '../../lib/bids/bidGcNotes'
import { noteByLineFromEmbed, SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR } from '../../lib/noteCreatorDisplay'
import { formatCompactNoteDateTime } from '../../utils/dateUtils'
import { ContactMethodQuickPicks } from '../shared/ContactMethodQuickPicks'

/**
 * Per-GC bid notes (v2.2217): opened from a Bid Board GC line. Shows that
 * GC's notes on THIS bid (whole-bid notes greyed underneath for context) and
 * adds new ones scoped to the GC. For the bid's own GC (gcId null) the
 * whole-bid notes are the notes — same store the Bid tab shows.
 */
type EntryRow = {
  id: string
  bid_id: string
  gc_customer_id?: string | null
  contact_method: string | null
  notes: string | null
  occurred_at: string
  created_at: string | null
  created_by: string | null
  created_by_user?: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
}

export function BidGcNotesPopover({
  bidId,
  bidLabel,
  gcId,
  gcName,
  sentOn,
  outcome,
  onClose,
  onChanged,
}: {
  bidId: string
  bidLabel: string
  gcId: string | null
  gcName: string
  sentOn: string | null
  outcome: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [entries, setEntries] = useState<EntryRow[] | null>(null)
  const [text, setText] = useState('')
  const [method, setMethod] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('bids_submission_entries')
        .select(SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR)
        .eq('bid_id', bidId)
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) {
        showToast(formatErrorMessage(error, 'Could not load notes'), 'error')
        setEntries([])
        return
      }
      setEntries((data as unknown as EntryRow[]) ?? [])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId, tick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { scoped, context } = partitionNotesForGc(entries ?? [], gcId)

  async function save() {
    const notes = text.trim()
    if (!notes) return
    setSaving(true)
    const occurredAtIso = new Date().toISOString()
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').insert({
            bid_id: bidId,
            gc_customer_id: gcId,
            notes,
            contact_method: method,
            occurred_at: occurredAtIso,
            created_by: authUser?.id ?? null,
          }),
        'save per-GC bid note',
      )
      // Per-GC Phase 1: the bids_submission_entries sync trigger derives bids.last_contact
      // (method entries only) — no client bump.
      setText('')
      setMethod(null)
      setTick((t) => t + 1)
      window.dispatchEvent(new Event('bid-gc-notes-changed'))
      onChanged()
      showToast(gcId ? `Noted for ${gcName}.` : 'Bid note saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const noteCard = (e: EntryRow, greyed: boolean) => (
    <div
      key={e.id}
      style={{
        borderLeft: `3px solid ${greyed ? 'var(--border)' : '#3b82f6'}`,
        background: greyed ? 'var(--bg-subtle)' : 'var(--bg-blue-tint)',
        borderRadius: '0 8px 8px 0',
        padding: '0.45rem 0.65rem',
        marginBottom: '0.4rem',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-strong)', whiteSpace: 'pre-wrap' }}>{e.notes ?? ''}</p>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
        {greyed ? 'whole-bid note · ' : ''}
        {e.contact_method ? `${e.contact_method} · ` : ''}
        {formatCompactNoteDateTime(e.occurred_at)}
        {noteByLineFromEmbed(e.created_by_user) ? ` · ${noteByLineFromEmbed(e.created_by_user)}` : ''}
      </div>
    </div>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Notes for ${gcName} on ${bidLabel}`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, width: 'min(30rem, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 28px 60px rgba(0,0,0,0.35)' }}
      >
        <div style={{ padding: '0.9rem 1.1rem 0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.98rem' }}>{gcName}</strong>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>on {bidLabel}</span>
            <span style={{ fontSize: '0.76rem', color: sentOn ? 'var(--text-green-600)' : 'var(--text-muted)' }}>· {sentOn ? `sent ${sentOn}` : 'not sent'}</span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>· {outcome ?? 'waiting'}</span>
            <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', font: 'inherit', border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>✕</button>
          </div>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
            {gcId ? `Notes here are about ${gcName} on this bid — they show with a ${gcName.split(' ')[0]} tag in the bid's feed too.` : "The bid's own GC — these are the bid's notes."}
          </p>
        </div>
        <div style={{ overflowY: 'auto', padding: '0.2rem 1.1rem 0.4rem' }}>
          {entries == null ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</p>
          ) : (
            <>
              {scoped.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.2rem 0 0.5rem' }}>No notes yet{gcId ? ` for ${gcName} on this bid` : ''}.</p> : scoped.map((e) => noteCard(e, false))}
              {gcId && context.length > 0 ? context.slice(0, 3).map((e) => noteCard(e, true)) : null}
            </>
          )}
        </div>
        <div style={{ padding: '0.5rem 1.1rem 0.9rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <ContactMethodQuickPicks onPick={(v) => setMethod((m) => (m === v ? null : v))} />
            {method ? <span style={{ fontSize: '0.74rem', color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', borderRadius: 999, padding: '0.1rem 0.55rem' }}>{method}</span> : <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>contact method (optional)</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void save()
                }
              }}
              placeholder={gcId ? `Add a note for ${gcName} on this bid…` : 'Add a bid note…'}
              disabled={saving}
              style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: '0.88rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !text.trim()}
              style={{ font: 'inherit', fontSize: '0.88rem', fontWeight: 600, padding: '0.5rem 0.95rem', borderRadius: 8, border: '1px solid #3b82f6', background: '#3b82f6', color: '#fff', cursor: saving || !text.trim() ? 'not-allowed' : 'pointer', opacity: !text.trim() ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
