import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatCompactNoteDateTime } from '../../utils/dateUtils'
import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { ContactMethodQuickPicks, contactMethodFieldInputStyle } from '../shared/ContactMethodQuickPicks'
import {
  NOTE_CARD_BODY_PADDING_RIGHT_FOR_FLOATING_EDIT,
  NoteCardFloatingEditButton,
} from '../shared/NoteCardFloatingEditButton'
import { submitNoteOnEnterKeyDown } from '../../lib/noteComposerTextareaKeyDown'
import {
  SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR,
  noteByLineFromEmbed,
  type BidSubmissionEntryWithCreator,
} from '../../lib/noteCreatorDisplay'

export type BidSubmissionEntry = BidSubmissionEntryWithCreator

function useBidSubmissionEntries(bidId: string | null, onLoadError?: (message: string) => void) {
  const [entries, setEntries] = useState<BidSubmissionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  const fetchEntries = useCallback(async (id: string) => {
    const data = await withSupabaseRetry(
      async () =>
        supabase.from('bids_submission_entries').select(SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR).eq('bid_id', id).order('occurred_at', { ascending: false }),
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
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal(entry.occurred_at))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const occurredAtIso = fromDatetimeLocal(occurredAt) ?? entry.occurred_at
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
    borderBottom: isLastInList ? 'none' : '1px solid var(--border)',
  }

  if (editing) {
    return (
      <article aria-label="Edit bid note" style={{ ...cardBorder, background: 'var(--surface)' }}>
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
          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
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
              style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              title="Delete"
              aria-label="Delete"
              style={{
                padding: '0.25rem',
                background: 'var(--bg-red-100)',
                color: 'var(--text-red-800)',
                border: '1px solid var(--border-red)',
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

  const ariaLabel = entry.occurred_at ? `Bid note ${formatCompactNoteDateTime(entry.occurred_at)}` : 'Bid note'

  return (
    <article aria-label={ariaLabel} style={{ position: 'relative', ...cardBorder, background: 'var(--surface)' }}>
      <NoteCardFloatingEditButton onClick={() => setEditing(true)} />
      <div
        style={{
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          marginBottom: '0.5rem',
          fontSize: '0.9375rem',
          lineHeight: 1.45,
          paddingRight: NOTE_CARD_BODY_PADDING_RIGHT_FOR_FLOATING_EDIT,
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
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem 1rem',
            alignItems: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-700)',
          }}
        >
          {entry.contact_method?.trim() ? (
            <span>
              <span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Contact method</span>
              {entry.contact_method.trim()}
            </span>
          ) : null}
          <span>{entry.occurred_at ? formatCompactNoteDateTime(entry.occurred_at) : '—'}</span>
          <span style={{ color: 'var(--text-muted)' }}>{noteByLineFromEmbed(entry.created_by_user)}</span>
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
  const { user: authUser } = useAuth()
  const [contactMethod, setContactMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => toDatetimeLocal(new Date().toISOString()))
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!authUser?.id) {
      showToast('You must be signed in to add a note.', 'error')
      return
    }
    setSaving(true)
    try {
      const occurredAtIso = fromDatetimeLocal(occurredAt) ?? new Date().toISOString()
      await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').insert({
            bid_id: bidId,
            contact_method: contactMethod.trim() || null,
            notes: notes.trim() || null,
            occurred_at: occurredAtIso,
            created_by: authUser.id,
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
    <article aria-label="New bid note" style={{ padding: '0.75rem', borderBottom: isLastInList ? 'none' : '1px solid var(--border)', background: 'var(--bg-page)' }}>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={(e) =>
          submitNoteOnEnterKeyDown(e, { saving, onSubmit: () => void submit() })
        }
        title="Shift+Enter new line, Enter add"
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
            style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
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
  /** Controlled add-row open state (e.g. parent toolbar). */
  adding?: boolean
  onAddingChange?: (adding: boolean) => void
  /** Hide bottom "Add row" when the parent provides add controls. */
  hideFooterAddButton?: boolean
}

export function BidNotesTable({
  bidId,
  onMutated,
  onLoadError,
  title,
  adding: addingProp,
  onAddingChange,
  hideFooterAddButton = false,
}: BidNotesTableProps) {
  const [internalAdding, setInternalAdding] = useState(false)
  const controlled = onAddingChange != null
  const adding = controlled ? Boolean(addingProp) : internalAdding
  const setAdding = (v: boolean) => {
    if (controlled) onAddingChange(v)
    else setInternalAdding(v)
  }
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
      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', background: 'var(--bg-subtle)' }}>
        {loading && entries.length === 0 && !adding ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</div>
        ) : null}
        {!loading && entries.length === 0 && !adding ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No notes yet.</div>
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
      {!adding && !hideFooterAddButton && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ padding: '0.25rem 0.65rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Add row
          </button>
        </div>
      )}
    </div>
  )
}
