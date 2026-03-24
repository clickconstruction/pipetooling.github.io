import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { ContactMethodQuickPicks, contactMethodFieldInputStyle } from '../shared/ContactMethodQuickPicks'
import type { Database } from '../../types/database'

export type BidSubmissionEntry = Database['public']['Tables']['bids_submission_entries']['Row']

function useBidSubmissionEntries(bidId: string | null, onLoadError?: (message: string) => void) {
  const [entries, setEntries] = useState<BidSubmissionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  const fetchEntries = useCallback(async (id: string) => {
    const data = await withSupabaseRetry(
      async () =>
        supabase.from('bids_submission_entries').select('*').eq('bid_id', id).order('occurred_at', { ascending: false }),
      'load bid submission entries'
    )
    return (data as BidSubmissionEntry[] | null) ?? []
  }, [])

  const refetch = useCallback(async () => {
    if (!bidId) {
      setEntries([])
      return
    }
    try {
      const rows = await fetchEntries(bidId)
      setEntries(rows)
    } catch (e) {
      onLoadErrorRef.current?.(`Failed to load bid notes: ${formatErrorMessage(e)}`)
      setEntries([])
    }
  }, [bidId, fetchEntries])

  useEffect(() => {
    if (!bidId) {
      setEntries([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rows = await fetchEntries(bidId)
        if (!cancelled) setEntries(rows)
      } catch (e) {
        if (!cancelled) {
          onLoadErrorRef.current?.(`Failed to load bid notes: ${formatErrorMessage(e)}`)
          setEntries([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, fetchEntries])

  return { entries, loading, refetch }
}

function BidNotesEntryRow({
  entry,
  onUpdated,
  isLastInList,
}: {
  entry: BidSubmissionEntry
  onUpdated: () => void
  isLastInList: boolean
}) {
  const { showToast } = useToastContext()
  const [contactMethod, setContactMethod] = useState(entry.contact_method ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [occurredAt, setOccurredAt] = useState(entry.occurred_at ? entry.occurred_at.slice(0, 16) : '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const occurredAtIso = occurredAt ? new Date(occurredAt).toISOString() : entry.occurred_at
      await withSupabaseRetry(
        async () =>
          supabase
            .from('bids_submission_entries')
            .update({ contact_method: contactMethod.trim() || null, notes: notes.trim() || null, occurred_at: occurredAtIso })
            .eq('id', entry.id),
        'update bid submission entry'
      )
      if (occurredAtIso && entry.bid_id) {
        await withSupabaseRetry(
          async () => supabase.from('bids').update({ last_contact: occurredAtIso }).eq('id', entry.bid_id),
          'update bid last_contact'
        )
      }
      setEditing(false)
      onUpdated()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save bid note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Remove this entry?')) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('bids_submission_entries').delete().eq('id', entry.id),
        'delete bid submission entry'
      )
      onUpdated()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete bid note'), 'error')
    }
  }

  const cardBorder: CSSProperties = {
    padding: '0.75rem',
    borderBottom: isLastInList ? 'none' : '1px solid #e5e7eb',
  }

  if (editing) {
    return (
      <article aria-label="Edit bid note" style={{ ...cardBorder, background: '#ffffff' }}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            minHeight: '4rem',
            boxSizing: 'border-box',
            resize: 'vertical',
            ...contactMethodFieldInputStyle,
          }}
        />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '0.5rem',
          }}
        >
          <div
            style={{
              flex: '1 1 200px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <ContactMethodQuickPicks onPick={setContactMethod} />
            <input
              type="text"
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value)}
              placeholder="Contact method"
              style={{ flex: '1 1 140px', minWidth: 0, boxSizing: 'border-box', ...contactMethodFieldInputStyle }}
            />
          </div>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            style={{ flex: '1 1 200px', minWidth: 0, ...contactMethodFieldInputStyle }}
          />
          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </article>
    )
  }

  const ariaLabel = entry.occurred_at
    ? `Bid note ${new Date(entry.occurred_at).toLocaleString()}`
    : 'Bid note'

  return (
    <article aria-label={ariaLabel} style={{ ...cardBorder, background: '#ffffff' }}>
      <div
        style={{
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          marginBottom: '0.5rem',
          fontSize: '0.9375rem',
          lineHeight: 1.45,
        }}
      >
        {entry.notes != null && entry.notes !== '' ? entry.notes : '—'}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem 1rem',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem 1rem',
            alignItems: 'center',
            fontSize: '0.875rem',
            color: '#374151',
          }}
        >
          <span>
            <span style={{ color: '#6b7280', marginRight: '0.35rem' }}>Contact method</span>
            {entry.contact_method ?? '—'}
          </span>
          <span>
            <span style={{ color: '#6b7280', marginRight: '0.35rem' }}>Time and date</span>
            {entry.occurred_at ? new Date(entry.occurred_at).toLocaleString() : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit"
            style={{
              padding: '0.25rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            title="Delete"
            style={{
              padding: '0.25rem',
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fca5a5',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  )
}

function BidNotesNewRow({
  bidId,
  onSaved,
  onCancel,
  isLastInList,
}: {
  bidId: string
  onSaved: () => void
  onCancel: () => void
  isLastInList: boolean
}) {
  const { showToast } = useToastContext()
  const [contactMethod, setContactMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const occurredAtIso = new Date(occurredAt).toISOString()
      await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').insert({
            bid_id: bidId,
            contact_method: contactMethod.trim() || null,
            notes: notes.trim() || null,
            occurred_at: occurredAtIso,
          }),
        'insert bid submission entry'
      )
      await withSupabaseRetry(
        async () => supabase.from('bids').update({ last_contact: occurredAtIso }).eq('id', bidId),
        'update bid last_contact'
      )
      onSaved()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add bid note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article aria-label="New bid note" style={{ padding: '0.75rem', borderBottom: isLastInList ? 'none' : '1px solid #e5e7eb', background: '#fafafa' }}>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={4}
        style={{
          width: '100%',
          minHeight: '4rem',
          boxSizing: 'border-box',
          resize: 'vertical',
          ...contactMethodFieldInputStyle,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: '0.5rem',
          marginTop: '0.5rem',
        }}
      >
        <div
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <ContactMethodQuickPicks onPick={setContactMethod} />
          <input
            type="text"
            value={contactMethod}
            onChange={(e) => setContactMethod(e.target.value)}
            placeholder="Contact method"
            style={{ flex: '1 1 140px', minWidth: 0, boxSizing: 'border-box', ...contactMethodFieldInputStyle }}
          />
        </div>
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: 0, ...contactMethodFieldInputStyle }}
        />
        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </article>
  )
}

export type BidNotesTableProps = {
  bidId: string | null
  onMutated?: () => void
  onLoadError?: (message: string) => void
  /** Omit for default label "Bid Notes"; pass "" to hide the heading (e.g. embedded in Bids summary). */
  title?: string
}

export function BidNotesTable({ bidId, onMutated, onLoadError, title }: BidNotesTableProps) {
  const [adding, setAdding] = useState(false)
  const { entries, loading, refetch } = useBidSubmissionEntries(bidId, onLoadError)
  const headingLabel = title === undefined ? 'Bid Notes' : title

  if (!bidId) return null

  async function handleUpdated() {
    await refetch()
    onMutated?.()
  }

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {headingLabel ? (
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{headingLabel}</div>
      ) : null}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', background: '#f9fafb' }}>
        {loading && entries.length === 0 && !adding ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</div>
        ) : null}
        {!loading && entries.length === 0 && !adding ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>No notes yet.</div>
        ) : null}
        {entries.map((entry, i) => (
          <BidNotesEntryRow
            key={entry.id}
            entry={entry}
            onUpdated={() => void handleUpdated()}
            isLastInList={i === entries.length - 1 && !adding}
          />
        ))}
        {adding ? (
          <BidNotesNewRow
            bidId={bidId}
            isLastInList
            onSaved={() => {
              setAdding(false)
              void handleUpdated()
            }}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </div>
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Add row
        </button>
      )}
    </div>
  )
}
