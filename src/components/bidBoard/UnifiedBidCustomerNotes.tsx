import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatCompactNoteDateTime } from '../../utils/dateUtils'
import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { ContactMethodQuickPicks, contactMethodFieldInputStyle } from '../shared/ContactMethodQuickPicks'
import {
  NOTE_CARD_BODY_PADDING_RIGHT_FOR_FLOATING_EDIT,
  NoteCardFloatingEditButton,
} from '../shared/NoteCardFloatingEditButton'
import { submitNoteOnEnterKeyDown } from '../../lib/noteComposerTextareaKeyDown'
import {
  SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR,
  SELECT_CUSTOMER_CONTACTS_WITH_CREATOR,
  noteByLineFromEmbed,
  type BidSubmissionEntryWithCreator,
  type CustomerContactWithCreatorRow,
} from '../../lib/noteCreatorDisplay'

export type BidSubmissionEntry = BidSubmissionEntryWithCreator
export type CustomerContactRow = CustomerContactWithCreatorRow

export type UnifiedNoteRow =
  | {
      kind: 'bid'
      id: string
      at: string
      contactMethod: string | null
      body: string | null
      entry: BidSubmissionEntry
    }
  | {
      kind: 'customer'
      id: string
      at: string
      contactMethod: string | null
      body: string | null
      entry: CustomerContactRow
    }

function sortTimeDesc(a: UnifiedNoteRow, b: UnifiedNoteRow): number {
  const ta = Date.parse(a.at)
  const tb = Date.parse(b.at)
  const sa = Number.isFinite(ta) ? ta : 0
  const sb = Number.isFinite(tb) ? tb : 0
  if (sb !== sa) return sb - sa
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
  return a.id.localeCompare(b.id)
}

function mergeRows(bids: BidSubmissionEntry[], customers: CustomerContactRow[]): UnifiedNoteRow[] {
  const mapped: UnifiedNoteRow[] = [
    ...bids.map((entry) => ({
      kind: 'bid' as const,
      id: entry.id,
      at: entry.occurred_at,
      contactMethod: entry.contact_method ?? null,
      body: entry.notes ?? null,
      entry,
    })),
    ...customers.map((entry) => ({
      kind: 'customer' as const,
      id: entry.id,
      at: entry.contact_date,
      contactMethod: entry.contact_method ?? null,
      body: entry.details ?? null,
      entry,
    })),
  ]
  mapped.sort(sortTimeDesc)
  return mapped
}

const bidVariantRead: CSSProperties = {
  background: 'var(--bg-blue-tint)',
  borderLeft: '3px solid #3b82f6',
}

const customerVariantRead: CSSProperties = {
  background: 'var(--bg-green-tint)',
  borderLeft: '3px solid #16a34a',
}

const bidBadgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.125rem 0.35rem',
  borderRadius: 4,
  background: 'var(--bg-blue-200)',
  color: 'var(--text-blue-800)',
}

const customerBadgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.125rem 0.35rem',
  borderRadius: 4,
  background: 'var(--bg-green-100)',
  color: 'var(--text-green-800)',
}

function UnifiedEntryRow({
  row,
  onUpdated,
  isLastInList,
}: {
  row: UnifiedNoteRow
  onUpdated: () => void
  isLastInList: boolean
}) {
  if (row.kind === 'bid') {
    return <BidUnifiedEntryRow entry={row.entry} onUpdated={onUpdated} isLastInList={isLastInList} />
  }
  return <CustomerUnifiedEntryRow entry={row.entry} onUpdated={onUpdated} isLastInList={isLastInList} />
}

function BidUnifiedEntryRow({
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
      <article aria-label="Edit bid note" style={{ ...cardBorder, background: 'var(--surface)', borderLeft: bidVariantRead.borderLeft }}>
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

  const ariaLabel = entry.occurred_at ? `Bid note ${formatCompactNoteDateTime(entry.occurred_at)}` : 'Bid note'

  return (
    <article aria-label={ariaLabel} style={{ position: 'relative', ...cardBorder, ...bidVariantRead }}>
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
          <span style={bidBadgeStyle}>Bid note</span>
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

function CustomerUnifiedEntryRow({
  entry,
  onUpdated,
  isLastInList,
}: {
  entry: CustomerContactRow
  onUpdated: () => void
  isLastInList: boolean
}) {
  const { showToast } = useToastContext()
  const [contactMethod, setContactMethod] = useState(entry.contact_method ?? '')
  const [details, setDetails] = useState(entry.details ?? '')
  const [contactAt, setContactAt] = useState(toDatetimeLocal(entry.contact_date))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const contactDateIso = fromDatetimeLocal(contactAt) ?? entry.contact_date
      await withSupabaseRetry(
        async () =>
          supabase
            .from('customer_contacts')
            .update({
              contact_method: contactMethod.trim() || null,
              details: details.trim() || null,
              contact_date: contactDateIso,
            })
            .eq('id', entry.id),
        'update customer contact'
      )
      setEditing(false)
      onUpdated()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save customer note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Remove this entry?')) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('customer_contacts').delete().eq('id', entry.id),
        'delete customer contact'
      )
      onUpdated()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete customer note'), 'error')
    }
  }

  const cardBorder: CSSProperties = {
    padding: '0.75rem',
    borderBottom: isLastInList ? 'none' : '1px solid var(--border)',
  }

  if (editing) {
    return (
      <article aria-label="Edit customer note" style={{ ...cardBorder, background: 'var(--surface)', borderLeft: customerVariantRead.borderLeft }}>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
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
            value={contactAt}
            onChange={(e) => setContactAt(e.target.value)}
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

  const ariaLabel = entry.contact_date ? `Customer note ${formatCompactNoteDateTime(entry.contact_date)}` : 'Customer note'

  return (
    <article aria-label={ariaLabel} style={{ position: 'relative', ...cardBorder, ...customerVariantRead }}>
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
        {entry.details != null && entry.details !== '' ? entry.details : '—'}
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
          <span style={customerBadgeStyle}>Customer note</span>
          {entry.contact_method?.trim() ? (
            <span>
              <span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Contact method</span>
              {entry.contact_method.trim()}
            </span>
          ) : null}
          <span>{entry.contact_date ? formatCompactNoteDateTime(entry.contact_date) : '—'}</span>
          <span style={{ color: 'var(--text-muted)' }}>{noteByLineFromEmbed(entry.created_by_user)}</span>
        </div>
      </div>
    </article>
  )
}

function UnifiedNewBidRow({
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
    <article
      aria-label="New bid note"
      style={{
        padding: '0.75rem',
        borderBottom: isLastInList ? 'none' : '1px solid var(--border)',
        background: 'var(--bg-page)',
        borderLeft: bidVariantRead.borderLeft,
      }}
    >
      <div style={{ marginBottom: '0.35rem' }}>
        <span style={bidBadgeStyle}>Bid note</span>
      </div>
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

function UnifiedNewCustomerRow({
  customerId,
  onSaved,
  onCancel,
  isLastInList,
}: {
  customerId: string
  onSaved: () => void
  onCancel: () => void
  isLastInList: boolean
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [contactMethod, setContactMethod] = useState('')
  const [details, setDetails] = useState('')
  const [contactAt, setContactAt] = useState(() => toDatetimeLocal(new Date().toISOString()))
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!authUser?.id) {
      showToast('You must be signed in to add a note.', 'error')
      return
    }
    setSaving(true)
    try {
      const contactDateIso = fromDatetimeLocal(contactAt) ?? new Date().toISOString()
      await withSupabaseRetry(
        async () =>
          supabase.from('customer_contacts').insert({
            customer_id: customerId,
            contact_date: contactDateIso,
            details: details.trim() || null,
            contact_method: contactMethod.trim() || null,
            created_by: authUser.id,
          }),
        'insert customer contact'
      )
      onSaved()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add customer note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      aria-label="New customer note"
      style={{
        padding: '0.75rem',
        borderBottom: isLastInList ? 'none' : '1px solid var(--border)',
        background: 'var(--bg-page)',
        borderLeft: customerVariantRead.borderLeft,
      }}
    >
      <div style={{ marginBottom: '0.35rem' }}>
        <span style={customerBadgeStyle}>Customer note</span>
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
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
          value={contactAt}
          onChange={(e) => setContactAt(e.target.value)}
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

export type UnifiedNotesAddingKind = null | 'bid' | 'customer'

export function UnifiedBidCustomerNotesActionButtons({
  addingKind,
  onAddingKindChange,
  customerId,
  customerName,
}: {
  addingKind: UnifiedNotesAddingKind
  onAddingKindChange: (v: UnifiedNotesAddingKind) => void
  customerId: string | null
  customerName: string
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      <button
        type="button"
        onClick={() => onAddingKindChange(addingKind === 'bid' ? null : 'bid')}
        style={{
          padding: '0.25rem 0.65rem',
          background: addingKind === 'bid' ? '#1d4ed8' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        {addingKind === 'bid' ? 'Cancel bid note' : '+ bid note'}
      </button>
      <button
        type="button"
        disabled={!customerId}
        title={!customerId ? 'No linked customer on this bid.' : `Add note for ${customerName}`}
        onClick={() => {
          if (!customerId) return
          onAddingKindChange(addingKind === 'customer' ? null : 'customer')
        }}
        style={{
          padding: '0.25rem 0.65rem',
          background: !customerId ? '#e5e7eb' : addingKind === 'customer' ? '#15803d' : '#16a34a',
          color: !customerId ? 'var(--text-faint)' : 'white',
          border: 'none',
          borderRadius: 4,
          cursor: !customerId ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
        }}
      >
        {addingKind === 'customer' ? 'Cancel customer note' : '+ customer note'}
      </button>
    </div>
  )
}

export type UnifiedBidCustomerNotesProps = {
  bidId: string
  customerId: string | null
  customerName: string
  onMutated?: () => void
  onLoadError?: (message: string) => void
  title?: string
  /** When set with `onAddingKindChange`, controls the + bid / + customer draft state from the parent. */
  addingKind?: UnifiedNotesAddingKind
  onAddingKindChange?: (v: UnifiedNotesAddingKind) => void
  /** Hide the + bid note row (parent renders it, e.g. beside tabs on desktop preview). */
  hideActionButtons?: boolean
}

export function UnifiedBidCustomerNotes({
  bidId,
  customerId,
  customerName,
  onMutated,
  onLoadError,
  title,
  addingKind: addingKindProp,
  onAddingKindChange,
  hideActionButtons = false,
}: UnifiedBidCustomerNotesProps) {
  const [merged, setMerged] = useState<UnifiedNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [internalAddingKind, setInternalAddingKind] = useState<UnifiedNotesAddingKind>(null)
  const controlled = onAddingKindChange != null
  const addingKind = controlled ? (addingKindProp ?? null) : internalAddingKind
  const setAddingKind = controlled ? onAddingKindChange : setInternalAddingKind
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  const fetchAndSetMerged = useCallback(async () => {
    const errors: string[] = []
    let bidRows: BidSubmissionEntry[] = []
    let customerRows: CustomerContactRow[] = []
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').select(SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR).eq('bid_id', bidId).order('occurred_at', { ascending: false }),
        'load bid submission entries unified'
      )
      bidRows = (data as BidSubmissionEntry[] | null) ?? []
    } catch (e) {
      errors.push(`Bid notes: ${formatErrorMessage(e)}`)
    }
    if (customerId) {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.from('customer_contacts').select(SELECT_CUSTOMER_CONTACTS_WITH_CREATOR).eq('customer_id', customerId).order('contact_date', { ascending: false }),
          'load customer contacts unified'
        )
        customerRows = (data as CustomerContactRow[] | null) ?? []
      } catch (e) {
        errors.push(`Customer notes: ${formatErrorMessage(e)}`)
      }
    }
    if (errors.length > 0) {
      onLoadErrorRef.current?.(`Failed to load all notes: ${errors.join(' ')}`)
    }
    setMerged(mergeRows(bidRows, customerRows))
  }, [bidId, customerId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchAndSetMerged().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchAndSetMerged])

  const headingLabel = title === undefined ? 'All' : title

  async function handleUpdated() {
    await fetchAndSetMerged()
    onMutated?.()
  }

  const hasDraft = addingKind !== null
  const showEmpty = !loading && merged.length === 0 && !hasDraft

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {headingLabel ? (
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{headingLabel}</div>
      ) : null}
      {!hideActionButtons ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            justifyContent: 'center',
          }}
        >
          <UnifiedBidCustomerNotesActionButtons
            addingKind={addingKind}
            onAddingKindChange={setAddingKind}
            customerId={customerId}
            customerName={customerName}
          />
        </div>
      ) : null}
      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', background: 'var(--bg-subtle)' }}>
        {loading && merged.length === 0 && !hasDraft ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</div>
        ) : null}
        {showEmpty ? <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No notes yet.</div> : null}
        {merged.map((row, i) => (
          <UnifiedEntryRow
            key={`${row.kind}-${row.id}`}
            row={row}
            onUpdated={() => void handleUpdated()}
            isLastInList={i === merged.length - 1 && !hasDraft}
          />
        ))}
        {addingKind === 'bid' ? (
          <UnifiedNewBidRow
            bidId={bidId}
            isLastInList
            onSaved={() => {
              setAddingKind(null)
              void handleUpdated()
            }}
            onCancel={() => setAddingKind(null)}
          />
        ) : null}
        {addingKind === 'customer' && customerId ? (
          <UnifiedNewCustomerRow
            customerId={customerId}
            isLastInList
            onSaved={() => {
              setAddingKind(null)
              void handleUpdated()
            }}
            onCancel={() => setAddingKind(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
