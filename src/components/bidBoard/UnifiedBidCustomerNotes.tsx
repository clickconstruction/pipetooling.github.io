import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { ContactMethodQuickPicks, contactMethodFieldInputStyle } from '../shared/ContactMethodQuickPicks'
import type { Database } from '../../types/database'

export type BidSubmissionEntry = Database['public']['Tables']['bids_submission_entries']['Row']
export type CustomerContactRow = Database['public']['Tables']['customer_contacts']['Row']

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
  background: '#eff6ff',
  borderLeft: '3px solid #3b82f6',
}

const customerVariantRead: CSSProperties = {
  background: '#f0fdf4',
  borderLeft: '3px solid #16a34a',
}

const bidBadgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.125rem 0.35rem',
  borderRadius: 4,
  background: '#dbeafe',
  color: '#1e40af',
}

const customerBadgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.125rem 0.35rem',
  borderRadius: 4,
  background: '#dcfce7',
  color: '#166534',
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
      <article aria-label="Edit bid note" style={{ ...cardBorder, background: '#ffffff', borderLeft: bidVariantRead.borderLeft }}>
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

  const ariaLabel = entry.occurred_at ? `Bid note ${new Date(entry.occurred_at).toLocaleString()}` : 'Bid note'

  return (
    <article aria-label={ariaLabel} style={{ ...cardBorder, ...bidVariantRead }}>
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
          <span style={bidBadgeStyle}>Bid note</span>
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
  const [contactAt, setContactAt] = useState(entry.contact_date ? entry.contact_date.slice(0, 16) : '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const contactDateIso = contactAt ? new Date(contactAt).toISOString() : entry.contact_date
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
    borderBottom: isLastInList ? 'none' : '1px solid #e5e7eb',
  }

  if (editing) {
    return (
      <article aria-label="Edit customer note" style={{ ...cardBorder, background: '#ffffff', borderLeft: customerVariantRead.borderLeft }}>
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

  const ariaLabel = entry.contact_date ? `Customer note ${new Date(entry.contact_date).toLocaleString()}` : 'Customer note'

  return (
    <article aria-label={ariaLabel} style={{ ...cardBorder, ...customerVariantRead }}>
      <div
        style={{
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          marginBottom: '0.5rem',
          fontSize: '0.9375rem',
          lineHeight: 1.45,
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
          <span style={customerBadgeStyle}>Customer note</span>
          <span>
            <span style={{ color: '#6b7280', marginRight: '0.35rem' }}>Contact method</span>
            {entry.contact_method ?? '—'}
          </span>
          <span>
            <span style={{ color: '#6b7280', marginRight: '0.35rem' }}>Time and date</span>
            {entry.contact_date ? new Date(entry.contact_date).toLocaleString() : '—'}
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
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!authUser?.id) {
      showToast('You must be signed in to add a note.', 'error')
      return
    }
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
        borderBottom: isLastInList ? 'none' : '1px solid #e5e7eb',
        background: '#fafafa',
        borderLeft: bidVariantRead.borderLeft,
      }}
    >
      <div style={{ marginBottom: '0.35rem' }}>
        <span style={bidBadgeStyle}>Bid note</span>
      </div>
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
  const [contactAt, setContactAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!authUser?.id) {
      showToast('You must be signed in to add a note.', 'error')
      return
    }
    setSaving(true)
    try {
      const contactDateIso = new Date(contactAt).toISOString()
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
        borderBottom: isLastInList ? 'none' : '1px solid #e5e7eb',
        background: '#fafafa',
        borderLeft: customerVariantRead.borderLeft,
      }}
    >
      <div style={{ marginBottom: '0.35rem' }}>
        <span style={customerBadgeStyle}>Customer note</span>
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
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
            style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </article>
  )
}

export type UnifiedBidCustomerNotesProps = {
  bidId: string
  customerId: string | null
  customerName: string
  onMutated?: () => void
  onLoadError?: (message: string) => void
  title?: string
}

export function UnifiedBidCustomerNotes({
  bidId,
  customerId,
  customerName,
  onMutated,
  onLoadError,
  title,
}: UnifiedBidCustomerNotesProps) {
  const [merged, setMerged] = useState<UnifiedNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addingKind, setAddingKind] = useState<null | 'bid' | 'customer'>(null)
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  const fetchAndSetMerged = useCallback(async () => {
    const errors: string[] = []
    let bidRows: BidSubmissionEntry[] = []
    let customerRows: CustomerContactRow[] = []
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').select('*').eq('bid_id', bidId).order('occurred_at', { ascending: false }),
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
            supabase.from('customer_contacts').select('*').eq('customer_id', customerId).order('contact_date', { ascending: false }),
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

  const headingLabel = title === undefined ? 'All notes' : title

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setAddingKind((prev) => (prev === 'bid' ? null : 'bid'))}
          style={{
            padding: '0.5rem 1rem',
            background: addingKind === 'bid' ? '#1d4ed8' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {addingKind === 'bid' ? 'Cancel bid note' : 'Add bid note'}
        </button>
        <button
          type="button"
          disabled={!customerId}
          title={!customerId ? 'No linked customer on this bid.' : `Add note for ${customerName}`}
          onClick={() => {
            if (!customerId) return
            setAddingKind((prev) => (prev === 'customer' ? null : 'customer'))
          }}
          style={{
            padding: '0.5rem 1rem',
            background: !customerId ? '#e5e7eb' : addingKind === 'customer' ? '#15803d' : '#16a34a',
            color: !customerId ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: 4,
            cursor: !customerId ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {addingKind === 'customer' ? 'Cancel customer note' : 'Add customer note'}
        </button>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', background: '#f9fafb' }}>
        {loading && merged.length === 0 && !hasDraft ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</div>
        ) : null}
        {showEmpty ? <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>No notes yet.</div> : null}
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
